/**
 * =============================================================================
 * SHEETS.GS - Módulo de Operações com Google Sheets
 * =============================================================================
 *
 * Responsável por operações básicas de leitura e escrita na planilha:
 * - Obter dados de abas específicas
 * - Adicionar linhas
 * - Atualizar linhas
 * - Deletar linhas
 * - Buscar registros
 * - Gerar IDs únicos
 *
 * Todas as funções incluem validação e tratamento de erros.
 * =============================================================================
 */

/**
 * Nomes das abas da planilha
 */
const SHEET_NAMES = {
  TRANSACTIONS: 'Transações',
  CATEGORIES: 'Categorias',
  SESSIONS: 'Sessões',
  LOGS: 'Logs',
  CONFIG: 'Configurações',
  GOALS: 'Metas'
};

/**
 * Obtém referência à planilha ativa
 *
 * @returns {SpreadsheetApp.Spreadsheet} Planilha ativa
 */
function getSpreadsheet() {
  return SpreadsheetApp.getActiveSpreadsheet();
}

/**
 * Obtém referência a uma aba específica
 * 
 * @param {string} sheetName - Nome da aba
 * @returns {SpreadsheetApp.Sheet|null} Aba ou null se não existir
 */
function getSheet(sheetName) {
  try {
    const ss = getSpreadsheet();
    const sheet = ss.getSheetByName(sheetName);
    
    if (!sheet) {
      console.error('[SHEETS] Aba não encontrada: ' + sheetName);
      return null;
    }
    
    return sheet;
    
  } catch (error) {
    console.error('[SHEETS] Erro ao obter aba:', error);
    return null;
  }
}

/**
 * Obtém todos os dados de uma aba (exceto cabeçalho)
 * 
 * @param {string} sheetName - Nome da aba
 * @returns {Array<Array>} Array bidimensional com os dados
 */
function getAllData(sheetName) {
  try {
    const sheet = getSheet(sheetName);
    if (!sheet) {
      return [];
    }
    
    const lastRow = sheet.getLastRow();
    
    // Se só tem cabeçalho, retorna array vazio
    if (lastRow <= 1) {
      return [];
    }
    
    // Lê dados (pula primeira linha - cabeçalho)
    const range = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn());
    const data = range.getValues();
    
    return data;
    
  } catch (error) {
    console.error('[SHEETS] Erro ao obter dados:', error);
    return [];
  }
}

/**
 * Obtém cabeçalhos de uma aba
 * 
 * @param {string} sheetName - Nome da aba
 * @returns {Array<string>} Array com nomes das colunas
 */
function getHeaders(sheetName) {
  try {
    const sheet = getSheet(sheetName);
    if (!sheet) {
      return [];
    }
    
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    return headers;
    
  } catch (error) {
    console.error('[SHEETS] Erro ao obter cabeçalhos:', error);
    return [];
  }
}

/**
 * Adiciona uma nova linha em uma aba
 * 
 * @param {string} sheetName - Nome da aba
 * @param {Array} rowData - Array com dados da linha
 * @returns {boolean} True se sucesso, False caso contrário
 */
function addRow(sheetName, rowData) {
  try {
    const sheet = getSheet(sheetName);
    if (!sheet) {
      return false;
    }
    
    // Validação de entrada
    if (!Array.isArray(rowData) || rowData.length === 0) {
      console.error('[SHEETS] Dados inválidos para adicionar linha');
      return false;
    }
    
    // Adiciona linha no final
    const lastRow = sheet.getLastRow();
    sheet.getRange(lastRow + 1, 1, 1, rowData.length).setValues([rowData]);
    
    return true;
    
  } catch (error) {
    console.error('[SHEETS] Erro ao adicionar linha:', error);
    return false;
  }
}

/**
 * Atualiza uma linha existente
 * 
 * @param {string} sheetName - Nome da aba
 * @param {number} rowIndex - Índice da linha (baseado em 1, sendo 1 o cabeçalho)
 * @param {Array} rowData - Novos dados da linha
 * @returns {boolean} True se sucesso, False caso contrário
 */
function updateRow(sheetName, rowIndex, rowData) {
  try {
    const sheet = getSheet(sheetName);
    if (!sheet) {
      return false;
    }
    
    // Validação de entrada
    if (!Array.isArray(rowData) || rowData.length === 0) {
      console.error('[SHEETS] Dados inválidos para atualizar linha');
      return false;
    }
    
    if (rowIndex < 2) {
      console.error('[SHEETS] Índice de linha inválido');
      return false;
    }
    
    // Atualiza linha
    sheet.getRange(rowIndex, 1, 1, rowData.length).setValues([rowData]);
    
    return true;
    
  } catch (error) {
    console.error('[SHEETS] Erro ao atualizar linha:', error);
    return false;
  }
}

/**
 * Deleta uma linha
 * 
 * @param {string} sheetName - Nome da aba
 * @param {number} rowIndex - Índice da linha a deletar
 * @returns {boolean} True se sucesso, False caso contrário
 */
function deleteRow(sheetName, rowIndex) {
  try {
    const sheet = getSheet(sheetName);
    if (!sheet) {
      return false;
    }
    
    // Validação de entrada
    if (rowIndex < 2) {
      console.error('[SHEETS] Não é possível deletar cabeçalho');
      return false;
    }
    
    // Deleta linha
    sheet.deleteRow(rowIndex);
    
    return true;
    
  } catch (error) {
    console.error('[SHEETS] Erro ao deletar linha:', error);
    return false;
  }
}

/**
 * Busca uma linha por ID
 * 
 * @param {string} sheetName - Nome da aba
 * @param {number} id - ID a buscar (coluna 1)
 * @returns {Object|null} Objeto com rowIndex e data, ou null se não encontrado
 */
function findRowById(sheetName, id) {
  try {
    const sheet = getSheet(sheetName);
    if (!sheet) {
      return null;
    }
    
    const data = sheet.getDataRange().getValues();
    
    // Procura por ID (primeira coluna)
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === id || data[i][0] === parseInt(id)) {
        return {
          rowIndex: i + 1,
          data: data[i]
        };
      }
    }
    
    return null;
    
  } catch (error) {
    console.error('[SHEETS] Erro ao buscar linha por ID:', error);
    return null;
  }
}

/**
 * Gera próximo ID disponível para uma aba - COM LOCK para evitar race conditions
 *
 * @param {string} sheetName - Nome da aba
 * @returns {number} Próximo ID disponível
 */
function getNextId(sheetName) {
  const lock = LockService.getScriptLock();

  try {
    // Aguarda até 30 segundos pelo lock
    lock.waitLock(30000);

    const sheet = getSheet(sheetName);
    if (!sheet) {
      return 1;
    }

    const lastRow = sheet.getLastRow();

    // Se só tem cabeçalho, retorna 1
    if (lastRow <= 1) {
      return 1;
    }

    // Lê última linha e pega ID (primeira coluna)
    const lastId = sheet.getRange(lastRow, 1).getValue();

    // Retorna próximo ID
    return parseInt(lastId) + 1;

  } catch (error) {
    console.error('[SHEETS] Erro ao gerar ID:', error);
    return 1;
  } finally {
    // Sempre libera o lock
    lock.releaseLock();
  }
}

/**
 * Busca linhas que atendem a um critério
 * 
 * @param {string} sheetName - Nome da aba
 * @param {number} columnIndex - Índice da coluna (baseado em 0)
 * @param {*} value - Valor a buscar
 * @returns {Array<Object>} Array de objetos com rowIndex e data
 */
function findRowsByColumn(sheetName, columnIndex, value) {
  try {
    const sheet = getSheet(sheetName);
    if (!sheet) {
      return [];
    }
    
    const data = sheet.getDataRange().getValues();
    const results = [];
    
    // Procura por valor na coluna especificada
    for (let i = 1; i < data.length; i++) {
      if (data[i][columnIndex] === value) {
        results.push({
          rowIndex: i + 1,
          data: data[i]
        });
      }
    }
    
    return results;
    
  } catch (error) {
    console.error('[SHEETS] Erro ao buscar linhas:', error);
    return [];
  }
}

/**
 * Obtém valor de uma configuração específica
 * 
 * @param {string} key - Chave da configuração
 * @returns {string|null} Valor da configuração ou null
 */
function getSetting(key) {
  try {
    const sheet = getSheet('Settings');
    if (!sheet) {
      return null;
    }
    
    const data = sheet.getDataRange().getValues();
    
    // Procura pela chave
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === key) {
        return data[i][1];
      }
    }
    
    return null;
    
  } catch (error) {
    console.error('[SHEETS] Erro ao obter configuração:', error);
    return null;
  }
}

/**
 * Define valor de uma configuração
 * 
 * @param {string} key - Chave da configuração
 * @param {string} value - Valor da configuração
 * @returns {boolean} True se sucesso, False caso contrário
 */
function setSetting(key, value) {
  try {
    const sheet = getSheet('Settings');
    if (!sheet) {
      return false;
    }
    
    const data = sheet.getDataRange().getValues();
    let found = false;
    
    // Procura pela chave e atualiza
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === key) {
        sheet.getRange(i + 1, 2).setValue(value);
        found = true;
        break;
      }
    }
    
    // Se não encontrou, adiciona nova linha
    if (!found) {
      const lastRow = sheet.getLastRow();
      sheet.getRange(lastRow + 1, 1, 1, 2).setValues([[key, value]]);
    }
    
    return true;
    
  } catch (error) {
    console.error('[SHEETS] Erro ao definir configuração:', error);
    return false;
  }
}