/**
 * =============================================================================
 * ERRORS.GS - Módulo de Tratamento de Erros e Logs
 * =============================================================================
 * 
 * Responsável por:
 * - Registrar eventos no sistema (logs)
 * - Tratamento centralizado de erros
 * - Diferentes níveis de log (INFO, WARN, ERROR)
 * - Armazenamento estruturado na aba Logs
 * 
 * Todos os erros e eventos importantes devem passar por este módulo.
 * =============================================================================
 */

/**
 * Registra um evento no sistema
 * 
 * @param {string} module - Nome do módulo (AUTH, TRANSACTIONS, etc)
 * @param {string} level - Nível (INFO, WARN, ERROR)
 * @param {string} action - Ação executada
 * @param {string} message - Mensagem descritiva
 * @param {string} stack - Stack trace (para erros)
 */
function logEvent(module, level, action, message, stack) {
  try {
    // Valida parâmetros
    if (!module || !level || !action || !message) {
      console.error('[ERRORS] Parâmetros de log inválidos');
      return;
    }
    
    // Obtém usuário atual (se disponível)
    const user = Session.getActiveUser().getEmail() || 'system';
    
    // Timestamp atual
    const timestamp = new Date().toISOString();
    
    // Monta array de dados
    const logData = [
      timestamp,
      user,
      module,
      level,
      action,
      message,
      stack || ''
    ];
    
    // Adiciona à aba Logs
    const success = addRow('Logs', logData);
    
    // Se falhar, apenas loga no console (evita loop infinito)
    if (!success) {
      console.error('[ERRORS] Falha ao registrar log:', {
        module, level, action, message
      });
    }
    
    // Também loga no console para debug
    const logMessage = `[${level}] [${module}] ${action}: ${message}`;
    
    if (level === 'ERROR') {
      console.error(logMessage, stack);
    } else if (level === 'WARN') {
      console.warn(logMessage);
    } else {
      console.log(logMessage);
    }
    
  } catch (error) {
    // Último recurso: apenas console
    console.error('[ERRORS] Erro crítico ao registrar log:', error);
  }
}

/**
 * Registra um erro
 * 
 * @param {string} module - Nome do módulo
 * @param {string} action - Ação que causou o erro
 * @param {Error} error - Objeto Error
 */
function logError(module, action, error) {
  const message = error.message || 'Erro desconhecido';
  const stack = error.stack || '';
  logEvent(module, 'ERROR', action, message, stack);
}

/**
 * Registra um aviso
 * 
 * @param {string} module - Nome do módulo
 * @param {string} action - Ação executada
 * @param {string} message - Mensagem de aviso
 */
function logWarning(module, action, message) {
  logEvent(module, 'WARN', action, message, '');
}

/**
 * Registra uma informação
 * 
 * @param {string} module - Nome do módulo
 * @param {string} action - Ação executada
 * @param {string} message - Mensagem informativa
 */
function logInfo(module, action, message) {
  logEvent(module, 'INFO', action, message, '');
}

/**
 * Obtém logs com filtros
 * 
 * @param {string} token - Token de sessão
 * @param {Object} filters - Filtros (level, module, startDate, endDate, limit)
 * @returns {Object} Resultado com logs
 */
function getLogs(token, filters) {
  try {
    // Valida sessão
    if (!validateSession(token)) {
      return {
        success: false,
        message: 'Sessão inválida ou expirada',
        data: []
      };
    }
    
    // Obtém todos os logs
    const data = getAllData('Logs');
    
    if (data.length === 0) {
      return {
        success: true,
        message: 'Nenhum log encontrado',
        data: []
      };
    }
    
    // Converte para objetos
    let logs = data.map(row => ({
      ts: row[0],
      user: row[1],
      module: row[2],
      level: row[3],
      action: row[4],
      message: row[5],
      stack: row[6]
    }));
    
    // Aplica filtros se fornecidos
    if (filters && typeof filters === 'object') {
      // Filtro por nível
      if (filters.level) {
        logs = logs.filter(l => l.level === filters.level);
      }
      
      // Filtro por módulo
      if (filters.module) {
        logs = logs.filter(l => l.module === filters.module);
      }
      
      // Filtro por data inicial
      if (filters.startDate) {
        logs = logs.filter(l => l.ts >= filters.startDate);
      }
      
      // Filtro por data final
      if (filters.endDate) {
        logs = logs.filter(l => l.ts <= filters.endDate);
      }
    }
    
    // Ordena por timestamp (mais recente primeiro)
    logs.sort((a, b) => b.ts.localeCompare(a.ts));
    
    // Aplica limite se fornecido
    if (filters && filters.limit && filters.limit > 0) {
      logs = logs.slice(0, filters.limit);
    }
    
    return {
      success: true,
      message: 'Logs obtidos com sucesso',
      data: logs,
      count: logs.length
    };
    
  } catch (error) {
    console.error('[ERRORS] Erro ao obter logs:', error);
    return {
      success: false,
      message: 'Erro ao obter logs: ' + error.message,
      data: []
    };
  }
}

/**
 * Limpa logs antigos (mais de 90 dias)
 * Função de manutenção
 * 
 * @param {string} token - Token de sessão
 * @returns {Object} Resultado da operação
 */
function cleanOldLogs(token) {
  try {
    // Valida sessão
    if (!validateSession(token)) {
      return {
        success: false,
        message: 'Sessão inválida ou expirada'
      };
    }
    
    const sheet = getSheet('Logs');
    if (!sheet) {
      return {
        success: false,
        message: 'Aba Logs não encontrada'
      };
    }
    
    // Data limite (90 dias atrás)
    const limitDate = new Date();
    limitDate.setDate(limitDate.getDate() - 90);
    const limitDateStr = limitDate.toISOString();
    
    // Obtém dados
    const data = sheet.getDataRange().getValues();
    let deletedCount = 0;
    
    // Percorre de trás para frente (para não afetar índices)
    for (let i = data.length - 1; i >= 2; i--) {
      const logDate = data[i][0];
      
      if (logDate < limitDateStr) {
        sheet.deleteRow(i + 1);
        deletedCount++;
      }
    }
    
    logEvent('ERRORS', 'INFO', 'cleanOldLogs', `${deletedCount} logs antigos removidos`, '');
    
    return {
      success: true,
      message: `${deletedCount} logs antigos removidos`,
      deletedCount: deletedCount
    };
    
  } catch (error) {
    logError('ERRORS', 'cleanOldLogs', error);
    return {
      success: false,
      message: 'Erro ao limpar logs: ' + error.message
    };
  }
}