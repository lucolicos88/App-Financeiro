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

function getMainKPIs(token) {
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
    const transactionsResult = listTransactions(token, {});
    console.log('[DASHBOARD] Resultado de listTransactions:', transactionsResult ? 'OK' : 'NULL');
    
    if (!transactionsResult || !transactionsResult.success) {
      console.log('[DASHBOARD] Erro ao listar transações para KPIs');
      return {
        success: false,
        message: 'Erro ao obter transações',
        data: {
          total: {
            credits: 0,
            debits: 0,
            balance: 0,
            transactionCount: 0
          },
          currentMonth: {
            credits: 0,
            debits: 0,
            balance: 0,
            transactionCount: 0,
            month: new Date().getMonth() + 1,
            year: new Date().getFullYear()
          }
        }
      };
    }
    
    const transactions = transactionsResult.data || [];
    console.log('[DASHBOARD] Total de transações para KPIs:', transactions.length);
    
    let totalCredits = 0;
    let totalDebits = 0;
    
    transactions.forEach(t => {
      if (t.type === 'credit') {
        totalCredits += t.amount;
      } else {
        totalDebits += t.amount;
      }
    });
    
    const totalBalance = totalCredits - totalDebits;
    
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    const monthStart = `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`;
    const monthEnd = formatDateDash(now);
    
    let monthCredits = 0;
    let monthDebits = 0;
    let monthCount = 0;
    
    transactions.forEach(t => {
      if (t.date >= monthStart && t.date <= monthEnd) {
        if (t.type === 'credit') {
          monthCredits += t.amount;
        } else {
          monthDebits += t.amount;
        }
        monthCount++;
      }
    });
    
    const monthBalance = monthCredits - monthDebits;
    
    console.log('[DASHBOARD] KPIs calculados - Total:', totalBalance, 'Mês:', monthBalance);
    
    // ============================================================
    // INÍCIO DO CÓDIGO NOVO - Separar débitos parcelados
    // ============================================================
    let totalInstallmentDebits = 0;
    let monthInstallmentDebits = 0;

    transactions.forEach(t => {
      if (t.type === 'debit' && t.isInstallment) {
        totalInstallmentDebits += t.amount;
        
        if (t.date >= monthStart && t.date <= monthEnd) {
          monthInstallmentDebits += t.amount;
        }
      }
    });

    console.log('[DASHBOARD] Débitos parcelados - Total:', totalInstallmentDebits, 'Mês:', monthInstallmentDebits);
    // ============================================================
    // FIM DO CÓDIGO NOVO
    // ============================================================
    
    return {
      success: true,
      message: 'KPIs obtidos com sucesso',
      data: {
        total: {
          credits: totalCredits,
          debits: totalDebits,
          balance: totalBalance,
          transactionCount: transactions.length,
          installmentDebits: totalInstallmentDebits  // ← NOVO
        },
        currentMonth: {
          credits: monthCredits,
          debits: monthDebits,
          balance: monthBalance,
          transactionCount: monthCount,
          month: currentMonth,
          year: currentYear,
          installmentDebits: monthInstallmentDebits  // ← NOVO
        }
      }
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

function getRecentTransactions(token, limit) {
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
    
    const transactionsResult = listTransactions(token, {});
    
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

function getMonthlyEvolutionChart(token) {
  try {
    console.log('[DASHBOARD] getMonthlyEvolutionChart chamada');
    
    if (!validateSession(token)) {
      return {
        success: false,
        message: 'Sessão inválida ou expirada'
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
function getUpcomingInstallments(token, months) {
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
    
    const transactionsResult = listTransactions(token, {
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
    
    const transactionsResult = listTransactions(token, {
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
    
    const transactionsResult = listTransactions(token, {});
    
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