function verificarSenha() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Settings');
  const data = sheet.getDataRange().getValues();
  
  console.log('Dados da aba Settings:');
  for (let i = 0; i < data.length; i++) {
    console.log(data[i]);
  }
}

function verificarSetup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // Verifica abas
  const abas = ['Transactions', 'Categories', 'Settings', 'Logs'];
  abas.forEach(aba => {
    const sheet = ss.getSheetByName(aba);
    if (sheet) {
      Logger.log('✅ Aba ' + aba + ' existe');
    } else {
      Logger.log('❌ Aba ' + aba + ' NÃO existe - Execute setup()');
    }
  });
  
  // Verifica senha
  const settings = ss.getSheetByName('Settings');
  if (settings) {
    const data = settings.getDataRange().getValues();
    const temSenha = data.some(row => row[0] === 'password_hash');
    if (temSenha) {
      Logger.log('✅ Senha configurada');
    } else {
      Logger.log('❌ Senha NÃO configurada - Execute generatePasswordHash("sua_senha")');
    }
  }
  
  // Conta transações
  const txSheet = ss.getSheetByName('Transactions');
  if (txSheet) {
    const txCount = txSheet.getLastRow() - 1;
    Logger.log('📊 Total de transações: ' + txCount);
  }
  
  // Conta categorias
  const catSheet = ss.getSheetByName('Categories');
  if (catSheet) {
    const catCount = catSheet.getLastRow() - 1;
    Logger.log('🏷️ Total de categorias: ' + catCount);
  }
}


function testarSistemaCompleto() {
  console.log('========== TESTE COMPLETO ==========');
  
  // 1. Login
  console.log('\n1. TESTANDO LOGIN...');
  const loginResult = login('admin123');
  console.log('Login result:', JSON.stringify(loginResult));
  
  if (!loginResult || !loginResult.success) {
    console.error('❌ LOGIN FALHOU!');
    return;
  }
  
  const token = loginResult.token;
  console.log('✅ Token obtido:', token);
  
  // 2. Listar Transações
  console.log('\n2. TESTANDO LISTAR TRANSAÇÕES...');
  const txResult = queryTransactions(token, {});
  console.log('Transactions result:', JSON.stringify(txResult));
  
  if (!txResult) {
    console.error('❌ listTransactions retornou NULL!');
  } else if (!txResult.success) {
    console.error('❌ listTransactions falhou:', txResult.message);
  } else {
    console.log('✅ Transações:', txResult.count);
  }
  
  // 3. Dashboard
  console.log('\n3. TESTANDO DASHBOARD...');
  const dashResult = getDashboardData(token);
  console.log('Dashboard result:', JSON.stringify(dashResult));
  
  if (!dashResult) {
    console.error('❌ getDashboardData retornou NULL!');
  } else if (!dashResult.success) {
    console.error('❌ getDashboardData falhou:', dashResult.message);
  } else {
    console.log('✅ Dashboard carregado');
  }
  
  console.log('\n========== FIM DO TESTE ==========');
}

function verificarEstruturaTransactions() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Transactions');
  
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  
  Logger.log('=== CABEÇALHOS ===');
  headers.forEach((header, index) => {
    Logger.log(`Coluna ${index}: ${header}`);
  });
  
  Logger.log('\n=== DADOS DA LINHA 6 (ifood) ===');
  const row6 = sheet.getRange(6, 1, 1, sheet.getLastColumn()).getValues()[0];
  row6.forEach((value, index) => {
    Logger.log(`Coluna ${index} (${headers[index]}): ${value}`);
  });
}
function adicionarColunaAnexo() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Transactions');
  
  if (!sheet) {
    Logger.log('Erro: Aba Transactions não encontrada');
    return;
  }
  
  // Pega o cabeçalho atual
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  
  // Verifica se a coluna já existe
  if (headers.includes('attachmentId')) {
    Logger.log('Coluna attachmentId já existe');
    return;
  }
  
  // Adiciona nova coluna no final
  const newColumn = sheet.getLastColumn() + 1;
  sheet.getRange(1, newColumn).setValue('attachmentId');
  
  Logger.log('Coluna attachmentId adicionada na posição ' + newColumn);
  
}

function testarEstrutura() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Transactions');
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  
  Logger.log('Total de colunas:', headers.length);
  Logger.log('Cabeçalhos:', headers);
  
  // Procura índice de attachmentId
  const attachmentIndex = headers.indexOf('attachmentId');
  Logger.log('Índice de attachmentId:', attachmentIndex);
}

function testarPreviewImportacaoExtratoCsv() {
  const loginResult = login('admin123');
  if (!loginResult || !loginResult.success) {
    Logger.log('Login falhou');
    return;
  }

  const token = loginResult.token;

  const csv = [
    'Data;Descrição;Valor',
    '01/12/2025;Supermercado;-123,45',
    '02/12/2025;Salário;3500,00'
  ].join('\n');

  const analysis = statementImportAnalyze(token, csv);
  Logger.log('Analyze: ' + JSON.stringify(analysis));

  const options = {
    delimiter: ';',
    hasHeader: true,
    mapping: { dateCol: 0, descriptionCol: 1, amountCol: 2 },
    defaults: { debitCategory: 'A revisar', creditCategory: 'A revisar', paymentMethod: 'Outros' },
    source: 'Teste',
    account: 'Conta Teste'
  };

  const preview = statementImportPreview(token, csv, options);
  Logger.log('Preview: ' + JSON.stringify(preview));
}
