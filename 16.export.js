/**
 * =============================================================================
 * EXPORT.GS - Módulo de Exportação de Dados
 * =============================================================================
 *
 * Responsável por exportar dados em diferentes formatos:
 * - Excel (XLSX) via Google Sheets
 * - CSV
 * - JSON
 * - PDF (relatórios)
 *
 * Versão: 2.4.0
 * =============================================================================
 */

/**
 * Exporta transações para CSV
 *
 * @param {string} token - Token de sessão
 * @param {Object} filters - Filtros (startDate, endDate, type, category)
 * @returns {Object} Resultado com dados CSV
 */
function exportToCSV(token, filters) {
  try {
    console.log('[EXPORT] exportToCSV chamada');

    if (!validateSession(token)) {
      return {
        success: false,
        message: 'Sessão inválida ou expirada'
      };
    }

    const transactionsResult = queryTransactions(token, filters || {});
    if (!transactionsResult.success) {
      return transactionsResult;
    }

    const transactions = transactionsResult.data;

    // Criar CSV
    let csv = 'Data,Descrição,Categoria,Tipo,Valor,Forma de Pagamento,Parcela,Observações\n';

    transactions.forEach(t => {
      const row = [
        t.date,
        `"${t.description.replace(/"/g, '""')}"`, // Escape quotes
        `"${t.category}"`,
        t.type === 'credit' ? 'Entrada' : 'Saída',
        t.amount.toFixed(2).replace('.', ','),
        `"${t.paymentMethod || ''}"`,
        t.isInstallment ? `${t.installmentNumber}/${t.installments}` : '',
        `"${(t.notes || '').replace(/"/g, '""')}"`
      ];
      csv += row.join(',') + '\n';
    });

    console.log('[EXPORT] CSV gerado,', transactions.length, 'linhas');

    return {
      success: true,
      message: 'CSV gerado com sucesso',
      data: {
        csv: csv,
        filename: `transacoes_${new Date().toISOString().split('T')[0]}.csv`,
        count: transactions.length
      }
    };

  } catch (error) {
    console.error('[EXPORT] Erro em exportToCSV:', error);
    logEvent('EXPORT', 'ERROR', 'exportToCSV', 'Erro ao exportar CSV', error.stack);
    return {
      success: false,
      message: 'Erro ao exportar CSV: ' + error.message
    };
  }
}

/**
 * Exporta transações para JSON
 *
 * @param {string} token - Token de sessão
 * @param {Object} filters - Filtros
 * @returns {Object} Resultado com JSON
 */
function exportToJSON(token, filters) {
  try {
    console.log('[EXPORT] exportToJSON chamada');

    if (!validateSession(token)) {
      return {
        success: false,
        message: 'Sessão inválida ou expirada'
      };
    }

    const transactionsResult = queryTransactions(token, filters || {});
    if (!transactionsResult.success) {
      return transactionsResult;
    }

    const transactions = transactionsResult.data;

    const jsonData = {
      exportDate: new Date().toISOString(),
      filters: filters || {},
      count: transactions.length,
      transactions: transactions
    };

    console.log('[EXPORT] JSON gerado,', transactions.length, 'transações');

    return {
      success: true,
      message: 'JSON gerado com sucesso',
      data: {
        json: JSON.stringify(jsonData, null, 2),
        filename: `transacoes_${new Date().toISOString().split('T')[0]}.json`,
        count: transactions.length
      }
    };

  } catch (error) {
    console.error('[EXPORT] Erro em exportToJSON:', error);
    return {
      success: false,
      message: 'Erro ao exportar JSON: ' + error.message
    };
  }
}

/**
 * Cria spreadsheet temporário para download Excel
 *
 * @param {string} token - Token de sessão
 * @param {Object} filters - Filtros
 * @returns {Object} URL do arquivo
 */
function exportToExcel(token, filters) {
  try {
    console.log('[EXPORT] exportToExcel chamada');

    if (!validateSession(token)) {
      return {
        success: false,
        message: 'Sessão inválida ou expirada'
      };
    }

    const transactionsResult = queryTransactions(token, filters || {});
    if (!transactionsResult.success) {
      return transactionsResult;
    }

    const transactions = transactionsResult.data;

    // Criar novo spreadsheet temporário
    const ss = SpreadsheetApp.create(`Exportação_${new Date().toISOString().split('T')[0]}`);
    const sheet = ss.getActiveSheet();
    sheet.setName('Transações');

    // Cabeçalhos
    const headers = ['Data', 'Descrição', 'Categoria', 'Tipo', 'Valor', 'Forma de Pagamento', 'Parcela', 'Observações'];
    sheet.appendRow(headers);

    // Formatar cabeçalho
    const headerRange = sheet.getRange(1, 1, 1, headers.length);
    headerRange.setBackground('#6366f1');
    headerRange.setFontColor('#ffffff');
    headerRange.setFontWeight('bold');

    // Adicionar dados
    transactions.forEach(t => {
      sheet.appendRow([
        t.date,
        t.description,
        t.category,
        t.type === 'credit' ? 'Entrada' : 'Saída',
        t.amount,
        t.paymentMethod || '',
        t.isInstallment ? `${t.installmentNumber}/${t.installments}` : '',
        t.notes || ''
      ]);
    });

    // Formatar coluna de valor como moeda
    const valueRange = sheet.getRange(2, 5, transactions.length, 1);
    valueRange.setNumberFormat('R$ #,##0.00');

    // Auto-resize columns
    sheet.autoResizeColumns(1, headers.length);

    // Obter URL do arquivo
    const fileId = ss.getId();
    const url = `https://docs.google.com/spreadsheets/d/${fileId}/export?format=xlsx`;

    console.log('[EXPORT] Excel criado, ID:', fileId);

    // Mover para pasta temporária ou compartilhar
    // (opcional: criar pasta de exports)

    return {
      success: true,
      message: 'Excel gerado com sucesso',
      data: {
        url: url,
        fileId: fileId,
        spreadsheetUrl: ss.getUrl(),
        count: transactions.length
      }
    };

  } catch (error) {
    console.error('[EXPORT] Erro em exportToExcel:', error);
    logEvent('EXPORT', 'ERROR', 'exportToExcel', 'Erro ao exportar Excel', error.stack);
    return {
      success: false,
      message: 'Erro ao exportar Excel: ' + error.message
    };
  }
}

/**
 * Backup completo dos dados para Google Drive
 *
 * @param {string} token - Token de sessão
 * @returns {Object} Resultado
 */
function createBackup(token) {
  try {
    console.log('[EXPORT] createBackup chamada');

    if (!validateSession(token)) {
      return {
        success: false,
        message: 'Sessão inválida ou expirada'
      };
    }

    // Obter spreadsheet atual
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const ssId = ss.getId();

    // Criar cópia
    const timestamp = Utilities.formatDate(new Date(), 'America/Sao_Paulo', 'yyyy-MM-dd_HHmmss');
    const backupName = `Backup_Financeiro_${timestamp}`;

    const file = DriveApp.getFileById(ssId);
    const backup = file.makeCopy(backupName);

    // Mover para pasta de backups (criar se não existir)
    const folders = DriveApp.getFoldersByName('Backups Financeiro');
    let backupFolder;

    if (folders.hasNext()) {
      backupFolder = folders.next();
    } else {
      backupFolder = DriveApp.createFolder('Backups Financeiro');
    }

    backup.moveTo(backupFolder);

    console.log('[EXPORT] Backup criado:', backup.getId());

    // Atualizar data do último backup nas configurações
    updateUserSettings(token, {
      lastBackupDate: new Date().toISOString()
    });

    return {
      success: true,
      message: 'Backup criado com sucesso',
      data: {
        fileId: backup.getId(),
        fileName: backupName,
        url: backup.getUrl(),
        createdAt: new Date().toISOString()
      }
    };

  } catch (error) {
    console.error('[EXPORT] Erro em createBackup:', error);
    logEvent('EXPORT', 'ERROR', 'createBackup', 'Erro ao criar backup', error.stack);
    return {
      success: false,
      message: 'Erro ao criar backup: ' + error.message
    };
  }
}

/**
 * Lista backups existentes
 *
 * @param {string} token - Token de sessão
 * @returns {Object} Lista de backups
 */
function listBackups(token) {
  try {
    console.log('[EXPORT] listBackups chamada');

    if (!validateSession(token)) {
      return {
        success: false,
        message: 'Sessão inválida ou expirada'
      };
    }

    const folders = DriveApp.getFoldersByName('Backups Financeiro');

    if (!folders.hasNext()) {
      return {
        success: true,
        message: 'Nenhum backup encontrado',
        data: []
      };
    }

    const backupFolder = folders.next();
    const files = backupFolder.getFiles();
    const backups = [];

    while (files.hasNext()) {
      const file = files.next();
      backups.push({
        id: file.getId(),
        name: file.getName(),
        createdAt: file.getDateCreated().toISOString(),
        size: file.getSize(),
        url: file.getUrl()
      });
    }

    // Ordenar por data (mais recente primeiro)
    backups.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    console.log('[EXPORT] Backups encontrados:', backups.length);

    return {
      success: true,
      message: 'Backups listados com sucesso',
      data: backups,
      count: backups.length
    };

  } catch (error) {
    console.error('[EXPORT] Erro em listBackups:', error);
    return {
      success: false,
      message: 'Erro ao listar backups: ' + error.message
    };
  }
}

/**
 * Configura backup automático
 */
function setupAutoBackup() {
  try {
    console.log('[EXPORT] Configurando backup automático');

    // Remover triggers existentes
    const triggers = ScriptApp.getProjectTriggers();
    triggers.forEach(trigger => {
      if (trigger.getHandlerFunction() === 'runAutoBackup') {
        ScriptApp.deleteTrigger(trigger);
      }
    });

    // Criar trigger semanal (todo domingo às 2h)
    ScriptApp.newTrigger('runAutoBackup')
      .timeBased()
      .onWeekDay(ScriptApp.WeekDay.SUNDAY)
      .atHour(2)
      .create();

    console.log('[EXPORT] Backup automático configurado');

  } catch (error) {
    console.error('[EXPORT] Erro ao configurar backup automático:', error);
  }
}

/**
 * Executa backup automático (chamado pelo trigger)
 */
function runAutoBackup() {
  try {
    console.log('[EXPORT] runAutoBackup (trigger) chamada');

    // Criar backup sem token (automático)
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const ssId = ss.getId();

    const timestamp = Utilities.formatDate(new Date(), 'America/Sao_Paulo', 'yyyy-MM-dd_HHmmss');
    const backupName = `Backup_Auto_${timestamp}`;

    const file = DriveApp.getFileById(ssId);
    const backup = file.makeCopy(backupName);

    const folders = DriveApp.getFoldersByName('Backups Financeiro');
    let backupFolder;

    if (folders.hasNext()) {
      backupFolder = folders.next();
    } else {
      backupFolder = DriveApp.createFolder('Backups Financeiro');
    }

    backup.moveTo(backupFolder);

    console.log('[EXPORT] Backup automático criado:', backup.getId());

    // Limpar backups antigos (manter apenas últimos 10)
    cleanOldBackups(backupFolder);

  } catch (error) {
    console.error('[EXPORT] Erro em runAutoBackup:', error);
    logEvent('EXPORT', 'ERROR', 'runAutoBackup', 'Erro no backup automático', error.stack);
  }
}

/**
 * Remove backups antigos
 */
function cleanOldBackups(folder) {
  try {
    const files = folder.getFiles();
    const backups = [];

    while (files.hasNext()) {
      const file = files.next();
      backups.push({
        file: file,
        created: file.getDateCreated()
      });
    }

    // Ordenar por data
    backups.sort((a, b) => b.created - a.created);

    // Manter apenas os 10 mais recentes
    for (let i = 10; i < backups.length; i++) {
      backups[i].file.setTrashed(true);
      console.log('[EXPORT] Backup antigo removido:', backups[i].file.getName());
    }

  } catch (error) {
    console.error('[EXPORT] Erro ao limpar backups:', error);
  }
}
