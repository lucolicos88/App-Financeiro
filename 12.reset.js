/**
 * RESET.GS - Funções de Reset do Sistema
 */

function resetSystem(token) {
  try {
    if (!validateSession(token)) {
      return { success: false, message: 'Sessão inválida ou expirada' };
    }
    
    logEvent('SYSTEM', 'WARN', 'resetSystem', 'Iniciando reset do sistema', '');
    
    // Limpar Transactions
    const txSheet = getSheet('Transactions');
    if (txSheet && txSheet.getLastRow() > 1) {
      txSheet.deleteRows(2, txSheet.getLastRow() - 1);
    }
    
    // Limpar Categories (manter algumas padrões)
    const catSheet = getSheet('Categories');
    if (catSheet && catSheet.getLastRow() > 1) {
      catSheet.deleteRows(2, catSheet.getLastRow() - 1);
    }
    
    // Recriar categorias padrões
    createDefaultCategories();
    
    // Limpar Settings (manter apenas password e salt)
    const settingsSheet = getSheet('Settings');
    if (settingsSheet) {
      const data = settingsSheet.getDataRange().getValues();
      
      // Manter apenas linhas de senha
      for (let i = data.length - 1; i >= 1; i--) {
        const key = data[i][0];
        if (key !== 'password_hash' && key !== 'password_salt') {
          settingsSheet.deleteRow(i + 1);
        }
      }
    }
    
    // Limpar Logs
    const logsSheet = getSheet('Logs');
    if (logsSheet && logsSheet.getLastRow() > 1) {
      logsSheet.deleteRows(2, logsSheet.getLastRow() - 1);
    }
    
    logEvent('SYSTEM', 'INFO', 'resetSystem', 'Reset do sistema concluído', '');
    
    return {
      success: true,
      message: 'Sistema resetado com sucesso. Todas as transações e configurações foram apagadas.'
    };
    
  } catch (error) {
    logEvent('SYSTEM', 'ERROR', 'resetSystem', error.message, error.stack);
    return { success: false, message: 'Erro ao resetar sistema: ' + error.message };
  }
}

function createDefaultCategories() {
  // Categorias de Crédito
  const creditCategories = [
    'Salário',
    'Freelance',
    'Investimentos',
    'Outros'
  ];
  
  // Categorias de Débito
  const debitCategories = [
    'Alimentação',
    'Transporte',
    'Saúde',
    'Educação',
    'Moradia',
    'Lazer',
    'Outros'
  ];
  
  const sheet = getSheet('Categories');
  let id = 1;
  
  creditCategories.forEach(name => {
    sheet.appendRow([id++, 'credit', name, true]);
  });
  
  debitCategories.forEach(name => {
    sheet.appendRow([id++, 'debit', name, true]);
  });
}

function countSystemData(token) {
  try {
    if (!validateSession(token)) {
      return { success: false, message: 'Sessão inválida' };
    }
    
    const txCount = getAllData('Transactions').length;
    const catCount = getAllData('Categories').length;
    const logsCount = getAllData('Logs').length;
    
    return {
      success: true,
      data: {
        transactions: txCount,
        categories: catCount,
        logs: logsCount
      }
    };
    
  } catch (error) {
    return { success: false, message: 'Erro ao contar dados' };
  }
}