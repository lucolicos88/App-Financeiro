/**
 * =============================================================================
 * SETTINGS.GS - Módulo de Configurações do Usuário
 * =============================================================================
 *
 * Gerencia configurações personalizadas do usuário:
 * - Configurações de email e notificações
 * - Frequência de envio de relatórios
 * - Preferências de interface
 * - Metas financeiras
 * - Categorias personalizadas
 *
 * Versão: 2.4.0
 * =============================================================================
 */

/**
 * Obtém configurações do usuário
 *
 * @param {string} token - Token de sessão
 * @returns {Object} Configurações do usuário
 */
function getUserSettings(token) {
  try {
    console.log('[SETTINGS] getUserSettings chamada');

    if (!validateSession(token)) {
      return {
        success: false,
        message: 'Sessão inválida ou expirada'
      };
    }

    const sheet = getSheet(SHEET_NAMES.CONFIG);
    if (!sheet) {
      return {
        success: false,
        message: 'Planilha de configurações não encontrada'
      };
    }

    const data = sheet.getDataRange().getValues();
    const settings = {};

    // Converter array em objeto de configurações
    for (let i = 1; i < data.length; i++) {
      const [key, value] = data[i];
      if (key) {
        settings[key] = value;
      }
    }

    // Configurações padrão se não existirem
    const defaultSettings = {
      email: Session.getActiveUser().getEmail(),
      emailReportsEnabled: false,
      emailReportsFrequency: 'monthly', // daily, weekly, monthly
      emailReportsDay: 1, // dia do mês ou dia da semana
      emailReportsTime: '09:00',
      notificationsEnabled: true,
      remindersDaysBeforeDue: 3,
      darkMode: false,
      currency: 'BRL',
      dateFormat: 'DD/MM/YYYY',
      monthlyIncome: 0,
      savingsGoal: 0,
      budgetAlertThreshold: 80, // % do orçamento
      exportFormat: 'xlsx',
      autoBackupEnabled: false,
      autoBackupFrequency: 'weekly',
      customCategories: JSON.stringify([]),
      lastBackupDate: '',
      lastReportSentDate: '',
      timezone: 'America/Sao_Paulo'
    };

    // Merge com configurações padrão
    const finalSettings = { ...defaultSettings, ...settings };

    console.log('[SETTINGS] Configurações obtidas');

    return {
      success: true,
      message: 'Configurações obtidas com sucesso',
      data: finalSettings
    };

  } catch (error) {
    console.error('[SETTINGS] Erro em getUserSettings:', error);
    logEvent('SETTINGS', 'ERROR', 'getUserSettings', 'Erro ao obter configurações', error.stack);
    return {
      success: false,
      message: 'Erro ao obter configurações: ' + error.message
    };
  }
}

/**
 * Atualiza configurações do usuário
 *
 * @param {string} token - Token de sessão
 * @param {Object} newSettings - Novas configurações
 * @returns {Object} Resultado da operação
 */
function updateUserSettings(token, newSettings) {
  try {
    console.log('[SETTINGS] updateUserSettings chamada');

    if (!validateSession(token)) {
      return {
        success: false,
        message: 'Sessão inválida ou expirada'
      };
    }

    if (!newSettings || typeof newSettings !== 'object') {
      return {
        success: false,
        message: 'Configurações inválidas'
      };
    }

    const sheet = getSheet(SHEET_NAMES.CONFIG);
    if (!sheet) {
      return {
        success: false,
        message: 'Planilha de configurações não encontrada'
      };
    }

    // Obter configurações atuais
    const currentSettings = getUserSettings(token);
    if (!currentSettings.success) {
      return currentSettings;
    }

    // Merge com novas configurações
    const updatedSettings = { ...currentSettings.data, ...newSettings };

    // Limpar planilha e reescrever
    sheet.clear();
    sheet.appendRow(['Chave', 'Valor']);

    // Escrever configurações
    Object.entries(updatedSettings).forEach(([key, value]) => {
      sheet.appendRow([key, value]);
    });

    console.log('[SETTINGS] Configurações atualizadas');

    // Se habilitou relatórios por email, criar trigger
    if (newSettings.emailReportsEnabled && !currentSettings.data.emailReportsEnabled) {
      setupEmailReportTrigger(updatedSettings);
    }

    // Se desabilitou, remover trigger
    if (!newSettings.emailReportsEnabled && currentSettings.data.emailReportsEnabled) {
      removeEmailReportTrigger();
    }

    return {
      success: true,
      message: 'Configurações atualizadas com sucesso',
      data: updatedSettings
    };

  } catch (error) {
    console.error('[SETTINGS] Erro em updateUserSettings:', error);
    logEvent('SETTINGS', 'ERROR', 'updateUserSettings', 'Erro ao atualizar configurações', error.stack);
    return {
      success: false,
      message: 'Erro ao atualizar configurações: ' + error.message
    };
  }
}

/**
 * Configura trigger para envio automático de relatórios
 *
 * @param {Object} settings - Configurações do usuário
 */
function setupEmailReportTrigger(settings) {
  try {
    console.log('[SETTINGS] Configurando trigger de email');

    // Remover triggers existentes
    removeEmailReportTrigger();

    const frequency = settings.emailReportsFrequency || 'monthly';

    if (frequency === 'daily') {
      // Trigger diário
      const [hour, minute] = (settings.emailReportsTime || '09:00').split(':');
      ScriptApp.newTrigger('sendScheduledEmailReport')
        .timeBased()
        .atHour(parseInt(hour))
        .everyDays(1)
        .create();

    } else if (frequency === 'weekly') {
      // Trigger semanal
      const dayOfWeek = settings.emailReportsDay || 1; // 1 = Segunda
      const [hour, minute] = (settings.emailReportsTime || '09:00').split(':');

      ScriptApp.newTrigger('sendScheduledEmailReport')
        .timeBased()
        .onWeekDay(getDayOfWeek(dayOfWeek))
        .atHour(parseInt(hour))
        .create();

    } else if (frequency === 'monthly') {
      // Trigger mensal
      const dayOfMonth = settings.emailReportsDay || 1;
      const [hour, minute] = (settings.emailReportsTime || '09:00').split(':');

      ScriptApp.newTrigger('sendScheduledEmailReport')
        .timeBased()
        .onMonthDay(dayOfMonth)
        .atHour(parseInt(hour))
        .create();
    }

    console.log('[SETTINGS] Trigger configurado:', frequency);

  } catch (error) {
    console.error('[SETTINGS] Erro ao configurar trigger:', error);
    logEvent('SETTINGS', 'ERROR', 'setupEmailReportTrigger', 'Erro ao configurar trigger', error.stack);
  }
}

/**
 * Remove trigger de envio de email
 */
function removeEmailReportTrigger() {
  try {
    const triggers = ScriptApp.getProjectTriggers();

    triggers.forEach(trigger => {
      if (trigger.getHandlerFunction() === 'sendScheduledEmailReport') {
        ScriptApp.deleteTrigger(trigger);
        console.log('[SETTINGS] Trigger removido');
      }
    });

  } catch (error) {
    console.error('[SETTINGS] Erro ao remover trigger:', error);
  }
}

/**
 * Converte número do dia em enum do GAS
 */
function getDayOfWeek(day) {
  const days = [
    null, // índice 0
    ScriptApp.WeekDay.MONDAY,
    ScriptApp.WeekDay.TUESDAY,
    ScriptApp.WeekDay.WEDNESDAY,
    ScriptApp.WeekDay.THURSDAY,
    ScriptApp.WeekDay.FRIDAY,
    ScriptApp.WeekDay.SATURDAY,
    ScriptApp.WeekDay.SUNDAY
  ];
  return days[day] || ScriptApp.WeekDay.MONDAY;
}

/**
 * Obtém categorias personalizadas
 *
 * @param {string} token - Token de sessão
 * @returns {Object} Lista de categorias
 */
function getCustomCategories(token) {
  try {
    console.log('[SETTINGS] getCustomCategories chamada');

    if (!validateSession(token)) {
      return {
        success: false,
        message: 'Sessão inválida ou expirada'
      };
    }

    const settings = getUserSettings(token);
    if (!settings.success) {
      return settings;
    }

    const customCategories = settings.data.customCategories
      ? JSON.parse(settings.data.customCategories)
      : [];

    return {
      success: true,
      message: 'Categorias obtidas com sucesso',
      data: customCategories
    };

  } catch (error) {
    console.error('[SETTINGS] Erro em getCustomCategories:', error);
    return {
      success: false,
      message: 'Erro ao obter categorias: ' + error.message
    };
  }
}

/**
 * Adiciona categoria personalizada
 *
 * @param {string} token - Token de sessão
 * @param {Object} category - Categoria {name, icon, color, type}
 * @returns {Object} Resultado
 */
function addCustomCategory(token, category) {
  try {
    console.log('[SETTINGS] addCustomCategory chamada');

    if (!validateSession(token)) {
      return {
        success: false,
        message: 'Sessão inválida ou expirada'
      };
    }

    if (!category || !category.name) {
      return {
        success: false,
        message: 'Nome da categoria é obrigatório'
      };
    }

    const categoriesResult = getCustomCategories(token);
    if (!categoriesResult.success) {
      return categoriesResult;
    }

    const categories = categoriesResult.data;

    // Verificar se já existe
    if (categories.find(c => c.name === category.name)) {
      return {
        success: false,
        message: 'Categoria já existe'
      };
    }

    // Adicionar categoria
    categories.push({
      id: generateId(),
      name: category.name,
      icon: category.icon || '📌',
      color: category.color || '#6366f1',
      type: category.type || 'debit',
      createdAt: new Date().toISOString()
    });

    // Salvar
    const result = updateUserSettings(token, {
      customCategories: JSON.stringify(categories)
    });

    if (result.success) {
      return {
        success: true,
        message: 'Categoria adicionada com sucesso',
        data: categories
      };
    }

    return result;

  } catch (error) {
    console.error('[SETTINGS] Erro em addCustomCategory:', error);
    return {
      success: false,
      message: 'Erro ao adicionar categoria: ' + error.message
    };
  }
}

/**
 * Remove categoria personalizada
 *
 * @param {string} token - Token de sessão
 * @param {string} categoryId - ID da categoria
 * @returns {Object} Resultado
 */
function removeCustomCategory(token, categoryId) {
  try {
    console.log('[SETTINGS] removeCustomCategory chamada');

    if (!validateSession(token)) {
      return {
        success: false,
        message: 'Sessão inválida ou expirada'
      };
    }

    const categoriesResult = getCustomCategories(token);
    if (!categoriesResult.success) {
      return categoriesResult;
    }

    const categories = categoriesResult.data.filter(c => c.id !== categoryId);

    const result = updateUserSettings(token, {
      customCategories: JSON.stringify(categories)
    });

    if (result.success) {
      return {
        success: true,
        message: 'Categoria removida com sucesso',
        data: categories
      };
    }

    return result;

  } catch (error) {
    console.error('[SETTINGS] Erro em removeCustomCategory:', error);
    return {
      success: false,
      message: 'Erro ao remover categoria: ' + error.message
    };
  }
}
