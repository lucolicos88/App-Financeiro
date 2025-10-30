/**
 * RESET.GS - Funções de Reset do Sistema
 */

/**
 * Cria backup da planilha antes de reset
 *
 * @returns {Object} Resultado com ID do backup
 */
function createBackup() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupName = `BACKUP_${ss.getName()}_${timestamp}`;

    // Cria cópia da planilha
    const backup = ss.copy(backupName);
    const backupId = backup.getId();
    const backupUrl = backup.getUrl();

    console.log('[BACKUP] Backup criado:', backupName, 'ID:', backupId);

    return {
      success: true,
      backupId: backupId,
      backupUrl: backupUrl,
      backupName: backupName
    };

  } catch (error) {
    console.error('[BACKUP] Erro ao criar backup:', error);
    return {
      success: false,
      message: 'Erro ao criar backup: ' + error.message
    };
  }
}

/**
 * Reset do sistema com CONFIRMAÇÃO OBRIGATÓRIA e BACKUP AUTOMÁTICO
 *
 * @param {string} token - Token de sessão
 * @param {string} confirmationCode - Código de confirmação (deve ser 'DELETE_ALL_DATA')
 * @returns {Object} Resultado da operação
 */
function resetSystem(token, confirmationCode) {
  try {
    if (!validateSession(token)) {
      return { success: false, message: 'Sessão inválida ou expirada' };
    }

    // VALIDAÇÃO DE CONFIRMAÇÃO (SEGURANÇA)
    if (confirmationCode !== 'DELETE_ALL_DATA') {
      logEvent('SYSTEM', 'WARN', 'resetSystem', 'Tentativa de reset sem confirmação válida', '');
      return {
        success: false,
        message: 'Confirmação necessária. Forneça o código: DELETE_ALL_DATA'
      };
    }

    // CRIAR BACKUP AUTOMÁTICO ANTES DE DELETAR
    console.log('[RESET] Criando backup antes de reset...');
    const backup = createBackup();

    if (!backup.success) {
      return {
        success: false,
        message: 'ABORTADO: Não foi possível criar backup. Reset cancelado para segurança.'
      };
    }

    logEvent('SYSTEM', 'WARN', 'resetSystem', `Iniciando reset do sistema (Backup: ${backup.backupId})`, '');
    
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
      message: `Sistema resetado com sucesso. Backup salvo em: ${backup.backupName}`,
      backupUrl: backup.backupUrl,
      backupId: backup.backupId
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