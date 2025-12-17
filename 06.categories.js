/**
 * =============================================================================
 * CATEGORIES.GS - Módulo de Gerenciamento de Categorias
 * =============================================================================
 *
 * Responsável por todas as operações relacionadas a categorias:
 * - Criar novas categorias
 * - Listar categorias (ativas, inativas, por tipo)
 * - Atualizar categorias
 * - Desativar/ativar categorias
 * - Validar categorias
 *
 * Categorias não são deletadas, apenas desativadas para manter integridade
 * referencial com transações existentes.
 * =============================================================================
 */

// Limites de quantidade para prevenir abuso
const MAX_CATEGORIES = 500;  // Máximo de categorias permitidas no sistema

/**
 * Cria uma nova categoria
 *
 * @param {string} token - Token de sessão
 * @param {Object} categoryData - Dados da categoria
 * @returns {Object} Resultado da operação
 */
function createCategory(token, categoryData) {
  try {
    // Valida sessão
    if (!validateSession(token)) {
      return {
        success: false,
        message: 'Sessão inválida ou expirada'
      };
    }

    // Verifica limite de categorias
    const currentCount = getDataRowCount('Categories');
    if (currentCount >= MAX_CATEGORIES) {
      logEvent('CATEGORIES', 'WARN', 'createCategory', `Limite de ${MAX_CATEGORIES} categorias atingido`, '');
      return {
        success: false,
        message: `Limite máximo de ${MAX_CATEGORIES} categorias atingido. Exclua categorias inativas antes de criar novas.`
      };
    }

    // Valida dados da categoria
    const validation = validateCategoryData(categoryData);
    if (!validation.valid) {
      logEvent('CATEGORIES', 'WARN', 'createCategory', 'Dados inválidos: ' + validation.message, '');
      return {
        success: false,
        message: validation.message
      };
    }
    
    // Verifica duplicidade
    const duplicate = checkDuplicateCategory(categoryData.name, categoryData.kind);
    if (duplicate) {
      logEvent('CATEGORIES', 'WARN', 'createCategory', 'Categoria duplicada: ' + categoryData.name, '');
      return {
        success: false,
        message: 'Categoria já existe'
      };
    }
    
    // Sanitiza dados
    const sanitized = sanitizeCategoryData(categoryData);
    
    // Gera próximo ID
    const id = getNextId('Categories');
    
    // Monta array de dados
    const rowData = [
      id,
      sanitized.kind,
      sanitized.name,
      true  // isActive sempre true para novas categorias
    ];
    
    // Adiciona à planilha
    const success = addRow('Categories', rowData);
    
    if (!success) {
      logEvent('CATEGORIES', 'ERROR', 'createCategory', 'Erro ao adicionar categoria', '');
      return {
        success: false,
        message: 'Erro ao criar categoria'
      };
    }
    
    // Log de sucesso
    logEvent('CATEGORIES', 'INFO', 'createCategory', 'Categoria criada: ID ' + id, '');
    bumpUserDataVersion('categories');
    
    return {
      success: true,
      message: 'Categoria criada com sucesso',
      id: id,
      data: {
        id: id,
        kind: sanitized.kind,
        name: sanitized.name,
        isActive: true
      }
    };
    
  } catch (error) {
    logEvent('CATEGORIES', 'ERROR', 'createCategory', 'Erro ao criar categoria', error.stack);
    return {
      success: false,
      message: 'Erro ao criar categoria: ' + error.message
    };
  }
}

/**
 * Lista todas as categorias ou filtra por tipo/status
 * 
 * @param {string} token - Token de sessão
 * @param {Object} filters - Filtros opcionais (kind, isActive)
 * @returns {Object} Resultado da operação com lista de categorias
 */
/**
 * Lista categorias com suporte a paginação e filtros
 *
 * @param {string} token - Token de sessão
 * @param {Object} filters - Filtros e parâmetros de paginação
 * @param {number} filters.page - Número da página (padrão: 1)
 * @param {number} filters.pageSize - Tamanho da página (padrão: 100, máximo: 1000)
 * @param {string} filters.kind - Tipo: 'debit' ou 'credit'
 * @param {boolean} filters.isActive - Status ativo/inativo
 * @returns {Object} Resultado com dados paginados
 */
function listCategories(token, filters) {
  try {
    // Valida sessão
    if (!validateSession(token)) {
      return {
        success: false,
        message: 'Sessão inválida ou expirada',
        data: []
      };
    }

    const version = getUserDataVersion('categories');
    const cacheKey = makeCacheKey(`categories_v${version}`, { filters: filters || {} });
    return getCachedData(cacheKey, function() {

    // Parâmetros de paginação
    const page = (filters && filters.page && filters.page > 0) ? parseInt(filters.page) : 1;
    const pageSize = (filters && filters.pageSize && filters.pageSize > 0)
      ? Math.min(parseInt(filters.pageSize), 1000)  // Máximo 1000 por página
      : 100;  // Padrão 100 (categorias são menos numerosas que transações)

    // Obtém todos os dados
    const data = getAllData('Categories');

    // Se não há dados, retorna array vazio
    if (data.length === 0) {
      return {
        success: true,
        message: 'Nenhuma categoria encontrada',
        data: [],
        count: 0,
        total: 0,
        page: page,
        pageSize: pageSize,
        totalPages: 0
      };
    }
    
    // Converte para objetos
    let categories = data.map(row => ({
      id: row[0],
      kind: row[1],
      name: row[2],
      isActive: row[3]
    }));
    
    // Aplica filtros se fornecidos
    if (filters && typeof filters === 'object') {
      // Filtro por tipo
      if (filters.kind && (filters.kind === 'debit' || filters.kind === 'credit')) {
        categories = categories.filter(c => c.kind === filters.kind);
      }
      
      // Filtro por status
      if (filters.isActive !== undefined) {
        categories = categories.filter(c => c.isActive === filters.isActive);
      }
    }
    
    // Ordena por nome
    categories.sort((a, b) => a.name.localeCompare(b.name));

    // Calcula paginação
    const total = categories.length;
    const totalPages = Math.ceil(total / pageSize);
    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;

    // Aplica paginação
    const paginatedCategories = categories.slice(startIndex, endIndex);

    return {
      success: true,
      message: 'Categorias listadas com sucesso',
      data: paginatedCategories,
      count: paginatedCategories.length,
      total: total,
      page: page,
      pageSize: pageSize,
      totalPages: totalPages
    };

    }, 300);
    
  } catch (error) {
    logEvent('CATEGORIES', 'ERROR', 'listCategories', 'Erro ao listar categorias', error.stack);

    const page = (filters && filters.page && filters.page > 0) ? parseInt(filters.page) : 1;
    const pageSize = (filters && filters.pageSize && filters.pageSize > 0)
      ? Math.min(parseInt(filters.pageSize), 1000)
      : 100;

    return {
      success: false,
      message: 'Erro ao listar categorias: ' + error.message,
      data: [],
      count: 0,
      total: 0,
      page: page,
      pageSize: pageSize,
      totalPages: 0
    };
  }
}

/**
 * Atualiza uma categoria existente
 * 
 * @param {string} token - Token de sessão
 * @param {number} id - ID da categoria
 * @param {Object} categoryData - Novos dados da categoria
 * @returns {Object} Resultado da operação
 */
function updateCategory(token, id, categoryData) {
  try {
    // Valida sessão
    if (!validateSession(token)) {
      return {
        success: false,
        message: 'Sessão inválida ou expirada'
      };
    }
    
    // Valida ID
    if (!id || isNaN(parseInt(id))) {
      return {
        success: false,
        message: 'ID inválido'
      };
    }
    
    // Busca categoria
    const found = findRowById('Categories', parseInt(id));
    if (!found) {
      logEvent('CATEGORIES', 'WARN', 'updateCategory', 'Categoria não encontrada: ID ' + id, '');
      return {
        success: false,
        message: 'Categoria não encontrada'
      };
    }
    
    // Valida dados da categoria
    const validation = validateCategoryData(categoryData);
    if (!validation.valid) {
      logEvent('CATEGORIES', 'WARN', 'updateCategory', 'Dados inválidos: ' + validation.message, '');
      return {
        success: false,
        message: validation.message
      };
    }
    
    // Verifica duplicidade (excluindo a própria categoria)
    const duplicate = checkDuplicateCategory(categoryData.name, categoryData.kind, parseInt(id));
    if (duplicate) {
      logEvent('CATEGORIES', 'WARN', 'updateCategory', 'Categoria duplicada: ' + categoryData.name, '');
      return {
        success: false,
        message: 'Já existe outra categoria com este nome'
      };
    }
    
    // Sanitiza dados
    const sanitized = sanitizeCategoryData(categoryData);
    
    // Mantém isActive original se não fornecido
    const isActive = categoryData.isActive !== undefined ? categoryData.isActive : found.data[3];
    
    // Monta array de dados
    const rowData = [
      parseInt(id),
      sanitized.kind,
      sanitized.name,
      isActive
    ];
    
    // Atualiza na planilha
    const success = updateRow('Categories', found.rowIndex, rowData);
    
    if (!success) {
      logEvent('CATEGORIES', 'ERROR', 'updateCategory', 'Erro ao atualizar categoria', '');
      return {
        success: false,
        message: 'Erro ao atualizar categoria'
      };
    }
    
    // Log de sucesso
    logEvent('CATEGORIES', 'INFO', 'updateCategory', 'Categoria atualizada: ID ' + id, '');
    bumpUserDataVersion('categories');
    
    return {
      success: true,
      message: 'Categoria atualizada com sucesso',
      data: {
        id: parseInt(id),
        kind: sanitized.kind,
        name: sanitized.name,
        isActive: isActive
      }
    };
    
  } catch (error) {
    logEvent('CATEGORIES', 'ERROR', 'updateCategory', 'Erro ao atualizar categoria', error.stack);
    return {
      success: false,
      message: 'Erro ao atualizar categoria: ' + error.message
    };
  }
}

/**
 * Função interna para alterar o status de uma categoria
 * Evita duplicação de código entre activateCategory e deactivateCategory
 *
 * @param {string} token - Token de sessão
 * @param {number} id - ID da categoria
 * @param {boolean} isActive - Novo status (true = ativar, false = desativar)
 * @param {string} actionName - Nome da ação para logs
 * @returns {Object} Resultado da operação
 */
function setCategoryStatus(token, id, isActive, actionName) {
  try {
    // Valida sessão
    if (!validateSession(token)) {
      return {
        success: false,
        message: 'Sessão inválida ou expirada'
      };
    }

    // Valida ID
    if (!id || isNaN(parseInt(id))) {
      return {
        success: false,
        message: 'ID inválido'
      };
    }

    // Busca categoria
    const found = findRowById('Categories', parseInt(id));
    if (!found) {
      logEvent('CATEGORIES', 'WARN', actionName, `Categoria não encontrada: ID ${id}`, '');
      return {
        success: false,
        message: 'Categoria não encontrada'
      };
    }

    // Atualiza isActive
    found.data[3] = isActive;

    // Atualiza na planilha
    const success = updateRow('Categories', found.rowIndex, found.data);

    if (!success) {
      logEvent('CATEGORIES', 'ERROR', actionName, `Erro ao ${isActive ? 'ativar' : 'desativar'} categoria`, '');
      return {
        success: false,
        message: `Erro ao ${isActive ? 'ativar' : 'desativar'} categoria`
      };
    }

    // Log de sucesso
    logEvent('CATEGORIES', 'INFO', actionName, `Categoria ${isActive ? 'ativada' : 'desativada'}: ID ${id}`, '');
    bumpUserDataVersion('categories');

    return {
      success: true,
      message: `Categoria ${isActive ? 'ativada' : 'desativada'} com sucesso`
    };

  } catch (error) {
    logEvent('CATEGORIES', 'ERROR', actionName, `Erro ao ${isActive ? 'ativar' : 'desativar'} categoria`, error.stack);
    return {
      success: false,
      message: `Erro ao ${isActive ? 'ativar' : 'desativar'} categoria: ${error.message}`
    };
  }
}

/**
 * Desativa uma categoria
 * Categorias não são deletadas para manter integridade referencial
 *
 * @param {string} token - Token de sessão
 * @param {number} id - ID da categoria
 * @returns {Object} Resultado da operação
 */
function deactivateCategory(token, id) {
  return setCategoryStatus(token, id, false, 'deactivateCategory');
}

/**
 * Ativa uma categoria
 *
 * @param {string} token - Token de sessão
 * @param {number} id - ID da categoria
 * @returns {Object} Resultado da operação
 */
function activateCategory(token, id) {
  return setCategoryStatus(token, id, true, 'activateCategory');
}

/**
 * Valida dados de uma categoria
 * 
 * @param {Object} data - Dados a validar
 * @returns {Object} Objeto com valid (boolean) e message (string)
 */
function validateCategoryData(data) {
  // Verifica se data é um objeto
  if (!data || typeof data !== 'object') {
    return {
      valid: false,
      message: 'Dados inválidos'
    };
  }
  
  // Valida tipo
  if (!data.kind || (data.kind !== 'debit' && data.kind !== 'credit')) {
    return {
      valid: false,
      message: 'Tipo deve ser "debit" ou "credit"'
    };
  }
  
  // Valida nome
  if (!data.name || typeof data.name !== 'string' || data.name.trim().length === 0) {
    return {
      valid: false,
      message: 'Nome é obrigatório'
    };
  }
  
  // Valida comprimento do nome (máximo 100 caracteres)
  if (data.name.trim().length > 100) {
    return {
      valid: false,
      message: 'Nome deve ter no máximo 100 caracteres'
    };
  }
  
  // Tudo válido
  return {
    valid: true,
    message: 'OK'
  };
}

/**
 * Sanitiza dados de uma categoria
 * 
 * @param {Object} data - Dados a sanitizar
 * @returns {Object} Dados sanitizados
 */
function sanitizeCategoryData(data) {
  return {
    kind: data.kind.trim().toLowerCase(),
    name: data.name.trim().substring(0, 100)
  };
}

/**
 * Verifica se categoria já existe
 * 
 * @param {string} name - Nome da categoria
 * @param {string} kind - Tipo (debit ou credit)
 * @param {number} excludeId - ID a excluir da busca (para update)
 * @returns {boolean} True se existe, False caso contrário
 */
function checkDuplicateCategory(name, kind, excludeId) {
  try {
    const categories = getAllData('Categories');
    
    // Procura por categoria com mesmo nome e tipo
    const found = categories.find(row => {
      const isDuplicate = row[2].toLowerCase() === name.trim().toLowerCase() && row[1] === kind;
      const isNotExcluded = !excludeId || row[0] !== excludeId;
      return isDuplicate && isNotExcluded;
    });
    
    return found !== undefined;
    
  } catch (error) {
    console.error('[CATEGORIES] Erro ao verificar duplicidade:', error);
    return false;
  }
}

/**
 * Obtém categorias ativas por tipo
 * 
 * @param {string} token - Token de sessão
 * @param {string} kind - Tipo (debit ou credit)
 * @returns {Object} Resultado da operação
 */
function getActiveCategories(token, kind) {
  return listCategories(token, {
    kind: kind,
    isActive: true
  });
}

function criarCategoriaSaldoInicial() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Categories');
  
  if (!sheet) {
    Logger.log('Erro: Aba Categories não encontrada');
    return;
  }
  
  // Verifica se já existe
  const data = sheet.getDataRange().getValues();
  const exists = data.some(row => row[2] === 'Saldo Inicial');
  
  if (exists) {
    Logger.log('Categoria Saldo Inicial já existe');
    return;
  }
  
  // Busca próximo ID
  let maxId = 0;
  for (let i = 1; i < data.length; i++) {
    const id = parseInt(data[i][0]);
    if (!isNaN(id) && id > maxId) {
      maxId = id;
    }
  }
  
  const nextId = maxId + 1;
  
  // Adiciona categoria
  sheet.appendRow([
    nextId,
    'credit',
    'Saldo Inicial',
    true
  ]);
  
  Logger.log('Categoria Saldo Inicial criada com ID ' + nextId);
}
