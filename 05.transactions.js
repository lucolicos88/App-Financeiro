/**
 * =============================================================================
 * TRANSACTIONS.GS - VERSÃO CORRIGIDA COM LOGS DETALHADOS
 * =============================================================================
 */

// Limites de quantidade para prevenir abuso e problemas de performance
const MAX_TRANSACTIONS = 50000;  // Máximo de transações permitidas no sistema
const MAX_INSTALLMENTS = 60;      // Máximo de parcelas por transação

function createTransaction(token, transactionData) {
  try {
    console.log('[TRANSACTIONS] createTransaction chamada com:', transactionData);

    if (!validateSession(token)) {
      console.log('[TRANSACTIONS] Sessão inválida');
      return {
        success: false,
        message: 'Sessão inválida ou expirada'
      };
    }

    // Verifica limite de transações
    const currentCount = getDataRowCount('Transactions');
    if (currentCount >= MAX_TRANSACTIONS) {
      console.log('[TRANSACTIONS] Limite de transações atingido:', currentCount);
      logEvent('TRANSACTIONS', 'WARN', 'createTransaction', `Limite de ${MAX_TRANSACTIONS} transações atingido`, '');
      return {
        success: false,
        message: `Limite máximo de ${MAX_TRANSACTIONS} transações atingido. Exclua transações antigas antes de criar novas.`
      };
    }

    const validation = validateTransactionData(transactionData);
    if (!validation.valid) {
      console.log('[TRANSACTIONS] Dados inválidos:', validation.message);
      logEvent('TRANSACTIONS', 'WARN', 'createTransaction', 'Dados inválidos: ' + validation.message, '');
      return {
        success: false,
        message: validation.message
      };
    }
    
    const sanitized = sanitizeTransactionData(transactionData);
    const id = getNextId('Transactions');
    const now = new Date().toISOString();
    
    // Se for parcelado, delega para função específica
if (transactionData.installments && parseInt(transactionData.installments) > 1) {
  return createInstallmentTransactions(token, transactionData);
}

const rowData = [
  id,
  sanitized.date,
  sanitized.type,
  sanitized.category,
  sanitized.description,
  sanitized.amount,
  now,
  now,
  transactionData.attachmentId || '',           // attachmentId
  transactionData.paymentMethod || 'Outros',    // paymentMethod
  1,                                             // installments (sempre 1 para transação única)
  1,                                             // installmentNumber
  ''                                             // parentTransactionId (vazio para transação única)
];
    
    const success = addRow('Transactions', rowData);
    
    if (!success) {
      console.log('[TRANSACTIONS] Erro ao adicionar linha');
      logEvent('TRANSACTIONS', 'ERROR', 'createTransaction', 'Erro ao adicionar transação', '');
      return {
        success: false,
        message: 'Erro ao criar transação'
      };
    }
    
    console.log('[TRANSACTIONS] Transação criada com sucesso, ID:', id);
    logEvent('TRANSACTIONS', 'INFO', 'createTransaction', 'Transação criada: ID ' + id, '');
    bumpUserDataVersion('transactions');
    
    return {
      success: true,
      message: 'Transação criada com sucesso',
      id: id,
      data: {
        id: id,
        date: sanitized.date,
        type: sanitized.type,
        category: sanitized.category,
        description: sanitized.description,
        amount: sanitized.amount,
        createdAt: now,
        updatedAt: now
      }
    };
    
  } catch (error) {
    console.error('[TRANSACTIONS] Erro em createTransaction:', error);
    logEvent('TRANSACTIONS', 'ERROR', 'createTransaction', 'Erro ao criar transação', error.stack);
    return {
      success: false,
      message: 'Erro ao criar transação: ' + error.message
    };
  }
}

/**
 * Lista transações com suporte a paginação e filtros
 *
 * @param {string} token - Token de sessão
 * @param {Object} filters - Filtros e parâmetros de paginação
 * @param {number} filters.page - Número da página (padrão: 1)
 * @param {number} filters.pageSize - Tamanho da página (padrão: 50, máximo: 1000)
 * @param {string} filters.startDate - Data inicial (formato YYYY-MM-DD)
 * @param {string} filters.endDate - Data final (formato YYYY-MM-DD)
 * @param {string} filters.type - Tipo: 'debit' ou 'credit'
 * @param {string} filters.category - Nome da categoria
 * @param {string} filters.search - Texto para buscar na descrição
 * @param {number|string} filters.minAmount - Valor mínimo
 * @param {number|string} filters.maxAmount - Valor máximo
 * @param {string} filters.paymentMethod - Forma de pagamento
 * @returns {Object} Resultado com dados paginados
 */
function queryTransactions(token, filters) {
  try {
    if (!validateSession(token)) {
      return {
        success: false,
        message: 'Sessão inválida ou expirada',
        data: []
      };
    }

    const data = getAllData('Transactions');

    if (!data || data.length === 0) {
      return {
        success: true,
        message: 'Nenhuma transação encontrada',
        data: [],
        count: 0
      };
    }

    let transactions = data.map(row => {
      if (!row || row.length < 8) {
        return null;
      }

      let dateStr = row[1];
      if (dateStr instanceof Date) {
        const year = dateStr.getFullYear();
        const month = String(dateStr.getMonth() + 1).padStart(2, '0');
        const day = String(dateStr.getDate()).padStart(2, '0');
        dateStr = `${year}-${month}-${day}`;
      } else if (typeof dateStr === 'string' && dateStr.includes('T')) {
        dateStr = dateStr.split('T')[0];
      }

      const attachmentId = row.length > 8 ? (row[8] || null) : null;
      const paymentMethod = row.length > 9 ? (row[9] || 'Outros') : 'Outros';
      const installments = row.length > 10 ? (parseInt(row[10]) || 1) : 1;
      const installmentNumber = row.length > 11 ? (parseInt(row[11]) || 1) : 1;
      const parentTransactionId = row.length > 12 ? (row[12] || '') : '';

      return {
        id: row[0],
        date: dateStr,
        type: row[2],
        category: row[3],
        description: row[4],
        amount: parseFloat(row[5]) || 0,
        createdAt: row[6],
        updatedAt: row[7],
        attachmentId: attachmentId,
        hasAttachment: attachmentId ? true : false,
        paymentMethod: paymentMethod,
        installments: installments,
        installmentNumber: installmentNumber,
        parentTransactionId: parentTransactionId,
        isInstallment: parentTransactionId ? true : false
      };
    }).filter(t => t !== null);

    if (filters && typeof filters === 'object') {
      if (filters.startDate) {
        transactions = transactions.filter(t => t.date >= filters.startDate);
      }

      if (filters.endDate) {
        transactions = transactions.filter(t => t.date <= filters.endDate);
      }

      if (filters.type && (filters.type === 'debit' || filters.type === 'credit')) {
        transactions = transactions.filter(t => t.type === filters.type);
      }

      if (filters.category) {
        transactions = transactions.filter(t => t.category === filters.category);
      }

      if (filters.paymentMethod) {
        transactions = transactions.filter(t => (t.paymentMethod || 'Outros') === filters.paymentMethod);
      }

      if (filters.search && String(filters.search).trim()) {
        const needle = String(filters.search).trim().toLowerCase();
        transactions = transactions.filter(t => String(t.description || '').toLowerCase().includes(needle));
      }

      const minAmount = (filters.minAmount !== undefined && filters.minAmount !== null && filters.minAmount !== '')
        ? parseFloat(filters.minAmount)
        : null;
      const maxAmount = (filters.maxAmount !== undefined && filters.maxAmount !== null && filters.maxAmount !== '')
        ? parseFloat(filters.maxAmount)
        : null;
      if (minAmount !== null && !isNaN(minAmount)) {
        transactions = transactions.filter(t => (parseFloat(t.amount) || 0) >= minAmount);
      }
      if (maxAmount !== null && !isNaN(maxAmount)) {
        transactions = transactions.filter(t => (parseFloat(t.amount) || 0) <= maxAmount);
      }
    }

    transactions.sort((a, b) => {
      if (a.date > b.date) return -1;
      if (a.date < b.date) return 1;
      return 0;
    });

    return {
      success: true,
      message: 'Transações obtidas com sucesso',
      data: transactions,
      count: transactions.length
    };
  } catch (error) {
    console.error('[TRANSACTIONS] Erro em queryTransactions:', error);
    logEvent('TRANSACTIONS', 'ERROR', 'queryTransactions', 'Erro ao consultar transações', error.stack);
    return {
      success: false,
      message: 'Erro ao consultar transações: ' + error.message,
      data: []
    };
  }
}

function listTransactions(token, filters) {
  try {
    console.log('[TRANSACTIONS] listTransactions chamada com filters:', JSON.stringify(filters));

    if (!validateSession(token)) {
      console.log('[TRANSACTIONS] Sessão inválida');
      return {
        success: false,
        message: 'Sessão inválida ou expirada',
        data: []
      };
    }

    // Parâmetros de paginação
    const page = (filters && filters.page && filters.page > 0) ? parseInt(filters.page) : 1;
    const pageSize = (filters && filters.pageSize && filters.pageSize > 0)
      ? Math.min(parseInt(filters.pageSize), 1000)  // Máximo 1000 por página
      : 50;  // Padrão 50

    console.log('[TRANSACTIONS] Paginação: página', page, 'tamanho', pageSize);
    console.log('[TRANSACTIONS] Obtendo dados da planilha...');
    const data = getAllData('Transactions');
    console.log('[TRANSACTIONS] Dados obtidos:', data.length, 'linhas');

    if (!data || data.length === 0) {
      console.log('[TRANSACTIONS] Nenhuma transação encontrada');
      return {
        success: true,
        message: 'Nenhuma transação encontrada',
        data: [],
        count: 0,
        total: 0,
        page: page,
        pageSize: pageSize,
        totalPages: 0
      };
    }
    
    let transactions = data.map(row => {
  if (!row || row.length < 8) {
    console.warn('[TRANSACTIONS] Linha inválida:', row);
    return null;
  }
  
  // Normaliza data
  let dateStr = row[1];
  if (dateStr instanceof Date) {
    const year = dateStr.getFullYear();
    const month = String(dateStr.getMonth() + 1).padStart(2, '0');
    const day = String(dateStr.getDate()).padStart(2, '0');
    dateStr = `${year}-${month}-${day}`;
  } else if (typeof dateStr === 'string' && dateStr.includes('T')) {
    dateStr = dateStr.split('T')[0];
  }
  
  // Busca attachmentId e novos campos
  let attachmentId = row.length > 8 ? (row[8] || null) : null;
  let paymentMethod = row.length > 9 ? (row[9] || 'Outros') : 'Outros';
  let installments = row.length > 10 ? (parseInt(row[10]) || 1) : 1;
  let installmentNumber = row.length > 11 ? (parseInt(row[11]) || 1) : 1;
  let parentTransactionId = row.length > 12 ? (row[12] || '') : '';
  
  debugLog('[TRANSACTIONS] ID:', row[0], 'AttachmentId:', attachmentId, 'Parcelas:', installmentNumber + '/' + installments);
  
  return {
    id: row[0],
    date: dateStr,
    type: row[2],
    category: row[3],
    description: row[4],
    amount: parseFloat(row[5]) || 0,
    createdAt: row[6],
    updatedAt: row[7],
    attachmentId: attachmentId,
    hasAttachment: attachmentId ? true : false,
    paymentMethod: paymentMethod,
    installments: installments,
    installmentNumber: installmentNumber,
    parentTransactionId: parentTransactionId,
    isInstallment: parentTransactionId ? true : false
  };
}).filter(t => t !== null);
        
    console.log('[TRANSACTIONS] Transações convertidas:', transactions.length);
    
    // Aplica filtros
    if (filters && typeof filters === 'object') {
      const originalCount = transactions.length;
      
      if (filters.startDate) {
        transactions = transactions.filter(t => t.date >= filters.startDate);
        console.log('[TRANSACTIONS] Filtro startDate:', filters.startDate, '- Restantes:', transactions.length);
      }
      
      if (filters.endDate) {
        transactions = transactions.filter(t => t.date <= filters.endDate);
        console.log('[TRANSACTIONS] Filtro endDate:', filters.endDate, '- Restantes:', transactions.length);
      }
      
      if (filters.type && (filters.type === 'debit' || filters.type === 'credit')) {
        transactions = transactions.filter(t => t.type === filters.type);
        console.log('[TRANSACTIONS] Filtro type:', filters.type, '- Restantes:', transactions.length);
      }
      
      if (filters.category) {
        transactions = transactions.filter(t => t.category === filters.category);
        console.log('[TRANSACTIONS] Filtro category:', filters.category, '- Restantes:', transactions.length);
      }

      if (filters.paymentMethod) {
        transactions = transactions.filter(t => (t.paymentMethod || 'Outros') === filters.paymentMethod);
        console.log('[TRANSACTIONS] Filtro paymentMethod:', filters.paymentMethod, '- Restantes:', transactions.length);
      }

      if (filters.search && String(filters.search).trim()) {
        const needle = String(filters.search).trim().toLowerCase();
        transactions = transactions.filter(t => String(t.description || '').toLowerCase().includes(needle));
        console.log('[TRANSACTIONS] Filtro search:', needle, '- Restantes:', transactions.length);
      }

      const minAmount = (filters.minAmount !== undefined && filters.minAmount !== null && filters.minAmount !== '')
        ? parseFloat(filters.minAmount)
        : null;
      const maxAmount = (filters.maxAmount !== undefined && filters.maxAmount !== null && filters.maxAmount !== '')
        ? parseFloat(filters.maxAmount)
        : null;
      if (minAmount !== null && !isNaN(minAmount)) {
        transactions = transactions.filter(t => (parseFloat(t.amount) || 0) >= minAmount);
        console.log('[TRANSACTIONS] Filtro minAmount:', minAmount, '- Restantes:', transactions.length);
      }
      if (maxAmount !== null && !isNaN(maxAmount)) {
        transactions = transactions.filter(t => (parseFloat(t.amount) || 0) <= maxAmount);
        console.log('[TRANSACTIONS] Filtro maxAmount:', maxAmount, '- Restantes:', transactions.length);
      }
      
      console.log('[TRANSACTIONS] Filtros aplicados. De', originalCount, 'para', transactions.length);
    }
    
    // Ordena por data (mais recente primeiro)
    transactions.sort((a, b) => {
      if (a.date > b.date) return -1;
      if (a.date < b.date) return 1;
      return 0;
    });

    // Calcula paginação
    const total = transactions.length;
    const totalPages = Math.ceil(total / pageSize);
    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;

    // Aplica paginação
    const paginatedTransactions = transactions.slice(startIndex, endIndex);

    console.log('[TRANSACTIONS] Total:', total, '| Página', page, 'de', totalPages, '| Retornando', paginatedTransactions.length, 'transações');

    return {
      success: true,
      message: 'Transações listadas com sucesso',
      data: paginatedTransactions,
      count: paginatedTransactions.length,
      total: total,
      page: page,
      pageSize: pageSize,
      totalPages: totalPages
    };
    
  } catch (error) {
    console.error('[TRANSACTIONS] Erro em listTransactions:', error);
    console.error('[TRANSACTIONS] Stack:', error.stack);
    logEvent('TRANSACTIONS', 'ERROR', 'listTransactions', 'Erro ao listar transações', error.stack);

    const page = (filters && filters.page && filters.page > 0) ? parseInt(filters.page) : 1;
    const pageSize = (filters && filters.pageSize && filters.pageSize > 0)
      ? Math.min(parseInt(filters.pageSize), 1000)
      : 50;

    return {
      success: false,
      message: 'Erro ao listar transações: ' + error.message,
      data: [],
      count: 0,
      total: 0,
      page: page,
      pageSize: pageSize,
      totalPages: 0
    };
  }
}

function updateTransaction(token, id, transactionData) {
  try {
    console.log('[TRANSACTIONS] updateTransaction chamada - ID:', id);
    
    if (!validateSession(token)) {
      return {
        success: false,
        message: 'Sessão inválida ou expirada'
      };
    }
    
    if (!id || isNaN(parseInt(id))) {
      return {
        success: false,
        message: 'ID inválido'
      };
    }
    
    const found = findRowById('Transactions', parseInt(id));
    if (!found) {
      logEvent('TRANSACTIONS', 'WARN', 'updateTransaction', 'Transação não encontrada: ID ' + id, '');
      return {
        success: false,
        message: 'Transação não encontrada'
      };
    }
    
    const validation = validateTransactionData(transactionData);
    if (!validation.valid) {
      logEvent('TRANSACTIONS', 'WARN', 'updateTransaction', 'Dados inválidos: ' + validation.message, '');
      return {
        success: false,
        message: validation.message
      };
    }
    
    const sanitized = sanitizeTransactionData(transactionData);
    const createdAt = found.data[6];
    const updatedAt = new Date().toISOString();
    
    // Preserva valores existentes das novas colunas
const existingAttachmentId = found.data.length > 8 ? (found.data[8] || '') : '';
const existingPaymentMethod = found.data.length > 9 ? (found.data[9] || 'Outros') : 'Outros';
const existingInstallments = found.data.length > 10 ? (found.data[10] || 1) : 1;
const existingInstallmentNumber = found.data.length > 11 ? (found.data[11] || 1) : 1;
const existingParentId = found.data.length > 12 ? (found.data[12] || '') : '';

const rowData = [
  parseInt(id),
  sanitized.date,
  sanitized.type,
  sanitized.category,
  sanitized.description,
  sanitized.amount,
  createdAt,
  updatedAt,
  transactionData.attachmentId !== undefined ? transactionData.attachmentId : existingAttachmentId,
  transactionData.paymentMethod !== undefined ? transactionData.paymentMethod : existingPaymentMethod,
  existingInstallments,
  existingInstallmentNumber,
  existingParentId
];
    
    const success = updateRow('Transactions', found.rowIndex, rowData);
    
    if (!success) {
      logEvent('TRANSACTIONS', 'ERROR', 'updateTransaction', 'Erro ao atualizar transação', '');
      return {
        success: false,
        message: 'Erro ao atualizar transação'
      };
    }
    
    logEvent('TRANSACTIONS', 'INFO', 'updateTransaction', 'Transação atualizada: ID ' + id, '');
    bumpUserDataVersion('transactions');
    
    return {
      success: true,
      message: 'Transação atualizada com sucesso',
      data: {
        id: parseInt(id),
        date: sanitized.date,
        type: sanitized.type,
        category: sanitized.category,
        description: sanitized.description,
        amount: sanitized.amount,
        createdAt: createdAt,
        updatedAt: updatedAt
      }
    };
    
  } catch (error) {
    console.error('[TRANSACTIONS] Erro em updateTransaction:', error);
    logEvent('TRANSACTIONS', 'ERROR', 'updateTransaction', 'Erro ao atualizar transação', error.stack);
    return {
      success: false,
      message: 'Erro ao atualizar transação: ' + error.message
    };
  }
}

function deleteTransaction(token, id) {
  try {
    console.log('[TRANSACTIONS] deleteTransaction chamada - ID:', id);
    
    if (!validateSession(token)) {
      return {
        success: false,
        message: 'Sessão inválida ou expirada'
      };
    }
    
    if (!id || isNaN(parseInt(id))) {
      return {
        success: false,
        message: 'ID inválido'
      };
    }
    
    const found = findRowById('Transactions', parseInt(id));
    if (!found) {
      logEvent('TRANSACTIONS', 'WARN', 'deleteTransaction', 'Transação não encontrada: ID ' + id, '');
      return {
        success: false,
        message: 'Transação não encontrada'
      };
    }
    
    const success = deleteRow('Transactions', found.rowIndex);
    
    if (!success) {
      logEvent('TRANSACTIONS', 'ERROR', 'deleteTransaction', 'Erro ao deletar transação', '');
      return {
        success: false,
        message: 'Erro ao deletar transação'
      };
    }
    
    logEvent('TRANSACTIONS', 'INFO', 'deleteTransaction', 'Transação deletada: ID ' + id, '');
    bumpUserDataVersion('transactions');
    
    return {
      success: true,
      message: 'Transação deletada com sucesso'
    };
    
  } catch (error) {
    console.error('[TRANSACTIONS] Erro em deleteTransaction:', error);
    logEvent('TRANSACTIONS', 'ERROR', 'deleteTransaction', 'Erro ao deletar transação', error.stack);
    return {
      success: false,
      message: 'Erro ao deletar transação: ' + error.message
    };
  }
}

function validateTransactionData(data) {
  try {
    if (!data || typeof data !== 'object') {
      return {
        valid: false,
        message: 'Dados inválidos'
      };
    }
    
    if (!data.date || typeof data.date !== 'string') {
      return {
        valid: false,
        message: 'Data é obrigatória'
      };
    }
    
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(data.date)) {
      return {
        valid: false,
        message: 'Data deve estar no formato YYYY-MM-DD'
      };
    }
    
    const dateObj = new Date(data.date);
    if (isNaN(dateObj.getTime())) {
      return {
        valid: false,
        message: 'Data inválida'
      };
    }
    
    if (!data.type || (data.type !== 'debit' && data.type !== 'credit')) {
      return {
        valid: false,
        message: 'Tipo deve ser "debit" ou "credit"'
      };
    }
    
    if (!data.category || typeof data.category !== 'string' || data.category.trim().length === 0) {
      return {
        valid: false,
        message: 'Categoria é obrigatória'
      };
    }
    
    const categoryValid = validateCategory(data.category, data.type);
    if (!categoryValid) {
      return {
        valid: false,
        message: 'Categoria não encontrada ou inativa'
      };
    }
    
    if (!data.description || typeof data.description !== 'string' || data.description.trim().length === 0) {
      return {
        valid: false,
        message: 'Descrição é obrigatória'
      };
    }
    
    if (data.description.trim().length > 500) {
      return {
        valid: false,
        message: 'Descrição deve ter no máximo 500 caracteres'
      };
    }
    
    if (data.amount === undefined || data.amount === null) {
      return {
        valid: false,
        message: 'Valor é obrigatório'
      };
    }
    
    const amount = typeof data.amount === 'string' ? parseFloat(data.amount) : data.amount;
    
    if (isNaN(amount) || !isFinite(amount)) {
      return {
        valid: false,
        message: 'Valor deve ser um número válido'
      };
    }
    
    if (amount <= 0) {
      return {
        valid: false,
        message: 'Valor deve ser maior que zero'
      };
    }
    
    if (amount > 1000000000) {
      return {
        valid: false,
        message: 'Valor excede limite máximo'
      };
    }

    // Validação de parcelas
    if (data.installments !== undefined && data.installments !== null) {
      const installments = parseInt(data.installments);

      if (isNaN(installments) || !Number.isInteger(installments)) {
        return {
          valid: false,
          message: 'Número de parcelas deve ser um número inteiro'
        };
      }

      if (installments < 1) {
        return {
          valid: false,
          message: 'Número de parcelas deve ser no mínimo 1'
        };
      }

      if (installments > MAX_INSTALLMENTS) {
        return {
          valid: false,
          message: `Número de parcelas não pode exceder ${MAX_INSTALLMENTS}`
        };
      }
    }

    return {
      valid: true,
      message: 'OK'
    };
    
  } catch (error) {
    console.error('[TRANSACTIONS] Erro em validateTransactionData:', error);
    return {
      valid: false,
      message: 'Erro na validação: ' + error.message
    };
  }
}

function sanitizeTransactionData(data) {
  return {
    date: data.date.trim(),
    type: data.type.trim().toLowerCase(),
    category: data.category.trim(),
    description: data.description.trim().substring(0, 500),
    amount: parseFloat(typeof data.amount === 'string' ? data.amount : data.amount)
  };
}

function validateCategory(categoryName, type) {
  try {
    const categories = getAllData('Categories');
    
    const found = categories.find(row => 
      row[2] === categoryName &&
      row[1] === type &&
      row[3] === true
    );
    
    return found !== undefined;
    
  } catch (error) {
    console.error('[TRANSACTIONS] Erro ao validar categoria:', error);
    return false;
  }
}

function getTransactionsByPeriod(token, startDate, endDate) {
  return queryTransactions(token, {
    startDate: startDate,
    endDate: endDate
  });
}

function getTransactionsByType(token, type) {
  return queryTransactions(token, {
    type: type
  });
}

function getTransactionsByCategory(token, category) {
  return queryTransactions(token, {
    category: category
  });
}


/**
 * Cria ou atualiza o saldo inicial
 * 
 * @param {string} token - Token de sessão
 * @param {number} amount - Valor do saldo inicial
 * @returns {Object} Resultado da operação
 */
function setInitialBalance(token, amount) {
  try {
    console.log('[TRANSACTIONS] setInitialBalance chamada com amount:', amount);
    
    if (!validateSession(token)) {
      return {
        success: false,
        message: 'Sessão inválida ou expirada'
      };
    }
    
    // Valida o valor
    const initialAmount = parseFloat(amount);
    if (isNaN(initialAmount) || !isFinite(initialAmount)) {
      return {
        success: false,
        message: 'Valor inválido para saldo inicial'
      };
    }
    
    // Verifica se já existe um saldo inicial
    const allData = getAllData('Transactions');
    const existingBalance = allData.find(row => row[3] === 'Saldo Inicial');
    
    if (existingBalance) {
      // Atualiza o saldo inicial existente
      const found = findRowById('Transactions', existingBalance[0]);
      
      if (!found) {
        return {
          success: false,
          message: 'Erro ao localizar saldo inicial'
        };
      }
      
      const now = new Date().toISOString();
      const rowData = [
        existingBalance[0], // ID
        existingBalance[1], // Data original
        'credit',
        'Saldo Inicial',
        'Saldo inicial do sistema',
        initialAmount,
        existingBalance[6], // createdAt original
        now // updatedAt
      ];
      
      const success = updateRow('Transactions', found.rowIndex, rowData);
      
      if (!success) {
        return {
          success: false,
          message: 'Erro ao atualizar saldo inicial'
        };
      }
      
      logEvent('TRANSACTIONS', 'INFO', 'setInitialBalance', 'Saldo inicial atualizado: ' + initialAmount, '');
      bumpUserDataVersion('transactions');
      
      return {
        success: true,
        message: 'Saldo inicial atualizado com sucesso',
        amount: initialAmount
      };
      
    } else {
      // Cria novo saldo inicial
      const id = getNextId('Transactions');
      const now = new Date().toISOString();
      const today = new Date();
      const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      
      const rowData = [
        id,
        dateStr,
        'credit',
        'Saldo Inicial',
        'Saldo inicial do sistema',
        initialAmount,
        now,
        now
      ];
      
      const success = addRow('Transactions', rowData);
      
      if (!success) {
        return {
          success: false,
          message: 'Erro ao criar saldo inicial'
        };
      }
      
      logEvent('TRANSACTIONS', 'INFO', 'setInitialBalance', 'Saldo inicial criado: ' + initialAmount, '');
      bumpUserDataVersion('transactions');
      
      return {
        success: true,
        message: 'Saldo inicial criado com sucesso',
        id: id,
        amount: initialAmount
      };
    }
    
  } catch (error) {
    console.error('[TRANSACTIONS] Erro em setInitialBalance:', error);
    logEvent('TRANSACTIONS', 'ERROR', 'setInitialBalance', 'Erro ao definir saldo inicial', error.stack);
    return {
      success: false,
      message: 'Erro ao definir saldo inicial: ' + error.message
    };
  }
}

/**
 * Obtém o saldo inicial atual
 * 
 * @param {string} token - Token de sessão
 * @returns {Object} Resultado com saldo inicial
 */
function getInitialBalance(token) {
  try {
    if (!validateSession(token)) {
      return {
        success: false,
        message: 'Sessão inválida ou expirada'
      };
    }
    
    const allData = getAllData('Transactions');
    const initialBalance = allData.find(row => row[3] === 'Saldo Inicial');
    
    if (!initialBalance) {
      return {
        success: true,
        message: 'Nenhum saldo inicial configurado',
        amount: 0,
        exists: false
      };
    }
    
    return {
      success: true,
      message: 'Saldo inicial encontrado',
      amount: parseFloat(initialBalance[5]) || 0,
      exists: true,
      date: initialBalance[1]
    };
    
  } catch (error) {
    console.error('[TRANSACTIONS] Erro em getInitialBalance:', error);
    return {
      success: false,
      message: 'Erro ao obter saldo inicial: ' + error.message
    };
  }
}
/**
 * =============================================================================
 * FUNÇÕES DE PARCELAMENTO
 * =============================================================================
 */

/**
 * Cria múltiplas transações parceladas
 * 
 * @param {string} token - Token de sessão
 * @param {Object} transactionData - Dados da transação parcelada
 * @returns {Object} Resultado com IDs das parcelas criadas
 */
function createInstallmentTransactions(token, transactionData) {
  try {
    console.log('[TRANSACTIONS] createInstallmentTransactions chamada');
    
    if (!validateSession(token)) {
      return {
        success: false,
        message: 'Sessão inválida ou expirada'
      };
    }
    
    const validation = validateTransactionData(transactionData);
    if (!validation.valid) {
      return {
        success: false,
        message: validation.message
      };
    }

    const sanitized = sanitizeTransactionData(transactionData);
    const installments = parseInt(transactionData.installments);
    const totalAmount = sanitized.amount;

    // Validar número de parcelas novamente para garantir que chamadas diretas não quebrem o fluxo
    if (!Number.isInteger(installments)) {
      return {
        success: false,
        message: 'Número de parcelas deve ser um número inteiro'
      };
    }

    if (installments < 2 || installments > MAX_INSTALLMENTS) {
      return {
        success: false,
        message: `Número de parcelas deve estar entre 2 e ${MAX_INSTALLMENTS}`
      };
    }

    // Garantir que o limite máximo de transações não será excedido
    const currentCount = getDataRowCount('Transactions');
    if (currentCount + installments > MAX_TRANSACTIONS) {
      const availableSlots = Math.max(MAX_TRANSACTIONS - currentCount, 0);
      return {
        success: false,
        message: `Limite máximo de ${MAX_TRANSACTIONS} transações atingido. Restam ${availableSlots} vagas disponíveis.`
      };
    }
    
    // Gerar ID pai para agrupar parcelas
    const parentId = Utilities.getUuid();
    const now = new Date().toISOString();

    // Calcular valores em centavos para evitar erros de ponto flutuante
    const totalCents = Math.round(totalAmount * 100);
    const installmentCents = Math.floor(totalCents / installments);
    const lastInstallmentCents = totalCents - (installmentCents * (installments - 1));

    const createdIds = [];
    const batchData = [];

    // Preparar dados de todas as parcelas para inserção em batch
    for (let i = 1; i <= installments; i++) {
      const id = getNextId('Transactions');
      const installmentDate = calculateInstallmentDate(sanitized.date, i - 1);
      const amountCents = (i === installments) ? lastInstallmentCents : installmentCents;
      const amount = amountCents / 100; // Converte de volta para reais

      const rowData = [
        id,
        installmentDate,
        sanitized.type,
        sanitized.category,
        `${sanitized.description} (${i}/${installments})`,
        amount,
        now,
        now,
        transactionData.attachmentId || '',
        transactionData.paymentMethod || 'Crédito parcelado',
        installments,
        i,
        parentId
      ];

      batchData.push(rowData);
      createdIds.push(id);
    }

    // Inserir todas as parcelas de uma vez (operação em batch)
    try {
      const sheet = getSheet('Transactions');
      if (!sheet) {
        throw new Error('Planilha Transactions não encontrada');
      }

      const lastRow = sheet.getLastRow();
      const numColumns = batchData[0].length;

      // Insere todas as linhas de uma vez
      sheet.getRange(lastRow + 1, 1, installments, numColumns).setValues(batchData);

      console.log('[TRANSACTIONS] Batch insert concluído:', installments, 'parcelas');
    } catch (batchError) {
      console.error('[TRANSACTIONS] Erro no batch insert:', batchError);
      logEvent('TRANSACTIONS', 'ERROR', 'createInstallmentTransactions', 'Erro no batch insert', batchError.stack);
      return {
        success: false,
        message: 'Erro ao criar parcelas: ' + batchError.message
      };
    }
    
    console.log('[TRANSACTIONS] Parcelas criadas com sucesso:', installments);
    logEvent('TRANSACTIONS', 'INFO', 'createInstallmentTransactions', installments + ' parcelas criadas (parent: ' + parentId + ')', '');
    bumpUserDataVersion('transactions');
    
    // Invalidar cache após criar parcelas
    invalidateCache('transactions_all');
    invalidateCache('transactions_recent');

    return {
      success: true,
      message: installments + ' parcelas criadas com sucesso',
      parentId: parentId,
      installmentIds: createdIds,
      totalAmount: totalAmount,
      installmentAmount: installmentCents / 100
    };
    
  } catch (error) {
    console.error('[TRANSACTIONS] Erro em createInstallmentTransactions:', error);
    logEvent('TRANSACTIONS', 'ERROR', 'createInstallmentTransactions', 'Erro ao criar parcelas', error.stack);
    return {
      success: false,
      message: 'Erro ao criar parcelas: ' + error.message
    };
  }
}

/**
 * Calcula data da parcela (incrementa meses) - CORRIGIDO para fim de mês
 *
 * @param {string} baseDate - Data base no formato YYYY-MM-DD
 * @param {number} monthsToAdd - Número de meses a adicionar
 * @returns {string} Data calculada no formato YYYY-MM-DD
 */
function calculateInstallmentDate(baseDate, monthsToAdd) {
  const date = new Date(baseDate);

  // Usa função addMonths que resolve bug de fim de mês
  const newDate = addMonths(date, monthsToAdd);

  const year = newDate.getFullYear();
  const month = String(newDate.getMonth() + 1).padStart(2, '0');
  const day = String(newDate.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

/**
 * Busca todas as parcelas de um grupo
 * 
 * @param {string} token - Token de sessão
 * @param {string} parentId - ID da transação pai
 * @returns {Object} Lista de parcelas do grupo
 */
function getInstallmentGroup(token, parentId) {
  try {
    console.log('[TRANSACTIONS] getInstallmentGroup chamada - parentId:', parentId);
    
    if (!validateSession(token)) {
      return {
        success: false,
        message: 'Sessão inválida ou expirada',
        data: []
      };
    }
    
    if (!parentId || parentId.trim() === '') {
      return {
        success: false,
        message: 'ID pai inválido',
        data: []
      };
    }
    
    const allData = getAllData('Transactions');
    const installments = [];
    
    allData.forEach(row => {
      if (row.length > 12 && row[12] === parentId) {
        // Normaliza data
        let dateStr = row[1];
        if (dateStr instanceof Date) {
          const year = dateStr.getFullYear();
          const month = String(dateStr.getMonth() + 1).padStart(2, '0');
          const day = String(dateStr.getDate()).padStart(2, '0');
          dateStr = `${year}-${month}-${day}`;
        }
        
        installments.push({
          id: row[0],
          date: dateStr,
          description: row[4],
          amount: parseFloat(row[5]) || 0,
          installmentNumber: parseInt(row[11]) || 1,
          installments: parseInt(row[10]) || 1,
          paymentMethod: row[9] || 'Outros'
        });
      }
    });
    
    // Ordena por número da parcela
    installments.sort((a, b) => a.installmentNumber - b.installmentNumber);
    
    console.log('[TRANSACTIONS] Parcelas encontradas:', installments.length);
    
    return {
      success: true,
      message: installments.length + ' parcelas encontradas',
      data: installments,
      count: installments.length
    };
    
  } catch (error) {
    console.error('[TRANSACTIONS] Erro em getInstallmentGroup:', error);
    logEvent('TRANSACTIONS', 'ERROR', 'getInstallmentGroup', 'Erro ao buscar grupo de parcelas', error.stack);
    return {
      success: false,
      message: 'Erro ao buscar parcelas: ' + error.message,
      data: []
    };
  }
}

/**
 * Exclui todas as parcelas de um grupo
 * 
 * @param {string} token - Token de sessão
 * @param {string} parentId - ID da transação pai
 * @returns {Object} Resultado da operação
 */
function deleteInstallmentGroup(token, parentId) {
  try {
    console.log('[TRANSACTIONS] deleteInstallmentGroup chamada - parentId:', parentId);
    
    if (!validateSession(token)) {
      return {
        success: false,
        message: 'Sessão inválida ou expirada'
      };
    }
    
    if (!parentId || parentId.trim() === '') {
      return {
        success: false,
        message: 'ID pai inválido'
      };
    }
    
    const allData = getAllData('Transactions');
    const idsToDelete = [];
    
    // Coleta IDs das parcelas
    allData.forEach(row => {
      if (row.length > 12 && row[12] === parentId) {
        idsToDelete.push(row[0]);
      }
    });
    
    if (idsToDelete.length === 0) {
      return {
        success: false,
        message: 'Nenhuma parcela encontrada'
      };
    }
    
    // Deleta cada parcela
    let deletedCount = 0;
    idsToDelete.forEach(id => {
      const found = findRowById('Transactions', id);
      if (found) {
        const success = deleteRow('Transactions', found.rowIndex);
        if (success) {
          deletedCount++;
        }
      }
    });
    
    console.log('[TRANSACTIONS] Parcelas deletadas:', deletedCount);
    logEvent('TRANSACTIONS', 'INFO', 'deleteInstallmentGroup', deletedCount + ' parcelas deletadas (parent: ' + parentId + ')', '');
    bumpUserDataVersion('transactions');
    
    return {
      success: true,
      message: deletedCount + ' parcelas deletadas com sucesso',
      deletedCount: deletedCount
    };
    
  } catch (error) {
    console.error('[TRANSACTIONS] Erro em deleteInstallmentGroup:', error);
    logEvent('TRANSACTIONS', 'ERROR', 'deleteInstallmentGroup', 'Erro ao deletar grupo', error.stack);
    return {
      success: false,
      message: 'Erro ao deletar parcelas: ' + error.message
    };
  }
}

/**
 * Valida dados de transação parcelada
 * 
 * @param {Object} data - Dados da transação
 * @returns {Object} Resultado da validação
 */
function validateInstallmentData(data) {
  const basicValidation = validateTransactionData(data);
  if (!basicValidation.valid) {
    return basicValidation;
  }
  
  if (!data.installments) {
    return {
      valid: false,
      message: 'Número de parcelas é obrigatório'
    };
  }
  
  const installments = parseInt(data.installments);
  if (isNaN(installments) || installments < 2 || installments > 60) {
    return {
      valid: false,
      message: 'Número de parcelas deve estar entre 2 e 60'
    };
  }
  
  if (!data.paymentMethod) {
    return {
      valid: false,
      message: 'Forma de pagamento é obrigatória para transações parceladas'
    };
  }
  
  const validPaymentMethods = [
    'Dinheiro', 'Débito', 'Crédito à vista', 'Crédito parcelado',
    'PIX', 'Boleto', 'Transferência', 'Outros'
  ];
  
  if (!validPaymentMethods.includes(data.paymentMethod)) {
    return {
      valid: false,
      message: 'Forma de pagamento inválida'
    };
  }
  
  return {
    valid: true,
    message: 'OK'
  };
}
