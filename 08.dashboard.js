/**
 * =============================================================================
 * DASHBOARD.GS - VERSÃO CORRIGIDA COM LOGS DETALHADOS
 * =============================================================================
 */

function getDashboardData(token) {
  try {
    console.log('[DASHBOARD] getDashboardData chamada');
    
    if (!validateSession(token)) {
      console.log('[DASHBOARD] Sessão inválida');
      return {
        success: false,
        message: 'Sessão inválida ou expirada'
      };
    }
    
    console.log('[DASHBOARD] Obtendo data atual...');
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    
    console.log('[DASHBOARD] Obtendo KPIs...');
    const kpis = getMainKPIs(token);
    console.log('[DASHBOARD] KPIs obtidos:', kpis ? 'OK' : 'NULL');
    
    console.log('[DASHBOARD] Obtendo resumo mensal...');
    const monthSummary = getMonthlyReport(token, currentYear, currentMonth);
    console.log('[DASHBOARD] Resumo mensal:', monthSummary ? 'OK' : 'NULL');
    
    console.log('[DASHBOARD] Obtendo transações recentes...');
    const recentTransactions = getRecentTransactions(token, 10);
    console.log('[DASHBOARD] Transações recentes:', recentTransactions ? 'OK' : 'NULL');
    
    console.log('[DASHBOARD] Obtendo top categorias...');
    const topCategories = getTopCategories(token, null, 5, 
      `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`,
      formatDateDash(now)
    );
    console.log('[DASHBOARD] Top categorias:', topCategories ? 'OK' : 'NULL');
    
    const result = {
      success: true,
      message: 'Dashboard carregado com sucesso',
      data: {
        kpis: (kpis && kpis.data) ? kpis.data : {},
        monthSummary: (monthSummary && monthSummary.data) ? monthSummary.data : {},
        recentTransactions: (recentTransactions && recentTransactions.data) ? recentTransactions.data : [],
        topCategories: (topCategories && topCategories.data) ? topCategories.data : []
      }
    };
    
    console.log('[DASHBOARD] Retornando resultado:', JSON.stringify(result));
    return result;
    
  } catch (error) {
    console.error('[DASHBOARD] Erro em getDashboardData:', error);
    console.error('[DASHBOARD] Stack:', error.stack);
    logEvent('DASHBOARD', 'ERROR', 'getDashboardData', 'Erro ao carregar dashboard', error.stack);
    return {
      success: false,
      message: 'Erro ao carregar dashboard: ' + error.message
    };
  }
}

function getMainKPIs(token, preloadedTransactions) {
  try {
    console.log('[DASHBOARD] getMainKPIs chamada');

    if (!validateSession(token)) {
      console.log('[DASHBOARD] Sessão inválida em getMainKPIs');
      return {
        success: false,
        message: 'Sessão inválida ou expirada'
      };
    }

    console.log('[DASHBOARD] Listando transações para KPIs...');
    const transactionsResult = Array.isArray(preloadedTransactions)
      ? { success: true, data: preloadedTransactions }
      : queryTransactions(token, {});
    console.log('[DASHBOARD] Resultado de listTransactions:', transactionsResult ? 'OK' : 'NULL');

    if (!transactionsResult || !transactionsResult.success) {
      console.log('[DASHBOARD] Erro ao listar transações para KPIs');
      return {
        success: false,
        message: 'Erro ao obter transações',
        data: getEmptyKPIStructure()
      };
    }

    const transactions = transactionsResult.data || [];
    console.log('[DASHBOARD] Total de transações para KPIs:', transactions.length);

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    // Mês anterior
    const previousDate = new Date(currentYear, currentMonth - 2, 1);
    const previousYear = previousDate.getFullYear();
    const previousMonth = previousDate.getMonth() + 1;

    // Períodos
    const monthStart = `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`;
    const monthEnd = formatDateDash(now);
    const prevMonthStart = `${previousYear}-${String(previousMonth).padStart(2, '0')}-01`;
    const prevMonthEnd = `${previousYear}-${String(previousMonth).padStart(2, '0')}-${new Date(previousYear, previousMonth, 0).getDate()}`;

    // Estrutura de KPIs expandida
    const kpiData = {
      total: {
        credits: 0,
        debits: 0,
        balance: 0,
        transactionCount: transactions.length,
        installmentDebits: 0,
        error: null
      },
      currentMonth: {
        credits: 0,
        debits: 0,
        balance: 0,
        transactionCount: 0,
        month: currentMonth,
        year: currentYear,
        installmentDebits: 0,
        daysElapsed: now.getDate(),
        daysInMonth: new Date(currentYear, currentMonth, 0).getDate(),
        error: null
      },
      previousMonth: {
        credits: 0,
        debits: 0,
        balance: 0,
        transactionCount: 0,
        month: previousMonth,
        year: previousYear
      },
      trends: {
        creditsChange: 0,
        creditsChangePercent: 0,
        debitsChange: 0,
        debitsChangePercent: 0,
        balanceChange: 0,
        balanceChangePercent: 0,
        creditsTrend: 'stable',
        debitsTrend: 'stable',
        balanceTrend: 'stable'
      },
      professional: {
        savingsRate: 0,
        burnRate: 0,
        projectedBalance: 0,
        avgDailyExpense: 0,
        financialHealth: 0
      }
    };

    // KPI 1: Totais gerais
    try {
      let totalCredits = 0;
      let totalDebits = 0;

      transactions.forEach(t => {
        if (t.type === 'credit') {
          totalCredits += (parseFloat(t.amount) || 0);
        } else {
          totalDebits += (parseFloat(t.amount) || 0);
        }
      });

      kpiData.total.credits = totalCredits;
      kpiData.total.debits = totalDebits;
      kpiData.total.balance = totalCredits - totalDebits;

      console.log('[DASHBOARD] KPI Total calculado - Balance:', kpiData.total.balance);
    } catch (error) {
      console.error('[DASHBOARD] Erro ao calcular KPI Total:', error);
      kpiData.total.error = 'Erro ao calcular totais gerais';
      logEvent('DASHBOARD', 'WARN', 'getMainKPIs', 'Erro ao calcular totais gerais', error.stack);
    }

    // KPI 2: Mês atual
    try {
      let monthCredits = 0;
      let monthDebits = 0;
      let monthCount = 0;

      transactions.forEach(t => {
        if (t.date >= monthStart && t.date <= monthEnd) {
          if (t.type === 'credit') {
            monthCredits += (parseFloat(t.amount) || 0);
          } else {
            monthDebits += (parseFloat(t.amount) || 0);
          }
          monthCount++;
        }
      });

      kpiData.currentMonth.credits = monthCredits;
      kpiData.currentMonth.debits = monthDebits;
      kpiData.currentMonth.balance = monthCredits - monthDebits;
      kpiData.currentMonth.transactionCount = monthCount;

      console.log('[DASHBOARD] KPI Mês calculado - Balance:', kpiData.currentMonth.balance);
    } catch (error) {
      console.error('[DASHBOARD] Erro ao calcular KPI Mês:', error);
      kpiData.currentMonth.error = 'Erro ao calcular dados do mês';
      logEvent('DASHBOARD', 'WARN', 'getMainKPIs', 'Erro ao calcular dados do mês', error.stack);
    }

    // KPI 3: Mês anterior (para comparação)
    try {
      let prevMonthCredits = 0;
      let prevMonthDebits = 0;
      let prevMonthCount = 0;

      transactions.forEach(t => {
        if (t.date >= prevMonthStart && t.date <= prevMonthEnd) {
          if (t.type === 'credit') {
            prevMonthCredits += (parseFloat(t.amount) || 0);
          } else {
            prevMonthDebits += (parseFloat(t.amount) || 0);
          }
          prevMonthCount++;
        }
      });

      kpiData.previousMonth.credits = prevMonthCredits;
      kpiData.previousMonth.debits = prevMonthDebits;
      kpiData.previousMonth.balance = prevMonthCredits - prevMonthDebits;
      kpiData.previousMonth.transactionCount = prevMonthCount;

      console.log('[DASHBOARD] KPI Mês Anterior - Balance:', kpiData.previousMonth.balance);
    } catch (error) {
      console.error('[DASHBOARD] Erro ao calcular KPI Mês Anterior:', error);
      logEvent('DASHBOARD', 'WARN', 'getMainKPIs', 'Erro ao calcular mês anterior', error.stack);
    }

    // KPI 4: Tendências e comparações
    try {
      const curr = kpiData.currentMonth;
      const prev = kpiData.previousMonth;

      // Mudanças absolutas
      kpiData.trends.creditsChange = curr.credits - prev.credits;
      kpiData.trends.debitsChange = curr.debits - prev.debits;
      kpiData.trends.balanceChange = curr.balance - prev.balance;

      // Mudanças percentuais
      kpiData.trends.creditsChangePercent = prev.credits > 0 ? ((curr.credits - prev.credits) / prev.credits * 100) : 0;
      kpiData.trends.debitsChangePercent = prev.debits > 0 ? ((curr.debits - prev.debits) / prev.debits * 100) : 0;
      kpiData.trends.balanceChangePercent = prev.balance !== 0 ? ((curr.balance - prev.balance) / Math.abs(prev.balance) * 100) : 0;

      // Direção da tendência
      kpiData.trends.creditsTrend = kpiData.trends.creditsChange > 0 ? 'up' : kpiData.trends.creditsChange < 0 ? 'down' : 'stable';
      kpiData.trends.debitsTrend = kpiData.trends.debitsChange > 0 ? 'up' : kpiData.trends.debitsChange < 0 ? 'down' : 'stable';
      kpiData.trends.balanceTrend = kpiData.trends.balanceChange > 0 ? 'up' : kpiData.trends.balanceChange < 0 ? 'down' : 'stable';

      console.log('[DASHBOARD] Tendências calculadas');
    } catch (error) {
      console.error('[DASHBOARD] Erro ao calcular tendências:', error);
      logEvent('DASHBOARD', 'WARN', 'getMainKPIs', 'Erro ao calcular tendências', error.stack);
    }

    // KPI 5: Métricas profissionais
    try {
      const curr = kpiData.currentMonth;

      // Taxa de poupança (saving rate)
      kpiData.professional.savingsRate = curr.credits > 0 ? (curr.balance / curr.credits * 100) : 0;

      // Burn rate (gasto diário médio)
      kpiData.professional.avgDailyExpense = curr.daysElapsed > 0 ? (curr.debits / curr.daysElapsed) : 0;
      kpiData.professional.burnRate = kpiData.professional.avgDailyExpense;

      // Projeção de saldo no fim do mês
      const daysRemaining = curr.daysInMonth - curr.daysElapsed;
      const projectedDebits = curr.debits + (kpiData.professional.avgDailyExpense * daysRemaining);
      kpiData.professional.projectedBalance = curr.credits - projectedDebits;

      // Score de saúde financeira (0-100)
      let healthScore = 50; // Base
      if (curr.balance > 0) healthScore += 20;
      if (kpiData.professional.savingsRate > 10) healthScore += 15;
      if (kpiData.professional.savingsRate > 20) healthScore += 15;
      if (kpiData.trends.balanceTrend === 'up') healthScore += 10;
      if (kpiData.trends.debitsTrend === 'down') healthScore += 10;
      if (curr.balance < 0) healthScore -= 30;
      if (kpiData.trends.balanceTrend === 'down') healthScore -= 10;

      kpiData.professional.financialHealth = Math.max(0, Math.min(100, healthScore));

      console.log('[DASHBOARD] Métricas profissionais calculadas');
    } catch (error) {
      console.error('[DASHBOARD] Erro ao calcular métricas profissionais:', error);
      logEvent('DASHBOARD', 'WARN', 'getMainKPIs', 'Erro ao calcular métricas profissionais', error.stack);
    }

    // KPI 6: Débitos parcelados
    try {
      let totalInstallmentDebits = 0;
      let monthInstallmentDebits = 0;

      transactions.forEach(t => {
        if (t.type === 'debit' && t.isInstallment) {
          totalInstallmentDebits += (parseFloat(t.amount) || 0);

          if (t.date >= monthStart && t.date <= monthEnd) {
            monthInstallmentDebits += (parseFloat(t.amount) || 0);
          }
        }
      });

      kpiData.total.installmentDebits = totalInstallmentDebits;
      kpiData.currentMonth.installmentDebits = monthInstallmentDebits;

      console.log('[DASHBOARD] KPI Parcelamento - Total:', totalInstallmentDebits, 'Mês:', monthInstallmentDebits);
    } catch (error) {
      console.error('[DASHBOARD] Erro ao calcular KPI Parcelamento:', error);
      logEvent('DASHBOARD', 'WARN', 'getMainKPIs', 'Erro ao calcular débitos parcelados', error.stack);
    }

    return {
      success: true,
      message: 'KPIs obtidos com sucesso',
      data: kpiData
    };

  } catch (error) {
    console.error('[DASHBOARD] Erro em getMainKPIs:', error);
    logEvent('DASHBOARD', 'ERROR', 'getMainKPIs', 'Erro ao obter KPIs', error.stack);
    return {
      success: false,
      message: 'Erro ao obter KPIs: ' + error.message
    };
  }
}

function getEmptyKPIStructure() {
  const now = new Date();
  return {
    total: {
      credits: 0,
      debits: 0,
      balance: 0,
      transactionCount: 0,
      installmentDebits: 0,
      error: null
    },
    currentMonth: {
      credits: 0,
      debits: 0,
      balance: 0,
      transactionCount: 0,
      month: now.getMonth() + 1,
      year: now.getFullYear(),
      installmentDebits: 0,
      daysElapsed: now.getDate(),
      daysInMonth: new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate(),
      error: null
    },
    previousMonth: {
      credits: 0,
      debits: 0,
      balance: 0,
      transactionCount: 0
    },
    trends: {
      creditsChange: 0,
      creditsChangePercent: 0,
      debitsChange: 0,
      debitsChangePercent: 0,
      balanceChange: 0,
      balanceChangePercent: 0,
      creditsTrend: 'stable',
      debitsTrend: 'stable',
      balanceTrend: 'stable'
    },
    professional: {
      savingsRate: 0,
      burnRate: 0,
      projectedBalance: 0,
      avgDailyExpense: 0,
      financialHealth: 0
    }
  };
}

function getRecentTransactions(token, limit, preloadedTransactions) {
  try {
    console.log('[DASHBOARD] getRecentTransactions chamada, limit:', limit);
    
    if (!validateSession(token)) {
      return {
        success: false,
        message: 'Sessão inválida ou expirada'
      };
    }
    
    if (!limit || limit < 1) limit = 10;
    if (limit > 50) limit = 50;
    
    const transactionsResult = Array.isArray(preloadedTransactions)
      ? { success: true, data: preloadedTransactions }
      : queryTransactions(token, {});
    
    if (!transactionsResult || !transactionsResult.success) {
      console.log('[DASHBOARD] Erro ao listar transações recentes');
      return {
        success: true,
        message: 'Nenhuma transação encontrada',
        data: []
      };
    }
    
    const recent = transactionsResult.data.slice(0, limit);
    console.log('[DASHBOARD] Transações recentes:', recent.length);
    
    return {
      success: true,
      message: 'Transações recentes obtidas com sucesso',
      data: recent
    };
    
  } catch (error) {
    console.error('[DASHBOARD] Erro em getRecentTransactions:', error);
    logEvent('DASHBOARD', 'ERROR', 'getRecentTransactions', 'Erro ao obter transações recentes', error.stack);
    return {
      success: false,
      message: 'Erro ao obter transações recentes: ' + error.message
    };
  }
}

function getMonthlyEvolutionChart(token, preloadedTransactions) {
  try {
    console.log('[DASHBOARD] getMonthlyEvolutionChart chamada');
    
    if (!validateSession(token)) {
      return {
        success: false,
        message: 'Sessão inválida ou expirada'
      };
    }
    
    if (Array.isArray(preloadedTransactions)) {
      const now = new Date();
      const chartData = [];

      for (let i = 5; i >= 0; i--) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const year = date.getFullYear();
        const month = date.getMonth() + 1;
        const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
        const lastDay = new Date(year, month, 0).getDate();
        const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

        let credits = 0;
        let debits = 0;

        preloadedTransactions.forEach(t => {
          if (t.date >= startDate && t.date <= endDate) {
            if (t.type === 'credit') credits += (parseFloat(t.amount) || 0);
            else debits += (parseFloat(t.amount) || 0);
          }
        });

        chartData.push({
          month: getMonthNameShort(month) + '/' + year,
          year: year,
          monthNumber: month,
          credits: credits,
          debits: debits,
          balance: credits - debits
        });
      }

      console.log('[DASHBOARD] Dados do grÇ­fico:', chartData.length, 'meses');

      return {
        success: true,
        message: 'Dados do grÇ­fico obtidos com sucesso',
        data: chartData
      };
    }

    const now = new Date();
    const chartData = [];
    
    for (let i = 5; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const year = date.getFullYear();
      const month = date.getMonth() + 1;
      
      const monthReport = getMonthlyReport(token, year, month);
      
      if (monthReport && monthReport.success && monthReport.data) {
        chartData.push({
          month: getMonthNameShort(month) + '/' + year,
          year: year,
          monthNumber: month,
          credits: monthReport.data.summary.totalCredits || 0,
          debits: monthReport.data.summary.totalDebits || 0,
          balance: monthReport.data.summary.balance || 0
        });
      }
    }
    
    console.log('[DASHBOARD] Dados do gráfico:', chartData.length, 'meses');
    
    return {
      success: true,
      message: 'Dados do gráfico obtidos com sucesso',
      data: chartData
    };
    
  } catch (error) {
    console.error('[DASHBOARD] Erro em getMonthlyEvolutionChart:', error);
    logEvent('DASHBOARD', 'ERROR', 'getMonthlyEvolutionChart', 'Erro ao obter dados do gráfico', error.stack);
    return {
      success: false,
      message: 'Erro ao obter dados do gráfico: ' + error.message
    };
  }
}

function formatDateDash(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getMonthNameShort(month) {
  const months = [
    'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
    'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'
  ];
  return months[month - 1] || '';
}


/**
 * Gera insights financeiros automáticos baseados nos dados do usuário
 *
 * @param {string} token - Token de sessão
 * @returns {Object} Lista de insights com tipo, mensagem e nível de importância
 */
function getFinancialInsights(token, kpisResultOverride) {
  try {
    console.log('[DASHBOARD] getFinancialInsights chamada');

    if (!validateSession(token)) {
      return {
        success: false,
        message: 'Sessão inválida ou expirada',
        data: []
      };
    }

    const insights = [];

    // Obter KPIs
    const kpisResult = kpisResultOverride || getMainKPIs(token);
    if (!kpisResult || !kpisResult.success) {
      return {
        success: true,
        message: 'Sem dados suficientes para insights',
        data: []
      };
    }

    const kpis = kpisResult.data;
    const curr = kpis.currentMonth;
    const prev = kpis.previousMonth;
    const trends = kpis.trends;
    const prof = kpis.professional;

    // Insight 1: Saldo mensal
    if (curr.balance > 0) {
      insights.push({
        type: 'success',
        icon: '🎉',
        title: 'Saldo Positivo',
        message: `Parabéns! Você economizou ${formatCurrency(curr.balance)} este mês.`,
        importance: 'high'
      });
    } else if (curr.balance < 0) {
      insights.push({
        type: 'warning',
        icon: '⚠️',
        title: 'Atenção ao Saldo',
        message: `Suas despesas superaram as receitas em ${formatCurrency(Math.abs(curr.balance))} este mês.`,
        importance: 'high'
      });
    }

    // Insight 2: Tendência de gastos
    if (trends.debitsChangePercent > 20) {
      insights.push({
        type: 'alert',
        icon: '📈',
        title: 'Gastos em Alta',
        message: `Seus gastos aumentaram ${Math.abs(trends.debitsChangePercent).toFixed(1)}% comparado ao mês anterior.`,
        importance: 'high'
      });
    } else if (trends.debitsChangePercent < -10) {
      insights.push({
        type: 'success',
        icon: '📉',
        title: 'Redução de Gastos',
        message: `Excelente! Você reduziu seus gastos em ${Math.abs(trends.debitsChangePercent).toFixed(1)}% este mês.`,
        importance: 'medium'
      });
    }

    // Insight 3: Taxa de poupança
    if (prof.savingsRate > 20) {
      insights.push({
        type: 'success',
        icon: '💰',
        title: 'Excelente Poupança',
        message: `Sua taxa de poupança está em ${prof.savingsRate.toFixed(1)}% - acima da recomendação de 20%.`,
        importance: 'medium'
      });
    } else if (prof.savingsRate > 0 && prof.savingsRate <= 20) {
      insights.push({
        type: 'info',
        icon: '💡',
        title: 'Meta de Poupança',
        message: `Sua taxa de poupança é ${prof.savingsRate.toFixed(1)}%. Tente alcançar 20% para melhor segurança financeira.`,
        importance: 'low'
      });
    } else if (prof.savingsRate <= 0) {
      insights.push({
        type: 'warning',
        icon: '⚠️',
        title: 'Sem Poupança',
        message: `Você não conseguiu poupar este mês. Revise seus gastos para criar uma reserva.`,
        importance: 'high'
      });
    }

    // Insight 4: Projeção de fim de mês
    if (curr.daysElapsed >= 5) {
      if (prof.projectedBalance < 0 && curr.balance > 0) {
        insights.push({
          type: 'warning',
          icon: '🔮',
          title: 'Projeção de Déficit',
          message: `Com base no ritmo atual de gastos, você pode terminar o mês com saldo negativo de ${formatCurrency(Math.abs(prof.projectedBalance))}.`,
          importance: 'high'
        });
      } else if (prof.projectedBalance > curr.balance * 0.8) {
        insights.push({
          type: 'success',
          icon: '🎯',
          title: 'Projeção Positiva',
          message: `Mantendo este ritmo, você pode economizar ${formatCurrency(prof.projectedBalance)} até o fim do mês.`,
          importance: 'medium'
        });
      }
    }

    // Insight 5: Burn rate
    if (prof.burnRate > 0) {
      const daysWithCurrentBalance = curr.balance > 0 ? Math.floor(curr.balance / prof.burnRate) : 0;
      if (daysWithCurrentBalance > 0 && daysWithCurrentBalance < 10) {
        insights.push({
          type: 'alert',
          icon: '🔥',
          title: 'Velocidade de Gasto Alta',
          message: `Com seu gasto diário médio de ${formatCurrency(prof.burnRate)}, seu saldo atual duraria apenas ${daysWithCurrentBalance} dias.`,
          importance: 'high'
        });
      } else if (prof.burnRate > 0) {
        insights.push({
          type: 'info',
          icon: '📊',
          title: 'Gasto Diário',
          message: `Seu gasto médio diário é de ${formatCurrency(prof.burnRate)}.`,
          importance: 'low'
        });
      }
    }

    // Insight 6: Comparação de entradas
    if (trends.creditsChangePercent > 15) {
      insights.push({
        type: 'success',
        icon: '💵',
        title: 'Receitas em Alta',
        message: `Suas receitas aumentaram ${trends.creditsChangePercent.toFixed(1)}% em relação ao mês anterior.`,
        importance: 'medium'
      });
    } else if (trends.creditsChangePercent < -15) {
      insights.push({
        type: 'warning',
        icon: '📉',
        title: 'Queda nas Receitas',
        message: `Suas receitas caíram ${Math.abs(trends.creditsChangePercent).toFixed(1)}% comparado ao mês anterior.`,
        importance: 'high'
      });
    }

    // Insight 7: Saúde financeira
    if (prof.financialHealth >= 80) {
      insights.push({
        type: 'success',
        icon: '🌟',
        title: 'Saúde Financeira Excelente',
        message: `Sua saúde financeira está em ${prof.financialHealth}/100. Continue assim!`,
        importance: 'medium'
      });
    } else if (prof.financialHealth >= 60) {
      insights.push({
        type: 'info',
        icon: '👍',
        title: 'Saúde Financeira Boa',
        message: `Sua saúde financeira está em ${prof.financialHealth}/100. Há espaço para melhorias.`,
        importance: 'low'
      });
    } else if (prof.financialHealth < 40) {
      insights.push({
        type: 'alert',
        icon: '🚨',
        title: 'Atenção: Saúde Financeira Baixa',
        message: `Sua saúde financeira está em ${prof.financialHealth}/100. É importante revisar seus gastos.`,
        importance: 'high'
      });
    }

    // Insight 8: Parcelas futuras
    const upcomingResult = getUpcomingInstallments(token, 1);
    if (upcomingResult && upcomingResult.success && upcomingResult.count > 0) {
      const totalUpcoming = upcomingResult.data.reduce((sum, group) => sum + group.totalAmount, 0);
      insights.push({
        type: 'info',
        icon: '📅',
        title: 'Parcelas no Próximo Mês',
        message: `Você tem ${upcomingResult.count} grupo(s) de parcelas totalizando ${formatCurrency(totalUpcoming)} vencendo no próximo mês.`,
        importance: 'medium'
      });
    }

    // Ordenar por importância
    const importanceOrder = { 'high': 1, 'medium': 2, 'low': 3 };
    insights.sort((a, b) => importanceOrder[a.importance] - importanceOrder[b.importance]);

    console.log('[DASHBOARD] Insights gerados:', insights.length);

    return {
      success: true,
      message: `${insights.length} insights gerados`,
      data: insights,
      count: insights.length
    };

  } catch (error) {
    console.error('[DASHBOARD] Erro em getFinancialInsights:', error);
    logEvent('DASHBOARD', 'ERROR', 'getFinancialInsights', 'Erro ao gerar insights', error.stack);
    return {
      success: false,
      message: 'Erro ao gerar insights: ' + error.message,
      data: []
    };
  }
}

function formatCurrency(value) {
  return 'R$ ' + value.toFixed(2).replace('.', ',').replace(/(\d)(?=(\d{3})+\,)/g, '$1.');
}

/**
 * =============================================================================
 * FUNÇÕES DE PARCELAMENTO - DASHBOARD
 * =============================================================================
 */

/**
 * Obtém parcelas a vencer nos próximos N meses
 * 
 * @param {string} token - Token de sessão
 * @param {number} months - Número de meses futuros (padrão: 3)
 * @returns {Object} Lista de parcelas agrupadas
 */
function getUpcomingInstallments(token, months, preloadedTransactions) {
  try {
    console.log('[DASHBOARD] getUpcomingInstallments chamada, months:', months);
    
    if (!validateSession(token)) {
      return {
        success: false,
        message: 'Sessão inválida ou expirada',
        data: []
      };
    }
    
    if (!months || months < 1) months = 3;
    if (months > 12) months = 12;
    
    const today = new Date();
    const futureDate = new Date();
    futureDate.setMonth(today.getMonth() + months);
    
    const todayStr = formatDateDash(today);
    const futureStr = formatDateDash(futureDate);
    
    console.log('[DASHBOARD] Buscando parcelas entre', todayStr, 'e', futureStr);
    
    const transactionsResult = Array.isArray(preloadedTransactions)
      ? { success: true, data: preloadedTransactions.filter(t => t.date >= todayStr && t.date <= futureStr) }
      : queryTransactions(token, {
        startDate: todayStr,
        endDate: futureStr
      });
    
    if (!transactionsResult || !transactionsResult.success) {
      console.log('[DASHBOARD] Erro ao buscar parcelas futuras');
      return {
        success: true,
        message: 'Nenhuma parcela futura encontrada',
        data: []
      };
    }
    
    const transactions = transactionsResult.data || [];
    
    // Filtrar apenas parcelas (que têm parentTransactionId)
    const installments = transactions.filter(t => 
      t.type === 'debit' && t.parentTransactionId && t.parentTransactionId !== ''
    );
    
    console.log('[DASHBOARD] Parcelas futuras encontradas:', installments.length);
    
    // Agrupar por parentTransactionId
    const grouped = {};
    
    installments.forEach(t => {
      const parentId = t.parentTransactionId;
      
      if (!grouped[parentId]) {
        grouped[parentId] = {
          parentId: parentId,
          description: t.description.replace(/\s*\(\d+\/\d+\)$/, ''),
          category: t.category,
          paymentMethod: t.paymentMethod,
          installments: t.installments,
          totalAmount: 0,
          paidAmount: 0,
          remainingAmount: 0,
          nextInstallments: []
        };
      }
      
      grouped[parentId].totalAmount += t.amount;
      grouped[parentId].nextInstallments.push({
        id: t.id,
        date: t.date,
        amount: t.amount,
        installmentNumber: t.installmentNumber
      });
    });
    
    // Converter para array e ordenar próximas parcelas
    const result = Object.values(grouped).map(group => {
      group.nextInstallments.sort((a, b) => {
        if (a.date < b.date) return -1;
        if (a.date > b.date) return 1;
        return 0;
      });
      return group;
    });
    
    // Ordenar grupos pela data da próxima parcela
    result.sort((a, b) => {
      const dateA = a.nextInstallments[0] ? a.nextInstallments[0].date : '9999-12-31';
      const dateB = b.nextInstallments[0] ? b.nextInstallments[0].date : '9999-12-31';
      if (dateA < dateB) return -1;
      if (dateA > dateB) return 1;
      return 0;
    });
    
    console.log('[DASHBOARD] Grupos de parcelas:', result.length);
    
    return {
      success: true,
      message: result.length + ' grupos de parcelas encontrados',
      data: result,
      count: result.length
    };
    
  } catch (error) {
    console.error('[DASHBOARD] Erro em getUpcomingInstallments:', error);
    logEvent('DASHBOARD', 'ERROR', 'getUpcomingInstallments', 'Erro ao buscar parcelas futuras', error.stack);
    return {
      success: false,
      message: 'Erro ao buscar parcelas futuras: ' + error.message,
      data: []
    };
  }
}

/**
 * Obtém distribuição de gastos por forma de pagamento
 * 
 * @param {string} token - Token de sessão
 * @param {string} startDate - Data inicial (YYYY-MM-DD)
 * @param {string} endDate - Data final (YYYY-MM-DD)
 * @returns {Object} Distribuição por forma de pagamento
 */
function getPaymentMethodDistribution(token, startDate, endDate) {
  try {
    console.log('[DASHBOARD] getPaymentMethodDistribution chamada');
    
    if (!validateSession(token)) {
      return {
        success: false,
        message: 'Sessão inválida ou expirada',
        data: []
      };
    }
    
    // Se não forneceu datas, usa mês atual
    if (!startDate || !endDate) {
      const now = new Date();
      const year = now.getFullYear();
      const month = now.getMonth() + 1;
      startDate = `${year}-${String(month).padStart(2, '0')}-01`;
      endDate = formatDateDash(now);
    }
    
    console.log('[DASHBOARD] Período:', startDate, 'a', endDate);
    
    const transactionsResult = queryTransactions(token, {
      startDate: startDate,
      endDate: endDate,
      type: 'debit'  // Apenas débitos
    });
    
    if (!transactionsResult || !transactionsResult.success) {
      console.log('[DASHBOARD] Erro ao buscar transações para distribuição');
      return {
        success: true,
        message: 'Nenhuma transação encontrada',
        data: []
      };
    }
    
    const transactions = transactionsResult.data || [];
    
    // Agrupar por forma de pagamento
    const distribution = {};
    
    transactions.forEach(t => {
      const method = t.paymentMethod || 'Outros';
      
      if (!distribution[method]) {
        distribution[method] = {
          paymentMethod: method,
          amount: 0,
          count: 0,
          percentage: 0
        };
      }
      
      distribution[method].amount += t.amount;
      distribution[method].count++;
    });
    
    // Calcular total para percentuais
    const total = Object.values(distribution).reduce((sum, item) => sum + item.amount, 0);
    
    // Calcular percentuais
    Object.values(distribution).forEach(item => {
      item.percentage = total > 0 ? Math.round((item.amount / total) * 100) : 0;
    });
    
    // Converter para array e ordenar por valor
    const result = Object.values(distribution).sort((a, b) => b.amount - a.amount);
    
    console.log('[DASHBOARD] Distribuição por forma de pagamento:', result.length, 'métodos');
    
    return {
      success: true,
      message: 'Distribuição obtida com sucesso',
      data: result,
      total: total,
      count: result.length
    };
    
  } catch (error) {
    console.error('[DASHBOARD] Erro em getPaymentMethodDistribution:', error);
    logEvent('DASHBOARD', 'ERROR', 'getPaymentMethodDistribution', 'Erro ao obter distribuição', error.stack);
    return {
      success: false,
      message: 'Erro ao obter distribuição: ' + error.message,
      data: []
    };
  }
}

/**
 * Obtém estatísticas de parcelamento
 * 
 * @param {string} token - Token de sessão
 * @returns {Object} Estatísticas sobre transações parceladas
 */
function getInstallmentStats(token) {
  try {
    console.log('[DASHBOARD] getInstallmentStats chamada');
    
    if (!validateSession(token)) {
      return {
        success: false,
        message: 'Sessão inválida ou expirada'
      };
    }
    
    const transactionsResult = queryTransactions(token, {});
    
    if (!transactionsResult || !transactionsResult.success) {
      return {
        success: true,
        message: 'Nenhuma transação encontrada',
        data: {
          totalInstallmentGroups: 0,
          totalInstallments: 0,
          totalInstallmentAmount: 0,
          averageInstallments: 0,
          mostUsedPaymentMethod: 'Nenhum'
        }
      };
    }
    
    const transactions = transactionsResult.data || [];
    
    // Filtrar transações parceladas
    const installmentTransactions = transactions.filter(t => 
      t.parentTransactionId && t.parentTransactionId !== ''
    );
    
    if (installmentTransactions.length === 0) {
      return {
        success: true,
        message: 'Nenhuma transação parcelada encontrada',
        data: {
          totalInstallmentGroups: 0,
          totalInstallments: 0,
          totalInstallmentAmount: 0,
          averageInstallments: 0,
          mostUsedPaymentMethod: 'Nenhum'
        }
      };
    }
    
    // Contar grupos únicos
    const uniqueParentIds = new Set(installmentTransactions.map(t => t.parentTransactionId));
    const totalGroups = uniqueParentIds.size;
    
    // Calcular totais
    const totalAmount = installmentTransactions.reduce((sum, t) => sum + t.amount, 0);
    
    // Calcular média de parcelas
    const totalInstallmentsSum = installmentTransactions.reduce((sum, t) => sum + (t.installments || 1), 0);
    const averageInstallments = totalInstallmentsSum / installmentTransactions.length;
    
    // Forma de pagamento mais usada
    const paymentMethods = {};
    installmentTransactions.forEach(t => {
      const method = t.paymentMethod || 'Outros';
      paymentMethods[method] = (paymentMethods[method] || 0) + 1;
    });
    
    let mostUsedMethod = 'Nenhum';
    let maxCount = 0;
    
    Object.entries(paymentMethods).forEach(([method, count]) => {
      if (count > maxCount) {
        maxCount = count;
        mostUsedMethod = method;
      }
    });
    
    console.log('[DASHBOARD] Stats - Grupos:', totalGroups, 'Parcelas:', installmentTransactions.length);
    
    return {
      success: true,
      message: 'Estatísticas obtidas com sucesso',
      data: {
        totalInstallmentGroups: totalGroups,
        totalInstallments: installmentTransactions.length,
        totalInstallmentAmount: totalAmount,
        averageInstallments: Math.round(averageInstallments * 10) / 10,
        mostUsedPaymentMethod: mostUsedMethod
      }
    };
    
  } catch (error) {
    console.error('[DASHBOARD] Erro em getInstallmentStats:', error);
    logEvent('DASHBOARD', 'ERROR', 'getInstallmentStats', 'Erro ao obter estatísticas', error.stack);
    return {
      success: false,
      message: 'Erro ao obter estatísticas: ' + error.message
    };
  }
}

/**
 * Retorna dados consolidados do dashboard para reduzir round-trips do frontend
 *
 * @param {string} token
 * @returns {Object}
 */
function getDashboardBundle(token) {
  try {
    if (!validateSession(token)) {
      return { success: false, message: 'Sessão inválida ou expirada' };
    }

    const txVersion = getUserDataVersion('transactions');
    const todayStr = formatDateDash(new Date());
    const cacheKey = makeCacheKey(`dashboard_bundle_v${txVersion}`, { today: todayStr });

    return getCachedData(cacheKey, function() {
      const txResult = queryTransactions(token, {});
      if (!txResult || !txResult.success) {
        return { success: false, message: txResult ? txResult.message : 'Erro ao carregar transações' };
      }

      const transactions = txResult.data || [];
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth() + 1;
      const monthStart = `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`;

      const kpisResult = getMainKPIs(token, transactions);
      const recentResult = getRecentTransactions(token, 10, transactions);
      const evolutionResult = getMonthlyEvolutionChart(token, transactions);
      const insightsResult = getFinancialInsights(token, kpisResult);
      const upcomingResult = getUpcomingInstallments(token, 1, transactions);

      function computeTopCategoriesFromTransactions(transactionsList, type, limit, startDate, endDate) {
        let list = Array.isArray(transactionsList) ? transactionsList : [];
        if (startDate) list = list.filter(t => t.date >= startDate);
        if (endDate) list = list.filter(t => t.date <= endDate);
        if (type) list = list.filter(t => t.type === type);

        const byCategory = {};
        list.forEach(t => {
          const category = t.category || 'Sem categoria';
          if (!byCategory[category]) {
            byCategory[category] = { category: category, type: t.type, total: 0, count: 0 };
          }
          byCategory[category].total += (parseFloat(t.amount) || 0);
          byCategory[category].count += 1;
        });

        const items = Object.values(byCategory).sort((a, b) => b.total - a.total);
        return items.slice(0, Math.min(Math.max(limit || 5, 1), 20));
      }

      const topCategoriesMonth = computeTopCategoriesFromTransactions(transactions, null, 5, monthStart, todayStr);
      const topCategoriesAll = computeTopCategoriesFromTransactions(transactions, null, 10);

      return {
        success: true,
        message: 'Dashboard carregado com sucesso',
        data: {
          kpis: (kpisResult && kpisResult.data) ? kpisResult.data : {},
          recentTransactions: (recentResult && recentResult.data) ? recentResult.data : [],
          topCategories: topCategoriesMonth,
          topCategoriesMonth: topCategoriesMonth,
          topCategoriesAll: topCategoriesAll,
          evolutionChart: (evolutionResult && evolutionResult.data) ? evolutionResult.data : [],
          insights: (insightsResult && insightsResult.data) ? insightsResult.data : [],
          upcomingInstallments: (upcomingResult && upcomingResult.data) ? upcomingResult.data : []
        }
      };
    }, 120);

  } catch (error) {
    console.error('[DASHBOARD] Erro em getDashboardBundle:', error);
    logEvent('DASHBOARD', 'ERROR', 'getDashboardBundle', 'Erro ao carregar bundle', error.stack);
    return { success: false, message: 'Erro ao carregar dashboard: ' + error.message };
  }
}

/**
 * Bundle inicial (dashboard + categorias) para reduzir chamadas no load
 *
 * @param {string} token
 * @returns {Object}
 */
function getInitialBundle(token) {
  try {
    if (!validateSession(token)) {
      return { success: false, message: 'Sessão inválida ou expirada' };
    }

    const dashboard = getDashboardBundle(token);
    const categories = listCategories(token, {});

    return {
      success: true,
      message: 'Dados iniciais carregados',
      data: {
        dashboard: (dashboard && dashboard.success) ? dashboard.data : null,
        categories: (categories && categories.success) ? categories.data : []
      }
    };
  } catch (error) {
    console.error('[DASHBOARD] Erro em getInitialBundle:', error);
    return { success: false, message: 'Erro ao carregar dados iniciais: ' + error.message };
  }
}
