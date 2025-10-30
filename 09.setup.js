/**
 * =============================================================================
 * SETUP.GS - Módulo de Configuração Inicial do Sistema
 * =============================================================================
 * 
 * Responsável por criar a estrutura inicial do sistema no Google Sheets:
 * - Criar abas necessárias (Transactions, Categories, Settings, Logs)
 * - Definir cabeçalhos das colunas
 * - Configurar formatação básica
 * - Popular categorias padrão
 * - Configurar senha inicial
 * 
 * IMPORTANTE: Esta função é IDEMPOTENTE - pode ser executada múltiplas vezes
 * sem causar duplicação de dados ou erros.
 * =============================================================================
 */

/**
 * Função principal de setup do sistema
 * Cria toda a estrutura necessária no Google Sheets
 * 
 * @returns {Object} Objeto com status da operação
 */
function setup() {
  try {
    // Obtém a planilha ativa
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    
    // Log de início da operação
    console.log('[SETUP] Iniciando configuração do sistema...');
    
    // 1. Criar aba Transactions
    createTransactionsSheet(ss);
    
    // 2. Criar aba Categories
    createCategoriesSheet(ss);
    
    // 3. Criar aba Settings
    createSettingsSheet(ss);
    
    // 4. Criar aba Logs
    createLogsSheet(ss);
    
    // 5. Popular categorias padrão
    populateDefaultCategories(ss);
    
    // 6. Configurar senha inicial (se não existir)
    setupInitialPassword(ss);
    
    // Log de sucesso
    console.log('[SETUP] Configuração concluída com sucesso!');
    
    // Retorna mensagem de sucesso
    return {
      success: true,
      message: 'Sistema configurado com sucesso! Execute a função generatePasswordHash() para criar sua senha.'
    };
    
  } catch (error) {
    // Log de erro
    console.error('[SETUP] Erro durante configuração:', error);
    
    // Retorna erro
    return {
      success: false,
      message: 'Erro ao configurar sistema: ' + error.message
    };
  }
}

/**
 * Cria a aba Transactions com estrutura e formatação
 * 
 * @param {SpreadsheetApp.Spreadsheet} ss - Planilha ativa
 */
/**
 * Cria a aba Transactions com estrutura e formatação
 * 
 * @param {SpreadsheetApp.Spreadsheet} ss - Planilha ativa
 */
function createTransactionsSheet(ss) {
  const sheetName = 'Transactions';
  let sheet = ss.getSheetByName(sheetName);
  
  // Se a aba não existe, cria
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    console.log('[SETUP] Aba Transactions criada');
  } else {
    console.log('[SETUP] Aba Transactions já existe');
  }
  
  // Define cabeçalhos
  const headers = [
    'id',                    // ID único da transação (auto-incremento)
    'date',                  // Data da transação (YYYY-MM-DD)
    'type',                  // Tipo: debit ou credit
    'category',              // Categoria da transação
    'description',           // Descrição detalhada
    'amount',                // Valor (sempre positivo)
    'createdAt',             // Data/hora de criação
    'updatedAt',             // Data/hora da última atualização
    'attachmentId',          // ID do anexo (se houver)
    'paymentMethod',         // Forma de pagamento (Dinheiro, Débito, Crédito, PIX, etc.)
    'installments',          // Número total de parcelas (1 para à vista)
    'installmentNumber',     // Número da parcela atual (1/12, 2/12, etc.)
    'parentTransactionId'    // ID da transação pai (para agrupar parcelas)
  ];
  
  // Verifica se cabeçalhos já existem (idempotência)
  const firstRow = sheet.getRange(1, 1, 1, headers.length).getValues()[0];
  const headersExist = firstRow[0] === 'id';
  
  if (!headersExist) {
    // Escreve cabeçalhos
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    
    // Formatação dos cabeçalhos
    sheet.getRange(1, 1, 1, headers.length)
      .setBackground('#4285f4')
      .setFontColor('#ffffff')
      .setFontWeight('bold')
      .setHorizontalAlignment('center');
    
    // Congela primeira linha
    sheet.setFrozenRows(1);
    
    // Ajusta largura das colunas
    sheet.setColumnWidth(1, 80);    // id
    sheet.setColumnWidth(2, 100);   // date
    sheet.setColumnWidth(3, 80);    // type
    sheet.setColumnWidth(4, 150);   // category
    sheet.setColumnWidth(5, 250);   // description
    sheet.setColumnWidth(6, 100);   // amount
    sheet.setColumnWidth(7, 150);   // createdAt
    sheet.setColumnWidth(8, 150);   // updatedAt
    sheet.setColumnWidth(9, 120);   // attachmentId
    sheet.setColumnWidth(10, 150);  // paymentMethod
    sheet.setColumnWidth(11, 100);  // installments
    sheet.setColumnWidth(12, 120);  // installmentNumber
    sheet.setColumnWidth(13, 180);  // parentTransactionId
    
    console.log('[SETUP] Cabeçalhos da aba Transactions configurados');
  }
}

/**
 * Cria a aba Categories com estrutura e formatação
 * 
 * @param {SpreadsheetApp.Spreadsheet} ss - Planilha ativa
 */
function createCategoriesSheet(ss) {
  const sheetName = 'Categories';
  let sheet = ss.getSheetByName(sheetName);
  
  // Se a aba não existe, cria
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    console.log('[SETUP] Aba Categories criada');
  } else {
    console.log('[SETUP] Aba Categories já existe');
  }
  
  // Define cabeçalhos
  const headers = [
    'id',        // ID único da categoria (auto-incremento)
    'kind',      // Tipo: debit ou credit
    'name',      // Nome da categoria
    'isActive'   // Status: true ou false
  ];
  
  // Verifica se cabeçalhos já existem (idempotência)
  const firstRow = sheet.getRange(1, 1, 1, headers.length).getValues()[0];
  const headersExist = firstRow[0] === 'id';
  
  if (!headersExist) {
    // Escreve cabeçalhos
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    
    // Formatação dos cabeçalhos
    sheet.getRange(1, 1, 1, headers.length)
      .setBackground('#34a853')
      .setFontColor('#ffffff')
      .setFontWeight('bold')
      .setHorizontalAlignment('center');
    
    // Congela primeira linha
    sheet.setFrozenRows(1);
    
    // Ajusta largura das colunas
    sheet.setColumnWidth(1, 80);   // id
    sheet.setColumnWidth(2, 100);  // kind
    sheet.setColumnWidth(3, 200);  // name
    sheet.setColumnWidth(4, 100);  // isActive
    
    console.log('[SETUP] Cabeçalhos da aba Categories configurados');
  }
}

/**
 * Cria a aba Settings para armazenar configurações do sistema
 * 
 * @param {SpreadsheetApp.Spreadsheet} ss - Planilha ativa
 */
function createSettingsSheet(ss) {
  const sheetName = 'Settings';
  let sheet = ss.getSheetByName(sheetName);
  
  // Se a aba não existe, cria
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    console.log('[SETUP] Aba Settings criada');
  } else {
    console.log('[SETUP] Aba Settings já existe');
  }
  
  // Define cabeçalhos
  const headers = [
    'key',    // Chave da configuração
    'value'   // Valor da configuração
  ];
  
  // Verifica se cabeçalhos já existem (idempotência)
  const firstRow = sheet.getRange(1, 1, 1, headers.length).getValues()[0];
  const headersExist = firstRow[0] === 'key';
  
  if (!headersExist) {
    // Escreve cabeçalhos
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    
    // Formatação dos cabeçalhos
    sheet.getRange(1, 1, 1, headers.length)
      .setBackground('#fbbc04')
      .setFontColor('#000000')
      .setFontWeight('bold')
      .setHorizontalAlignment('center');
    
    // Congela primeira linha
    sheet.setFrozenRows(1);
    
    // Ajusta largura das colunas
    sheet.setColumnWidth(1, 200);  // key
    sheet.setColumnWidth(2, 400);  // value
    
    console.log('[SETUP] Cabeçalhos da aba Settings configurados');
  }
}

/**
 * Cria a aba Logs para registro de eventos do sistema
 * 
 * @param {SpreadsheetApp.Spreadsheet} ss - Planilha ativa
 */
function createLogsSheet(ss) {
  const sheetName = 'Logs';
  let sheet = ss.getSheetByName(sheetName);
  
  // Se a aba não existe, cria
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    console.log('[SETUP] Aba Logs criada');
  } else {
    console.log('[SETUP] Aba Logs já existe');
  }
  
  // Define cabeçalhos
  const headers = [
    'ts',        // Timestamp (data/hora do evento)
    'user',      // Usuário que executou a ação
    'module',    // Módulo onde ocorreu o evento
    'level',     // Nível: INFO, WARN, ERROR
    'action',    // Ação executada
    'message',   // Mensagem descritiva
    'stack'      // Stack trace (para erros)
  ];
  
  // Verifica se cabeçalhos já existem (idempotência)
  const firstRow = sheet.getRange(1, 1, 1, headers.length).getValues()[0];
  const headersExist = firstRow[0] === 'ts';
  
  if (!headersExist) {
    // Escreve cabeçalhos
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    
    // Formatação dos cabeçalhos
    sheet.getRange(1, 1, 1, headers.length)
      .setBackground('#ea4335')
      .setFontColor('#ffffff')
      .setFontWeight('bold')
      .setHorizontalAlignment('center');
    
    // Congela primeira linha
    sheet.setFrozenRows(1);
    
    // Ajusta largura das colunas
    sheet.setColumnWidth(1, 150);  // ts
    sheet.setColumnWidth(2, 150);  // user
    sheet.setColumnWidth(3, 100);  // module
    sheet.setColumnWidth(4, 80);   // level
    sheet.setColumnWidth(5, 150);  // action
    sheet.setColumnWidth(6, 300);  // message
    sheet.setColumnWidth(7, 300);  // stack
    
    console.log('[SETUP] Cabeçalhos da aba Logs configurados');
  }
}

/**
 * Popula categorias padrão do sistema
 * Categorias são criadas apenas se não existirem
 * 
 * @param {SpreadsheetApp.Spreadsheet} ss - Planilha ativa
 */
function populateDefaultCategories(ss) {
  const sheet = ss.getSheetByName('Categories');
  
  // Verifica se já existem categorias (idempotência)
  const lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    console.log('[SETUP] Categorias padrão já existem');
    return;
  }
  
  // Categorias padrão de DÉBITO (despesas)
  const defaultDebits = [
    'Alimentação',
    'Transporte',
    'Moradia',
    'Saúde',
    'Educação',
    'Lazer',
    'Vestuário',
    'Serviços',
    'Outros Débitos'
  ];
  
  // Categorias padrão de CRÉDITO (receitas)
  const defaultCredits = [
    'Salário',
    'Freelance',
    'Investimentos',
    'Vendas',
    'Outros Créditos'
  ];
  
  // Array para armazenar todas as categorias
  const categories = [];
  let id = 1;
  
  // Adiciona categorias de débito
  defaultDebits.forEach(name => {
    categories.push([id++, 'debit', name, true]);
  });
  
  // Adiciona categorias de crédito
  defaultCredits.forEach(name => {
    categories.push([id++, 'credit', name, true]);
  });
  
  // Escreve categorias na planilha
  if (categories.length > 0) {
    sheet.getRange(2, 1, categories.length, 4).setValues(categories);
    console.log('[SETUP] ' + categories.length + ' categorias padrão criadas');
  }
}

/**
 * Configura senha inicial do sistema
 * Gera um salt aleatório e cria hash da senha padrão
 * 
 * @param {SpreadsheetApp.Spreadsheet} ss - Planilha ativa
 */
function setupInitialPassword(ss) {
  const sheet = ss.getSheetByName('Settings');
  
  // Verifica se já existe senha configurada (idempotência)
  const data = sheet.getDataRange().getValues();
  const passwordExists = data.some(row => row[0] === 'password_hash');
  
  if (passwordExists) {
    console.log('[SETUP] Senha já está configurada');
    return;
  }
  
  // Gera um salt aleatório (16 caracteres hexadecimais)
  const salt = generateSalt();
  
  // Senha padrão (IMPORTANTE: usuário deve mudar após primeiro acesso)
  const defaultPassword = 'admin123';
  
  // Gera hash da senha com salt
  const passwordHash = hashPassword(defaultPassword, salt);

  // Salva salt e hash NO PROPERTIESSERVICE (seguro)
  const props = PropertiesService.getScriptProperties();
  props.setProperty('password_salt', salt);
  props.setProperty('password_hash', passwordHash);

  console.log('[SETUP] Senha inicial configurada em PropertiesService');
  console.log('[SETUP] Senha padrão temporária: admin123');
  console.log('[SETUP] CRÍTICO: Altere a senha IMEDIATAMENTE após primeiro acesso!');
  console.log('[SETUP] A senha deve ter mínimo 12 caracteres com letras e números');
}

/**
 * Função auxiliar para gerar senha personalizada
 * Execute esta função no Apps Script após o setup inicial
 * 
 * @param {string} newPassword - Nova senha desejada
 */
function generatePasswordHash(newPassword) {
  if (!newPassword || newPassword.trim().length < 12) {
    console.error('[SETUP] Senha deve ter no mínimo 12 caracteres');
    return;
  }

  // Validação de complexidade
  const hasLetters = /[a-zA-Z]/.test(newPassword);
  const hasNumbers = /[0-9]/.test(newPassword);

  if (!hasLetters || !hasNumbers) {
    console.error('[SETUP] Senha deve conter letras e números');
    return;
  }

  // Gera novo salt
  const salt = generateSalt();

  // Gera hash da nova senha
  const passwordHash = hashPassword(newPassword, salt);

  // Atualiza no PropertiesService (seguro)
  const props = PropertiesService.getScriptProperties();
  props.setProperty('password_salt', salt);
  props.setProperty('password_hash', passwordHash);

  console.log('[SETUP] Nova senha configurada com sucesso no PropertiesService');
  console.log('[SETUP] Salt:', salt);
  console.log('[SETUP] Hash:', passwordHash);

  // Remove referências antigas da planilha (se existirem)
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('Settings');
    const data = sheet.getDataRange().getValues();
    let saltRow = -1;
    let hashRow = -1;
  
    // Procura linhas existentes
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === 'password_salt') saltRow = i + 1;
      if (data[i][0] === 'password_hash') hashRow = i + 1;
    }

    // Remove referências antigas da planilha
    if (saltRow > 0) {
      sheet.deleteRow(saltRow);
      console.log('[SETUP] Removida senha antiga da planilha (linha salt)');
    }
    if (hashRow > 0 && hashRow !== saltRow) {
      sheet.deleteRow(hashRow > saltRow ? hashRow - 1 : hashRow);
      console.log('[SETUP] Removida senha antiga da planilha (linha hash)');
    }
  } catch (cleanupError) {
    console.warn('[SETUP] Aviso ao limpar planilha:', cleanupError);
  }
}

/**
 * Gera um salt aleatório para hashing de senha
 * 
 * @returns {string} Salt em formato hexadecimal (32 caracteres)
 */
function generateSalt() {
  const chars = '0123456789abcdef';
  let salt = '';
  for (let i = 0; i < 32; i++) {
    salt += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return salt;
}

/**
 * Gera hash SHA-256 da senha com salt
 * 
 * @param {string} password - Senha em texto plano
 * @param {string} salt - Salt para adicionar à senha
 * @returns {string} Hash SHA-256 em formato hexadecimal
 */
function hashPassword(password, salt) {
  // Combina senha com salt
  const saltedPassword = password + salt;
  
  // Gera hash SHA-256
  const hash = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    saltedPassword,
    Utilities.Charset.UTF_8
  );
  
  // Converte para hexadecimal
  return hash.map(byte => {
    const v = (byte < 0) ? 256 + byte : byte;
    return ('0' + v.toString(16)).slice(-2);
  }).join('');
}