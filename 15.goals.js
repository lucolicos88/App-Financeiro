/**
 * =============================================================================
 * GOALS.GS - Módulo de Metas Financeiras
 * =============================================================================
 *
 * Gerencia metas financeiras do usuário:
 * - Metas de economia
 * - Metas por categoria
 * - Acompanhamento de progresso
 * - Alertas de aproximação
 *
 * Versão: 2.4.0
 * =============================================================================
 */

/**
 * Obtém todas as metas do usuário
 *
 * @param {string} token - Token de sessão
 * @returns {Object} Lista de metas
 */
function getGoals(token) {
  try {
    console.log('[GOALS] getGoals chamada');

    if (!validateSession(token)) {
      return {
        success: false,
        message: 'Sessão inválida ou expirada'
      };
    }

    const sheet = getSheet(SHEET_NAMES.GOALS);
    if (!sheet) {
      // Criar planilha se não existir
      createGoalsSheet();
      return {
        success: true,
        message: 'Nenhuma meta encontrada',
        data: []
      };
    }

    const data = sheet.getDataRange().getValues();
    const goals = [];

    for (let i = 1; i < data.length; i++) {
      const [id, name, targetAmount, currentAmount, category, type, startDate, endDate, status, createdAt] = data[i];

      if (!id) continue;

      goals.push({
        id,
        name,
        targetAmount: parseFloat(targetAmount) || 0,
        currentAmount: parseFloat(currentAmount) || 0,
        category,
        type, // savings, spending-limit, category-budget
        startDate,
        endDate,
        status, // active, completed, cancelled
        progress: calculateProgress(parseFloat(currentAmount) || 0, parseFloat(targetAmount) || 0),
        createdAt
      });
    }

    console.log('[GOALS] Metas obtidas:', goals.length);

    return {
      success: true,
      message: 'Metas obtidas com sucesso',
      data: goals,
      count: goals.length
    };

  } catch (error) {
    console.error('[GOALS] Erro em getGoals:', error);
    logEvent('GOALS', 'ERROR', 'getGoals', 'Erro ao obter metas', error.stack);
    return {
      success: false,
      message: 'Erro ao obter metas: ' + error.message
    };
  }
}

/**
 * Cria nova meta
 *
 * @param {string} token - Token de sessão
 * @param {Object} goalData - Dados da meta
 * @returns {Object} Resultado
 */
function createGoal(token, goalData) {
  try {
    console.log('[GOALS] createGoal chamada');

    if (!validateSession(token)) {
      return {
        success: false,
        message: 'Sessão inválida ou expirada'
      };
    }

    // Validações
    if (!goalData || !goalData.name) {
      return {
        success: false,
        message: 'Nome da meta é obrigatório'
      };
    }

    if (!goalData.targetAmount || goalData.targetAmount <= 0) {
      return {
        success: false,
        message: 'Valor da meta deve ser maior que zero'
      };
    }

    if (!goalData.endDate) {
      return {
        success: false,
        message: 'Data final é obrigatória'
      };
    }

    const sheet = getSheet(SHEET_NAMES.GOALS);
    if (!sheet) {
      createGoalsSheet();
    }

    const id = generateId();
    const now = new Date().toISOString();

    sheet.appendRow([
      id,
      goalData.name,
      goalData.targetAmount,
      0, // currentAmount
      goalData.category || '',
      goalData.type || 'savings',
      goalData.startDate || new Date().toISOString().split('T')[0],
      goalData.endDate,
      'active',
      now
    ]);

    console.log('[GOALS] Meta criada:', id);

    return {
      success: true,
      message: 'Meta criada com sucesso',
      data: {
        id,
        name: goalData.name,
        targetAmount: goalData.targetAmount,
        currentAmount: 0,
        category: goalData.category || '',
        type: goalData.type || 'savings',
        startDate: goalData.startDate || new Date().toISOString().split('T')[0],
        endDate: goalData.endDate,
        status: 'active',
        progress: 0,
        createdAt: now
      }
    };

  } catch (error) {
    console.error('[GOALS] Erro em createGoal:', error);
    logEvent('GOALS', 'ERROR', 'createGoal', 'Erro ao criar meta', error.stack);
    return {
      success: false,
      message: 'Erro ao criar meta: ' + error.message
    };
  }
}

/**
 * Atualiza progresso de uma meta
 *
 * @param {string} token - Token de sessão
 * @param {string} goalId - ID da meta
 * @param {number} newAmount - Novo valor atual
 * @returns {Object} Resultado
 */
function updateGoalProgress(token, goalId, newAmount) {
  try {
    console.log('[GOALS] updateGoalProgress chamada, id:', goalId);

    if (!validateSession(token)) {
      return {
        success: false,
        message: 'Sessão inválida ou expirada'
      };
    }

    const sheet = getSheet(SHEET_NAMES.GOALS);
    if (!sheet) {
      return {
        success: false,
        message: 'Planilha de metas não encontrada'
      };
    }

    const data = sheet.getDataRange().getValues();
    let rowIndex = -1;
    let goalData = null;

    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === goalId) {
        rowIndex = i + 1;
        goalData = data[i];
        break;
      }
    }

    if (rowIndex === -1) {
      return {
        success: false,
        message: 'Meta não encontrada'
      };
    }

    const targetAmount = parseFloat(goalData[2]);
    const progress = calculateProgress(newAmount, targetAmount);

    // Atualizar valor atual
    sheet.getRange(rowIndex, 4).setValue(newAmount);

    // Se atingiu a meta, marcar como completa
    if (progress >= 100) {
      sheet.getRange(rowIndex, 9).setValue('completed');
    }

    console.log('[GOALS] Progresso atualizado:', progress + '%');

    return {
      success: true,
      message: 'Progresso atualizado com sucesso',
      data: {
        id: goalId,
        currentAmount: newAmount,
        targetAmount: targetAmount,
        progress: progress,
        status: progress >= 100 ? 'completed' : 'active'
      }
    };

  } catch (error) {
    console.error('[GOALS] Erro em updateGoalProgress:', error);
    logEvent('GOALS', 'ERROR', 'updateGoalProgress', 'Erro ao atualizar progresso', error.stack);
    return {
      success: false,
      message: 'Erro ao atualizar progresso: ' + error.message
    };
  }
}

/**
 * Exclui uma meta
 *
 * @param {string} token - Token de sessão
 * @param {string} goalId - ID da meta
 * @returns {Object} Resultado
 */
function deleteGoal(token, goalId) {
  try {
    console.log('[GOALS] deleteGoal chamada, id:', goalId);

    if (!validateSession(token)) {
      return {
        success: false,
        message: 'Sessão inválida ou expirada'
      };
    }

    const sheet = getSheet(SHEET_NAMES.GOALS);
    if (!sheet) {
      return {
        success: false,
        message: 'Planilha de metas não encontrada'
      };
    }

    const data = sheet.getDataRange().getValues();
    let rowIndex = -1;

    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === goalId) {
        rowIndex = i + 1;
        break;
      }
    }

    if (rowIndex === -1) {
      return {
        success: false,
        message: 'Meta não encontrada'
      };
    }

    sheet.deleteRow(rowIndex);

    console.log('[GOALS] Meta excluída:', goalId);

    return {
      success: true,
      message: 'Meta excluída com sucesso'
    };

  } catch (error) {
    console.error('[GOALS] Erro em deleteGoal:', error);
    logEvent('GOALS', 'ERROR', 'deleteGoal', 'Erro ao excluir meta', error.stack);
    return {
      success: false,
      message: 'Erro ao excluir meta: ' + error.message
    };
  }
}

/**
 * Atualiza automaticamente progresso de metas baseado em transações
 *
 * @param {string} token - Token de sessão
 * @returns {Object} Resultado
 */
function updateAllGoalsProgress(token) {
  try {
    console.log('[GOALS] updateAllGoalsProgress chamada');

    if (!validateSession(token)) {
      return {
        success: false,
        message: 'Sessão inválida ou expirada'
      };
    }

    const goalsResult = getGoals(token);
    if (!goalsResult.success) {
      return goalsResult;
    }

    const goals = goalsResult.data;
    const now = new Date();

    goals.forEach(goal => {
      if (goal.status !== 'active') return;

      // Obter transações no período da meta
      const transactionsResult = queryTransactions(token, {
        startDate: goal.startDate,
        endDate: goal.endDate
      });

      if (!transactionsResult.success) return;

      const transactions = transactionsResult.data;

      let currentAmount = 0;

      if (goal.type === 'savings') {
        // Meta de economia: saldo do período
        transactions.forEach(t => {
          if (t.type === 'credit') {
            currentAmount += t.amount;
          } else {
            currentAmount -= t.amount;
          }
        });
        currentAmount = Math.max(0, currentAmount);

      } else if (goal.type === 'spending-limit') {
        // Meta de limite de gastos: total de débitos
        transactions.forEach(t => {
          if (t.type === 'debit') {
            currentAmount += t.amount;
          }
        });

      } else if (goal.type === 'category-budget' && goal.category) {
        // Meta por categoria: gastos na categoria
        transactions.forEach(t => {
          if (t.type === 'debit' && t.category === goal.category) {
            currentAmount += t.amount;
          }
        });
      }

      // Atualizar progresso
      updateGoalProgress(token, goal.id, currentAmount);
    });

    console.log('[GOALS] Progresso de todas as metas atualizado');

    return {
      success: true,
      message: 'Progresso atualizado com sucesso',
      data: { updated: goals.length }
    };

  } catch (error) {
    console.error('[GOALS] Erro em updateAllGoalsProgress:', error);
    return {
      success: false,
      message: 'Erro ao atualizar progresso: ' + error.message
    };
  }
}

/**
 * Calcula percentual de progresso
 */
function calculateProgress(current, target) {
  if (!target || target === 0) return 0;
  const progress = (current / target) * 100;
  return Math.min(Math.round(progress * 10) / 10, 100);
}

/**
 * Cria planilha de metas
 */
function createGoalsSheet() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.insertSheet(SHEET_NAMES.GOALS);

    sheet.appendRow([
      'ID',
      'Nome',
      'Valor Meta',
      'Valor Atual',
      'Categoria',
      'Tipo',
      'Data Início',
      'Data Fim',
      'Status',
      'Criado Em'
    ]);

    // Formatar cabeçalho
    const headerRange = sheet.getRange(1, 1, 1, 10);
    headerRange.setBackground('#6366f1');
    headerRange.setFontColor('#ffffff');
    headerRange.setFontWeight('bold');

    console.log('[GOALS] Planilha de metas criada');

  } catch (error) {
    console.error('[GOALS] Erro ao criar planilha:', error);
  }
}
