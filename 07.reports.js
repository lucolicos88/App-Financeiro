/**
 * =============================================================================
 * REPORTS.GS - Módulo de Relatórios e Análises
 * =============================================================================
 *
 * Responsável por gerar relatórios e análises financeiras:
 * - Relatório por período (entradas, saídas, saldo)
 * - Relatório por categoria
 * - Análise mensal
 * - Top categorias
 * - Evolução do saldo
 * - Comparativos entre períodos
 *
 * Todos os relatórios requerem autenticação válida.
 * =============================================================================
 */

/**
 * Valida período de datas para relatórios
 *
 * @param {string} startDate - Data inicial (YYYY-MM-DD)
 * @param {string} endDate - Data final (YYYY-MM-DD)
 * @param {boolean} allowFuture - Permite datas futuras (padrão: false)
 * @returns {Object} { valid: boolean, message: string }
 */
function validateDateRange(startDate, endDate, allowFuture) {
  allowFuture = allowFuture || false;

  // Verifica se datas foram fornecidas
  if (!startDate || typeof startDate !== 'string') {
    return { valid: false, message: 'Data inicial é obrigatória' };
  }

  if (!endDate || typeof endDate !== 'string') {
    return { valid: false, message: 'Data final é obrigatória' };
  }

  // Valida formato YYYY-MM-DD
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

  if (!dateRegex.test(startDate)) {
    return { valid: false, message: 'Data inicial deve estar no formato YYYY-MM-DD' };
  }

  if (!dateRegex.test(endDate)) {
    return { valid: false, message: 'Data final deve estar no formato YYYY-MM-DD' };
  }

  // Valida se são datas válidas
  const start = new Date(startDate);
  const end = new Date(endDate);

  if (isNaN(start.getTime())) {
    return { valid: false, message: 'Data inicial inválida' };
  }

  if (isNaN(end.getTime())) {
    return { valid: false, message: 'Data final inválida' };
  }

  // Verifica se data inicial é anterior ou igual à final
  if (start > end) {
    return { valid: false, message: 'Data inicial deve ser anterior ou igual à data final' };
  }

  // Verifica datas futuras (se não permitido)
  if (!allowFuture) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (start > today) {
      return { valid: false, message: 'Data inicial não pode ser futura' };
    }

    if (end > today) {
      return { valid: false, message: 'Data final não pode ser futura' };
    }
  }

  // Verifica se o período não é muito longo (máximo 10 anos)
  const maxDays = 3650; // 10 anos
  const diffTime = Math.abs(end - start);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays > maxDays) {
    return { valid: false, message: `Período máximo permitido é de ${maxDays} dias (10 anos)` };
  }

  return { valid: true, message: 'OK' };
}

/**
 * Gera relatório por período
 *
 * @param {string} token - Token de sessão
 * @param {string} startDate - Data inicial (YYYY-MM-DD)
 * @param {string} endDate - Data final (YYYY-MM-DD)
 * @returns {Object} Resultado com dados do relatório
 */
function getReportByPeriod(token, startDate, endDate) {
  try {
    // Valida sessão
    if (!validateSession(token)) {
      return {
        success: false,
        message: 'Sessão inválida ou expirada'
      };
    }

    // Valida período de datas
    const dateValidation = validateDateRange(startDate, endDate, false);
    if (!dateValidation.valid) {
      return {
        success: false,
        message: dateValidation.message
      };
    }
    
    // Obtém transações do período
    const transactionsResult = queryTransactions(token, {
      startDate: startDate,
      endDate: endDate
    });
    
    if (!transactionsResult.success) {
      return transactionsResult;
    }
    
    const transactions = transactionsResult.data;
    
    // Calcula totais
    let totalCredits = 0;
    let totalDebits = 0;
    
    transactions.forEach(t => {
      if (t.type === 'credit') {
        totalCredits += t.amount;
      } else if (t.type === 'debit') {
        totalDebits += t.amount;
      }
    });
    
    const balance = totalCredits - totalDebits;
    
    // Agrupa por categoria
    const byCategory = {};
    
    transactions.forEach(t => {
      if (!byCategory[t.category]) {
        byCategory[t.category] = {
          category: t.category,
          type: t.type,
          total: 0,
          count: 0
        };
      }
      byCategory[t.category].total += t.amount;
      byCategory[t.category].count += 1;
    });
    
    // Converte para array e ordena por valor
    const categoryData = Object.values(byCategory).sort((a, b) => b.total - a.total);
    
    return {
      success: true,
      message: 'Relatório gerado com sucesso',
      data: {
        period: {
          startDate: startDate,
          endDate: endDate
        },
        summary: {
          totalCredits: totalCredits,
          totalDebits: totalDebits,
          balance: balance,
          transactionCount: transactions.length
        },
        byCategory: categoryData,
        transactions: transactions
      }
    };
    
  } catch (error) {
    logEvent('REPORTS', 'ERROR', 'getReportByPeriod', 'Erro ao gerar relatório', error.stack);
    return {
      success: false,
      message: 'Erro ao gerar relatório: ' + error.message
    };
  }
}

/**
 * Gera relatório mensal
 * 
 * @param {string} token - Token de sessão
 * @param {number} year - Ano
 * @param {number} month - Mês (1-12)
 * @returns {Object} Resultado com dados do relatório
 */
function getMonthlyReport(token, year, month) {
  try {
    // Valida sessão
    if (!validateSession(token)) {
      return {
        success: false,
        message: 'Sessão inválida ou expirada'
      };
    }
    
    // Valida ano e mês
    if (!year || !month || month < 1 || month > 12) {
      return {
        success: false,
        message: 'Ano e mês inválidos'
      };
    }
    
    // Calcula primeiro e último dia do mês
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    
    // Gera relatório do período
    return getReportByPeriod(token, startDate, endDate);
    
  } catch (error) {
    logEvent('REPORTS', 'ERROR', 'getMonthlyReport', 'Erro ao gerar relatório mensal', error.stack);
    return {
      success: false,
      message: 'Erro ao gerar relatório mensal: ' + error.message
    };
  }
}

/**
 * Gera relatório anual
 * 
 * @param {string} token - Token de sessão
 * @param {number} year - Ano
 * @returns {Object} Resultado com dados do relatório
 */
function getAnnualReport(token, year) {
  try {
    // Valida sessão
    if (!validateSession(token)) {
      return {
        success: false,
        message: 'Sessão inválida ou expirada'
      };
    }
    
    // Valida ano
    if (!year || year < 2000 || year > 2100) {
      return {
        success: false,
        message: 'Ano inválido'
      };
    }
    
    // Calcula datas
    const startDate = `${year}-01-01`;
    const endDate = `${year}-12-31`;
    
    // Obtém relatório do período
    const periodReport = getReportByPeriod(token, startDate, endDate);
    
    if (!periodReport.success) {
      return periodReport;
    }
    
    // Agrupa por mês
    const byMonth = {};
    
    for (let month = 1; month <= 12; month++) {
      const monthKey = String(month).padStart(2, '0');
      byMonth[monthKey] = {
        month: month,
        monthName: getMonthName(month),
        totalCredits: 0,
        totalDebits: 0,
        balance: 0,
        transactionCount: 0
      };
    }
    
    // Agrupa transações por mês
    periodReport.data.transactions.forEach(t => {
      const month = t.date.substring(5, 7);
      
      if (byMonth[month]) {
        if (t.type === 'credit') {
          byMonth[month].totalCredits += t.amount;
        } else {
          byMonth[month].totalDebits += t.amount;
        }
        byMonth[month].transactionCount += 1;
      }
    });
    
    // Calcula balanços
    Object.values(byMonth).forEach(m => {
      m.balance = m.totalCredits - m.totalDebits;
    });
    
    return {
      success: true,
      message: 'Relatório anual gerado com sucesso',
      data: {
        year: year,
        summary: periodReport.data.summary,
        byMonth: Object.values(byMonth),
        byCategory: periodReport.data.byCategory
      }
    };
    
  } catch (error) {
    logEvent('REPORTS', 'ERROR', 'getAnnualReport', 'Erro ao gerar relatório anual', error.stack);
    return {
      success: false,
      message: 'Erro ao gerar relatório anual: ' + error.message
    };
  }
}

/**
 * Gera relatório por categoria
 * 
 * @param {string} token - Token de sessão
 * @param {string} category - Nome da categoria
 * @param {string} startDate - Data inicial (opcional)
 * @param {string} endDate - Data final (opcional)
 * @returns {Object} Resultado com dados do relatório
 */
function getReportByCategory(token, category, startDate, endDate) {
  try {
    // Valida sessão
    if (!validateSession(token)) {
      return {
        success: false,
        message: 'Sessão inválida ou expirada'
      };
    }

    // Valida categoria
    if (!category || typeof category !== 'string' || category.trim().length === 0) {
      return {
        success: false,
        message: 'Categoria é obrigatória'
      };
    }

    // Valida datas se ambas forem fornecidas
    if (startDate && endDate) {
      const dateValidation = validateDateRange(startDate, endDate, false);
      if (!dateValidation.valid) {
        return {
          success: false,
          message: dateValidation.message
        };
      }
    }

    // Monta filtros
    const filters = { category: category };
    if (startDate) filters.startDate = startDate;
    if (endDate) filters.endDate = endDate;
    
    // Obtém transações da categoria
    const transactionsResult = queryTransactions(token, filters);
    
    if (!transactionsResult.success) {
      return transactionsResult;
    }
    
    const transactions = transactionsResult.data;
    
    // Calcula estatísticas
    let total = 0;
    let min = Infinity;
    let max = -Infinity;
    
    transactions.forEach(t => {
      total += t.amount;
      if (t.amount < min) min = t.amount;
      if (t.amount > max) max = t.amount;
    });
    
    const average = transactions.length > 0 ? total / transactions.length : 0;
    
    return {
      success: true,
      message: 'Relatório por categoria gerado com sucesso',
      data: {
        category: category,
        period: {
          startDate: startDate || 'início',
          endDate: endDate || 'hoje'
        },
        statistics: {
          total: total,
          average: average,
          min: min === Infinity ? 0 : min,
          max: max === -Infinity ? 0 : max,
          count: transactions.length
        },
        transactions: transactions
      }
    };
    
  } catch (error) {
    logEvent('REPORTS', 'ERROR', 'getReportByCategory', 'Erro ao gerar relatório por categoria', error.stack);
    return {
      success: false,
      message: 'Erro ao gerar relatório por categoria: ' + error.message
    };
  }
}

/**
 * Obtém top categorias por valor
 * 
 * @param {string} token - Token de sessão
 * @param {string} type - Tipo (debit ou credit)
 * @param {number} limit - Limite de resultados (padrão 5)
 * @param {string} startDate - Data inicial (opcional)
 * @param {string} endDate - Data final (opcional)
 * @returns {Object} Resultado com top categorias
 */
function getTopCategories(token, type, limit, startDate, endDate) {
  try {
    // Valida sessão
    if (!validateSession(token)) {
      return {
        success: false,
        message: 'Sessão inválida ou expirada'
      };
    }
    
    // Define limite padrão
    if (!limit || limit < 1) limit = 5;
    if (limit > 20) limit = 20;
    
    // Monta filtros
    const filters = {};
    if (type) filters.type = type;
    if (startDate) filters.startDate = startDate;
    if (endDate) filters.endDate = endDate;
    
    // Obtém transações
    const transactionsResult = queryTransactions(token, filters);
    
    if (!transactionsResult.success) {
      return transactionsResult;
    }
    
    const transactions = transactionsResult.data;
    
    // Agrupa por categoria
    const byCategory = {};
    
    transactions.forEach(t => {
      if (!byCategory[t.category]) {
        byCategory[t.category] = {
          category: t.category,
          type: t.type,
          total: 0,
          count: 0
        };
      }
      byCategory[t.category].total += t.amount;
      byCategory[t.category].count += 1;
    });
    
    // Converte para array, ordena e limita
    const topCategories = Object.values(byCategory)
      .sort((a, b) => b.total - a.total)
      .slice(0, limit);
    
    return {
      success: true,
      message: 'Top categorias obtidas com sucesso',
      data: topCategories
    };
    
  } catch (error) {
    logEvent('REPORTS', 'ERROR', 'getTopCategories', 'Erro ao obter top categorias', error.stack);
    return {
      success: false,
      message: 'Erro ao obter top categorias: ' + error.message
    };
  }
}

/**
 * Calcula evolução do saldo ao longo do tempo
 * 
 * @param {string} token - Token de sessão
 * @param {string} startDate - Data inicial
 * @param {string} endDate - Data final
 * @returns {Object} Resultado com evolução do saldo
 */
function getBalanceEvolution(token, startDate, endDate) {
  try {
    // Valida sessão
    if (!validateSession(token)) {
      return {
        success: false,
        message: 'Sessão inválida ou expirada'
      };
    }
    
    // Obtém todas as transações até a data final
    const transactionsResult = queryTransactions(token, {
      startDate: startDate,
      endDate: endDate
    });
    
    if (!transactionsResult.success) {
      return transactionsResult;
    }
    
    const transactions = transactionsResult.data;
    
    // Ordena por data
    transactions.sort((a, b) => a.date.localeCompare(b.date));
    
    // Calcula saldo acumulado
    const evolution = [];
    let balance = 0;
    
    transactions.forEach(t => {
      if (t.type === 'credit') {
        balance += t.amount;
      } else {
        balance -= t.amount;
      }
      
      evolution.push({
        date: t.date,
        amount: t.amount,
        type: t.type,
        balance: balance
      });
    });
    
    return {
      success: true,
      message: 'Evolução do saldo calculada com sucesso',
      data: {
        period: {
          startDate: startDate,
          endDate: endDate
        },
        finalBalance: balance,
        evolution: evolution
      }
    };
    
  } catch (error) {
    logEvent('REPORTS', 'ERROR', 'getBalanceEvolution', 'Erro ao calcular evolução', error.stack);
    return {
      success: false,
      message: 'Erro ao calcular evolução: ' + error.message
    };
  }
}

/**
 * Obtém nome do mês
 * 
 * @param {number} month - Número do mês (1-12)
 * @returns {string} Nome do mês
 */
function getMonthName(month) {
  const months = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];
  return months[month - 1] || '';
}

/**
 * Compara dois períodos
 * 
 * @param {string} token - Token de sessão
 * @param {string} period1Start - Início do período 1
 * @param {string} period1End - Fim do período 1
 * @param {string} period2Start - Início do período 2
 * @param {string} period2End - Fim do período 2
 * @returns {Object} Resultado com comparação
 */
function comparePeriods(token, period1Start, period1End, period2Start, period2End) {
  try {
    // Valida sessão
    if (!validateSession(token)) {
      return {
        success: false,
        message: 'Sessão inválida ou expirada'
      };
    }
    
    // Obtém relatórios dos dois períodos
    const period1 = getReportByPeriod(token, period1Start, period1End);
    const period2 = getReportByPeriod(token, period2Start, period2End);
    
    if (!period1.success || !period2.success) {
      return {
        success: false,
        message: 'Erro ao obter dados dos períodos'
      };
    }
    
    // Calcula variações
    const creditsDiff = period2.data.summary.totalCredits - period1.data.summary.totalCredits;
    const debitsDiff = period2.data.summary.totalDebits - period1.data.summary.totalDebits;
    const balanceDiff = period2.data.summary.balance - period1.data.summary.balance;
    
    const creditsPercent = period1.data.summary.totalCredits > 0 
      ? (creditsDiff / period1.data.summary.totalCredits) * 100 
      : 0;
    const debitsPercent = period1.data.summary.totalDebits > 0 
      ? (debitsDiff / period1.data.summary.totalDebits) * 100 
      : 0;
    
    return {
      success: true,
      message: 'Comparação realizada com sucesso',
      data: {
        period1: {
          dates: { start: period1Start, end: period1End },
          summary: period1.data.summary
        },
        period2: {
          dates: { start: period2Start, end: period2End },
          summary: period2.data.summary
        },
        comparison: {
          creditsDiff: creditsDiff,
          creditsPercent: creditsPercent,
          debitsDiff: debitsDiff,
          debitsPercent: debitsPercent,
          balanceDiff: balanceDiff
        }
      }
    };
    
  } catch (error) {
    logEvent('REPORTS', 'ERROR', 'comparePeriods', 'Erro ao comparar períodos', error.stack);
    return {
      success: false,
      message: 'Erro ao comparar períodos: ' + error.message
    };
  }
}

/**
 * =============================================================================
 * FUNÇÕES DE RELATÓRIOS DE PARCELAMENTO
 * =============================================================================
 */

/**
 * Gera relatório completo de transações parceladas
 * 
 * @param {string} token - Token de sessão
 * @param {string} startDate - Data inicial (opcional)
 * @param {string} endDate - Data final (opcional)
 * @returns {Object} Resultado com relatório de parcelas
 */
function getInstallmentReport(token, startDate, endDate) {
  try {
    console.log('[REPORTS] getInstallmentReport chamada');

    if (!validateSession(token)) {
      return {
        success: false,
        message: 'Sessão inválida ou expirada'
      };
    }

    // Se não forneceu datas, usa ano atual
    if (!startDate || !endDate) {
      const now = new Date();
      const year = now.getFullYear();
      startDate = `${year}-01-01`;
      endDate = `${year}-12-31`;
    } else {
      // Valida datas fornecidas
      const dateValidation = validateDateRange(startDate, endDate, false);
      if (!dateValidation.valid) {
        return {
          success: false,
          message: dateValidation.message
        };
      }
    }

    console.log('[REPORTS] Período:', startDate, 'a', endDate);
    
    // Obtém todas as transações do período
    const transactionsResult = queryTransactions(token, {
      startDate: startDate,
      endDate: endDate
    });
    
    if (!transactionsResult || !transactionsResult.success) {
      return {
        success: false,
        message: 'Erro ao obter transações'
      };
    }
    
    const transactions = transactionsResult.data || [];
    
    // Filtra apenas transações parceladas
    const installmentTransactions = transactions.filter(t => 
      t.parentTransactionId && t.parentTransactionId !== ''
    );
    
    if (installmentTransactions.length === 0) {
      return {
        success: true,
        message: 'Nenhuma transação parcelada encontrada no período',
        data: {
          period: { startDate, endDate },
          summary: {
            totalGroups: 0,
            totalInstallments: 0,
            totalAmount: 0,
            averageInstallments: 0,
            averageAmount: 0
          },
          byPaymentMethod: [],
          byCategory: [],
          groups: []
        }
      };
    }
    
    // Agrupar por parentTransactionId
    const groupsMap = {};
    
    installmentTransactions.forEach(t => {
      const parentId = t.parentTransactionId;
      
      if (!groupsMap[parentId]) {
        groupsMap[parentId] = {
          parentId: parentId,
          description: t.description.replace(/\s*\(\d+\/\d+\)$/, ''),
          category: t.category,
          paymentMethod: t.paymentMethod,
          totalInstallments: t.installments,
          totalAmount: 0,
          paidAmount: 0,
          remainingAmount: 0,
          installments: []
        };
      }
      
      groupsMap[parentId].totalAmount += t.amount;
      groupsMap[parentId].installments.push({
        id: t.id,
        date: t.date,
        amount: t.amount,
        installmentNumber: t.installmentNumber
      });
    });
    
    // Calcular valores pagos e restantes
    const today = new Date().toISOString().split('T')[0];
    
    Object.values(groupsMap).forEach(group => {
      group.installments.forEach(inst => {
        if (inst.date <= today) {
          group.paidAmount += inst.amount;
        } else {
          group.remainingAmount += inst.amount;
        }
      });
      
      // Ordenar parcelas por data
      group.installments.sort((a, b) => a.date.localeCompare(b.date));
    });
    
    const groups = Object.values(groupsMap);
    
    // Calcular resumo
    const totalAmount = installmentTransactions.reduce((sum, t) => sum + t.amount, 0);
    const totalInstallmentsSum = installmentTransactions.reduce((sum, t) => sum + t.installments, 0);
    const averageInstallments = totalInstallmentsSum / installmentTransactions.length;
    const averageAmount = totalAmount / groups.length;
    
    // Agrupar por forma de pagamento
    const byPaymentMethod = {};
    
    installmentTransactions.forEach(t => {
      const method = t.paymentMethod || 'Outros';
      
      if (!byPaymentMethod[method]) {
        byPaymentMethod[method] = {
          paymentMethod: method,
          amount: 0,
          count: 0,
          groups: new Set()
        };
      }
      
      byPaymentMethod[method].amount += t.amount;
      byPaymentMethod[method].count++;
      byPaymentMethod[method].groups.add(t.parentTransactionId);
    });
    
    // Converter Set em count
    Object.values(byPaymentMethod).forEach(item => {
      item.groups = item.groups.size;
    });
    
    const paymentMethodData = Object.values(byPaymentMethod).sort((a, b) => b.amount - a.amount);
    
    // Agrupar por categoria
    const byCategory = {};
    
    installmentTransactions.forEach(t => {
      const category = t.category;
      
      if (!byCategory[category]) {
        byCategory[category] = {
          category: category,
          amount: 0,
          count: 0,
          groups: new Set()
        };
      }
      
      byCategory[category].amount += t.amount;
      byCategory[category].count++;
      byCategory[category].groups.add(t.parentTransactionId);
    });
    
    // Converter Set em count
    Object.values(byCategory).forEach(item => {
      item.groups = item.groups.size;
    });
    
    const categoryData = Object.values(byCategory).sort((a, b) => b.amount - a.amount);
    
    console.log('[REPORTS] Relatório de parcelas gerado -', groups.length, 'grupos');
    
    return {
      success: true,
      message: 'Relatório de parcelas gerado com sucesso',
      data: {
        period: { startDate, endDate },
        summary: {
          totalGroups: groups.length,
          totalInstallments: installmentTransactions.length,
          totalAmount: totalAmount,
          averageInstallments: Math.round(averageInstallments * 10) / 10,
          averageAmount: Math.round(averageAmount * 100) / 100
        },
        byPaymentMethod: paymentMethodData,
        byCategory: categoryData,
        groups: groups
      }
    };
    
  } catch (error) {
    console.error('[REPORTS] Erro em getInstallmentReport:', error);
    logEvent('REPORTS', 'ERROR', 'getInstallmentReport', 'Erro ao gerar relatório de parcelas', error.stack);
    return {
      success: false,
      message: 'Erro ao gerar relatório: ' + error.message
    };
  }
}

/**
 * Gera projeção de gastos parcelados para os próximos meses
 * 
 * @param {string} token - Token de sessão
 * @param {number} months - Número de meses futuros (padrão: 6)
 * @returns {Object} Projeção de gastos parcelados
 */
function getInstallmentProjection(token, months) {
  try {
    console.log('[REPORTS] getInstallmentProjection chamada, months:', months);
    
    if (!validateSession(token)) {
      return {
        success: false,
        message: 'Sessão inválida ou expirada'
      };
    }
    
    if (!months || months < 1) months = 6;
    if (months > 24) months = 24;
    
    // Calcular intervalo de datas
    const today = new Date();
    const futureDate = new Date();
    futureDate.setMonth(today.getMonth() + months);
    
    const startDate = today.toISOString().split('T')[0];
    const endDate = futureDate.toISOString().split('T')[0];
    
    console.log('[REPORTS] Projeção de', startDate, 'até', endDate);
    
    // Buscar todas as transações parceladas futuras
    const transactionsResult = queryTransactions(token, {
      startDate: startDate,
      endDate: endDate
    });
    
    if (!transactionsResult || !transactionsResult.success) {
      return {
        success: false,
        message: 'Erro ao obter transações'
      };
    }
    
    const transactions = transactionsResult.data || [];
    
    // Filtrar apenas parcelas futuras
    const futureInstallments = transactions.filter(t => 
      t.parentTransactionId && 
      t.parentTransactionId !== '' && 
      t.type === 'debit'
    );
    
    // Agrupar por mês
    const byMonth = {};
    
    for (let i = 0; i < months; i++) {
      const date = new Date(today.getFullYear(), today.getMonth() + i, 1);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      
      byMonth[monthKey] = {
        month: date.getMonth() + 1,
        year: date.getFullYear(),
        monthName: getMonthName(date.getMonth() + 1),
        totalAmount: 0,
        installmentCount: 0,
        byPaymentMethod: {},
        byCategory: {}
      };
    }
    
    // Agregar dados por mês
    futureInstallments.forEach(t => {
      const monthKey = t.date.substring(0, 7); // YYYY-MM
      
      if (byMonth[monthKey]) {
        byMonth[monthKey].totalAmount += t.amount;
        byMonth[monthKey].installmentCount++;
        
        // Por forma de pagamento
        const method = t.paymentMethod || 'Outros';
        if (!byMonth[monthKey].byPaymentMethod[method]) {
          byMonth[monthKey].byPaymentMethod[method] = 0;
        }
        byMonth[monthKey].byPaymentMethod[method] += t.amount;
        
        // Por categoria
        const category = t.category;
        if (!byMonth[monthKey].byCategory[category]) {
          byMonth[monthKey].byCategory[category] = 0;
        }
        byMonth[monthKey].byCategory[category] += t.amount;
      }
    });
    
    // Converter objetos em arrays
    Object.values(byMonth).forEach(month => {
      month.byPaymentMethod = Object.entries(month.byPaymentMethod).map(([method, amount]) => ({
        paymentMethod: method,
        amount: amount
      }));
      
      month.byCategory = Object.entries(month.byCategory).map(([category, amount]) => ({
        category: category,
        amount: amount
      }));
    });
    
    const projection = Object.values(byMonth);
    const totalProjected = projection.reduce((sum, m) => sum + m.totalAmount, 0);
    const averageMonthly = totalProjected / months;
    
    console.log('[REPORTS] Projeção gerada -', months, 'meses, total:', totalProjected);
    
    return {
      success: true,
      message: 'Projeção gerada com sucesso',
      data: {
        months: months,
        totalProjected: totalProjected,
        averageMonthly: Math.round(averageMonthly * 100) / 100,
        projection: projection
      }
    };
    
  } catch (error) {
    console.error('[REPORTS] Erro em getInstallmentProjection:', error);
    logEvent('REPORTS', 'ERROR', 'getInstallmentProjection', 'Erro ao gerar projeção', error.stack);
    return {
      success: false,
      message: 'Erro ao gerar projeção: ' + error.message
    };
  }
}

/**
 * Analisa comprometimento financeiro com parcelas
 * 
 * @param {string} token - Token de sessão
 * @param {number} monthlyIncome - Renda mensal (opcional)
 * @returns {Object} Análise de comprometimento
 */
function getInstallmentCommitmentAnalysis(token, monthlyIncome) {
  try {
    console.log('[REPORTS] getInstallmentCommitmentAnalysis chamada');
    
    if (!validateSession(token)) {
      return {
        success: false,
        message: 'Sessão inválida ou expirada'
      };
    }
    
    // Obter projeção dos próximos 12 meses
    const projection = getInstallmentProjection(token, 12);
    
    if (!projection || !projection.success) {
      return {
        success: false,
        message: 'Erro ao obter projeção de parcelas'
      };
    }
    
    const monthlyData = projection.data.projection;
    
    // Calcular comprometimento mês a mês
    const commitmentByMonth = monthlyData.map(month => {
      const commitment = monthlyIncome > 0 
        ? Math.round((month.totalAmount / monthlyIncome) * 100) 
        : 0;
      
      return {
        month: month.month,
        year: month.year,
        monthName: month.monthName,
        installmentAmount: month.totalAmount,
        commitment: commitment,
        status: getCommitmentStatus(commitment)
      };
    });
    
    // Estatísticas gerais
    const totalAmount = monthlyData.reduce((sum, m) => sum + m.totalAmount, 0);
    const maxMonth = monthlyData.reduce((max, m) => m.totalAmount > max.totalAmount ? m : max, monthlyData[0] || { totalAmount: 0 });
    const minMonth = monthlyData.reduce((min, m) => m.totalAmount < min.totalAmount ? m : min, monthlyData[0] || { totalAmount: 0 });
    
    const averageCommitment = monthlyIncome > 0 
      ? Math.round((projection.data.averageMonthly / monthlyIncome) * 100)
      : 0;
    
    console.log('[REPORTS] Análise de comprometimento gerada, média:', averageCommitment + '%');
    
    return {
      success: true,
      message: 'Análise de comprometimento gerada com sucesso',
      data: {
        monthlyIncome: monthlyIncome || 0,
        averageMonthlyInstallments: projection.data.averageMonthly,
        averageCommitment: averageCommitment,
        commitmentStatus: getCommitmentStatus(averageCommitment),
        highestMonth: {
          month: maxMonth.month,
          year: maxMonth.year,
          monthName: maxMonth.monthName,
          amount: maxMonth.totalAmount
        },
        lowestMonth: {
          month: minMonth.month,
          year: minMonth.year,
          monthName: minMonth.monthName,
          amount: minMonth.totalAmount
        },
        commitmentByMonth: commitmentByMonth,
        totalCommitted: totalAmount
      }
    };
    
  } catch (error) {
    console.error('[REPORTS] Erro em getInstallmentCommitmentAnalysis:', error);
    logEvent('REPORTS', 'ERROR', 'getInstallmentCommitmentAnalysis', 'Erro ao gerar análise', error.stack);
    return {
      success: false,
      message: 'Erro ao gerar análise: ' + error.message
    };
  }
}

/**
 * Determina status do comprometimento baseado no percentual
 * 
 * @param {number} percent - Percentual de comprometimento
 * @returns {string} Status (Saudável, Atenção, Alerta, Crítico)
 */
function getCommitmentStatus(percent) {
  if (percent <= 30) return 'Saudável';
  if (percent <= 50) return 'Atenção';
  if (percent <= 70) return 'Alerta';
  return 'Crítico';
}

/**
 * Gera relatório de parcelas por forma de pagamento
 * 
 * @param {string} token - Token de sessão
 * @param {string} paymentMethod - Forma de pagamento
 * @param {string} startDate - Data inicial (opcional)
 * @param {string} endDate - Data final (opcional)
 * @returns {Object} Relatório filtrado por forma de pagamento
 */
function getInstallmentReportByPaymentMethod(token, paymentMethod, startDate, endDate) {
  try {
    console.log('[REPORTS] getInstallmentReportByPaymentMethod chamada, method:', paymentMethod);
    
    if (!validateSession(token)) {
      return {
        success: false,
        message: 'Sessão inválida ou expirada'
      };
    }
    
    if (!paymentMethod) {
      return {
        success: false,
        message: 'Forma de pagamento é obrigatória'
      };
    }
    
    // Obter relatório completo de parcelas
    const fullReport = getInstallmentReport(token, startDate, endDate);
    
    if (!fullReport || !fullReport.success) {
      return fullReport;
    }
    
    // Filtrar grupos pela forma de pagamento
    const filteredGroups = fullReport.data.groups.filter(g => 
      g.paymentMethod === paymentMethod
    );
    
    // Recalcular resumo
    const totalAmount = filteredGroups.reduce((sum, g) => sum + g.totalAmount, 0);
    const totalInstallments = filteredGroups.reduce((sum, g) => sum + g.installments.length, 0);
    const averageAmount = filteredGroups.length > 0 ? totalAmount / filteredGroups.length : 0;
    
    console.log('[REPORTS] Grupos filtrados:', filteredGroups.length);
    
    return {
      success: true,
      message: 'Relatório por forma de pagamento gerado com sucesso',
      data: {
        paymentMethod: paymentMethod,
        period: fullReport.data.period,
        summary: {
          totalGroups: filteredGroups.length,
          totalInstallments: totalInstallments,
          totalAmount: totalAmount,
          averageAmount: Math.round(averageAmount * 100) / 100
        },
        groups: filteredGroups
      }
    };
    
  } catch (error) {
    console.error('[REPORTS] Erro em getInstallmentReportByPaymentMethod:', error);
    logEvent('REPORTS', 'ERROR', 'getInstallmentReportByPaymentMethod', 'Erro ao gerar relatório', error.stack);
    return {
      success: false,
      message: 'Erro ao gerar relatório: ' + error.message
    };
  }
}
