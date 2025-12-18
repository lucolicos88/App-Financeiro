/**
 * =============================================================================
 * INVESTMENTS.GS - Módulo de Carteira de Investimentos (v1)
 * =============================================================================
 *
 * Objetivo: permitir ao usuário gerir uma carteira de forma didática e simples.
 * - Cadastro de ativos (ticker/nome/tipo/corretora/moeda/preço atual)
 * - Lançamentos (compra/venda/dividendo/taxa)
 * - Resumo de posição (quantidade, preço médio, custo, valor atual, P/L)
 *
 * Observações:
 * - Preço atual é informado manualmente pelo usuário (por enquanto).
 * - Estrutura pensada para evoluir (importação, integração com APIs, etc).
 * =============================================================================
 */

const INVESTMENT_SHEETS = {
  ASSETS: 'Investments',
  TRANSACTIONS: 'InvestmentTransactions'
};

function ensureInvestmentSheets_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  try {
    if (typeof createInvestmentsSheet === 'function') createInvestmentsSheet(ss);
    if (typeof createInvestmentTransactionsSheet === 'function') createInvestmentTransactionsSheet(ss);
  } catch (e) {
    // fallback: não quebra chamadas; funções abaixo vão retornar erro se sheet não existir
    console.warn('[INVESTMENTS] Falha ao garantir sheets:', e);
  }
}

function listInvestments(token) {
  try {
    if (!validateSession(token)) return { success: false, message: 'Sessão inválida ou expirada' };
    ensureInvestmentSheets_();

    const data = getAllData(INVESTMENT_SHEETS.ASSETS);
    const investments = (data || []).map(r => ({
      id: r[0],
      symbol: r[1],
      name: r[2],
      assetType: r[3],
      broker: r[4],
      currency: r[5] || 'BRL',
      latestPrice: Number(r[6] || 0),
      lastPriceAt: r[7] || '',
      isActive: String(r[8]).toLowerCase() !== 'false',
      notes: r[9] || '',
      createdAt: r[10] || '',
      updatedAt: r[11] || ''
    })).filter(a => a && a.id && a.isActive);

    investments.sort((a, b) => String(a.symbol || a.name || '').localeCompare(String(b.symbol || b.name || '')));
    return { success: true, message: 'Ativos carregados', data: investments };
  } catch (error) {
    console.error('[INVESTMENTS] Erro em listInvestments:', error);
    logEvent('INVESTMENTS', 'ERROR', 'listInvestments', 'Erro ao listar ativos', error.stack);
    return { success: false, message: 'Erro ao listar ativos: ' + error.message };
  }
}

function upsertInvestment(token, investment) {
  try {
    if (!validateSession(token)) return { success: false, message: 'Sessão inválida ou expirada' };
    ensureInvestmentSheets_();

    if (!investment || typeof investment !== 'object') {
      return { success: false, message: 'Dados inválidos' };
    }

    const symbol = String(investment.symbol || '').trim().toUpperCase();
    const name = String(investment.name || '').trim();
    const assetType = String(investment.assetType || 'Ação').trim();
    const broker = String(investment.broker || '').trim();
    const currency = String(investment.currency || 'BRL').trim().toUpperCase();
    const latestPrice = Number(investment.latestPrice || 0);
    const notes = String(investment.notes || '').trim();
    const now = new Date().toISOString();

    if (!symbol && !name) {
      return { success: false, message: 'Informe pelo menos o ticker ou o nome do ativo' };
    }

    const sheetName = INVESTMENT_SHEETS.ASSETS;
    const sheet = getSheet(sheetName);
    if (!sheet) return { success: false, message: 'Planilha Investments não encontrada (execute o setup)' };

    const id = investment.id ? parseInt(investment.id) : null;

    if (id) {
      const found = findRowById(sheetName, id);
      if (!found) return { success: false, message: 'Ativo não encontrado' };

      const old = found.data || [];
      const createdAt = old[10] || now;

      const row = [
        id,
        symbol || old[1] || '',
        name || old[2] || '',
        assetType || old[3] || 'Ação',
        broker,
        currency || 'BRL',
        isFinite(latestPrice) ? latestPrice : Number(old[6] || 0),
        isFinite(latestPrice) ? now : (old[7] || ''),
        String(investment.isActive).toLowerCase() === 'false' ? false : true,
        notes,
        createdAt,
        now
      ];

      const ok = updateRow(sheetName, found.rowIndex, row);
      if (!ok) return { success: false, message: 'Falha ao atualizar ativo' };

      bumpUserDataVersion('investments');
      return { success: true, message: 'Ativo atualizado', data: rowToInvestment_(row) };
    }

    // criar
    const newId = getNextId(sheetName);
    const row = [
      newId,
      symbol,
      name,
      assetType,
      broker,
      currency,
      isFinite(latestPrice) ? latestPrice : 0,
      isFinite(latestPrice) ? now : '',
      true,
      notes,
      now,
      now
    ];

    const ok = addRow(sheetName, row);
    if (!ok) return { success: false, message: 'Falha ao criar ativo' };

    bumpUserDataVersion('investments');
    return { success: true, message: 'Ativo criado', data: rowToInvestment_(row) };
  } catch (error) {
    console.error('[INVESTMENTS] Erro em upsertInvestment:', error);
    logEvent('INVESTMENTS', 'ERROR', 'upsertInvestment', 'Erro ao salvar ativo', error.stack);
    return { success: false, message: 'Erro ao salvar ativo: ' + error.message };
  }
}

function deleteInvestment(token, id) {
  try {
    if (!validateSession(token)) return { success: false, message: 'Sessão inválida ou expirada' };
    ensureInvestmentSheets_();

    const sheetName = INVESTMENT_SHEETS.ASSETS;
    const investmentId = parseInt(id);
    const found = findRowById(sheetName, investmentId);
    if (!found) return { success: false, message: 'Ativo não encontrado' };

    const row = found.data.slice();
    row[8] = false; // isActive
    row[11] = new Date().toISOString(); // updatedAt

    const ok = updateRow(sheetName, found.rowIndex, row);
    if (!ok) return { success: false, message: 'Falha ao remover ativo' };

    bumpUserDataVersion('investments');
    return { success: true, message: 'Ativo removido' };
  } catch (error) {
    console.error('[INVESTMENTS] Erro em deleteInvestment:', error);
    return { success: false, message: 'Erro ao remover ativo: ' + error.message };
  }
}

function addInvestmentTransaction(token, tx) {
  try {
    if (!validateSession(token)) return { success: false, message: 'Sessão inválida ou expirada' };
    ensureInvestmentSheets_();

    if (!tx || typeof tx !== 'object') return { success: false, message: 'Dados inválidos' };

    const date = String(tx.date || '').trim();
    const investmentId = parseInt(tx.investmentId);
    const type = String(tx.type || 'buy').trim().toLowerCase();

    const quantity = tx.quantity === '' || tx.quantity === null || tx.quantity === undefined ? '' : Number(tx.quantity);
    const price = tx.price === '' || tx.price === null || tx.price === undefined ? '' : Number(tx.price);
    const amount = tx.amount === '' || tx.amount === null || tx.amount === undefined ? '' : Number(tx.amount);
    const notes = String(tx.notes || '').trim();

    if (!date) return { success: false, message: 'Data é obrigatória' };
    if (!investmentId) return { success: false, message: 'Selecione um ativo' };

    const allowed = ['buy', 'sell', 'dividend', 'fee'];
    if (!allowed.includes(type)) return { success: false, message: 'Tipo inválido' };

    if ((type === 'buy' || type === 'sell') && (!isFinite(quantity) || quantity <= 0)) {
      return { success: false, message: 'Quantidade inválida' };
    }
    if ((type === 'buy' || type === 'sell') && (!isFinite(price) || price < 0)) {
      return { success: false, message: 'Preço inválido' };
    }
    if ((type === 'dividend' || type === 'fee') && (!isFinite(amount) || amount <= 0)) {
      return { success: false, message: 'Valor inválido' };
    }

    const sheetName = INVESTMENT_SHEETS.TRANSACTIONS;
    const id = getNextId(sheetName);
    const now = new Date().toISOString();

    const computedAmount = (type === 'buy' || type === 'sell')
      ? Number(quantity) * Number(price)
      : Number(amount);

    const row = [
      id,
      date,
      investmentId,
      type,
      (type === 'buy' || type === 'sell') ? Number(quantity) : '',
      (type === 'buy' || type === 'sell') ? Number(price) : '',
      computedAmount,
      notes,
      now,
      now
    ];

    const ok = addRow(sheetName, row);
    if (!ok) return { success: false, message: 'Falha ao adicionar lançamento' };

    bumpUserDataVersion('investments');
    return { success: true, message: 'Lançamento adicionado', data: rowToInvestmentTx_(row) };
  } catch (error) {
    console.error('[INVESTMENTS] Erro em addInvestmentTransaction:', error);
    logEvent('INVESTMENTS', 'ERROR', 'addInvestmentTransaction', 'Erro ao adicionar lançamento', error.stack);
    return { success: false, message: 'Erro ao adicionar lançamento: ' + error.message };
  }
}

function listInvestmentTransactions(token, filters) {
  try {
    if (!validateSession(token)) return { success: false, message: 'Sessão inválida ou expirada' };
    ensureInvestmentSheets_();

    const f = filters && typeof filters === 'object' ? filters : {};
    const investmentId = f.investmentId ? parseInt(f.investmentId) : null;
    const dateFrom = f.dateFrom ? String(f.dateFrom) : '';
    const dateTo = f.dateTo ? String(f.dateTo) : '';
    const limit = f.limit ? Math.max(1, Math.min(200, parseInt(f.limit))) : 0;

    const data = getAllData(INVESTMENT_SHEETS.TRANSACTIONS) || [];
    let rows = data.map(rowToInvestmentTx_);

    if (investmentId) rows = rows.filter(t => parseInt(t.investmentId) === investmentId);
    if (dateFrom) rows = rows.filter(t => String(t.date) >= dateFrom);
    if (dateTo) rows = rows.filter(t => String(t.date) <= dateTo);

    rows.sort((a, b) => String(b.date).localeCompare(String(a.date)) || (Number(b.id) - Number(a.id)));
    if (limit) rows = rows.slice(0, limit);

    return { success: true, message: 'Lançamentos carregados', data: rows };
  } catch (error) {
    console.error('[INVESTMENTS] Erro em listInvestmentTransactions:', error);
    return { success: false, message: 'Erro ao listar lançamentos: ' + error.message };
  }
}

function deleteInvestmentTransaction(token, id) {
  try {
    if (!validateSession(token)) return { success: false, message: 'Sessão inválida ou expirada' };
    ensureInvestmentSheets_();

    const sheetName = INVESTMENT_SHEETS.TRANSACTIONS;
    const txId = parseInt(id);
    const found = findRowById(sheetName, txId);
    if (!found) return { success: false, message: 'Lançamento não encontrado' };

    const ok = deleteRow(sheetName, found.rowIndex);
    if (!ok) return { success: false, message: 'Falha ao excluir lançamento' };

    bumpUserDataVersion('investments');
    return { success: true, message: 'Lançamento excluído' };
  } catch (error) {
    console.error('[INVESTMENTS] Erro em deleteInvestmentTransaction:', error);
    return { success: false, message: 'Erro ao excluir lançamento: ' + error.message };
  }
}

function updateInvestmentPrice(token, investmentId, latestPrice) {
  try {
    if (!validateSession(token)) return { success: false, message: 'Sessão inválida ou expirada' };
    ensureInvestmentSheets_();

    const id = parseInt(investmentId);
    const price = Number(latestPrice);
    if (!id) return { success: false, message: 'Ativo inválido' };
    if (!isFinite(price) || price < 0) return { success: false, message: 'Preço inválido' };

    const sheetName = INVESTMENT_SHEETS.ASSETS;
    const found = findRowById(sheetName, id);
    if (!found) return { success: false, message: 'Ativo não encontrado' };

    const row = found.data.slice();
    row[6] = price;
    row[7] = new Date().toISOString();
    row[11] = new Date().toISOString();

    const ok = updateRow(sheetName, found.rowIndex, row);
    if (!ok) return { success: false, message: 'Falha ao salvar preço' };

    bumpUserDataVersion('investments');
    return { success: true, message: 'Preço atualizado', data: rowToInvestment_(row) };
  } catch (error) {
    console.error('[INVESTMENTS] Erro em updateInvestmentPrice:', error);
    return { success: false, message: 'Erro ao atualizar preço: ' + error.message };
  }
}

function getPortfolio(token) {
  try {
    if (!validateSession(token)) return { success: false, message: 'Sessão inválida ou expirada' };
    ensureInvestmentSheets_();

    const assetsResult = listInvestments(token);
    if (!assetsResult.success) return assetsResult;

    const assets = assetsResult.data || [];
    const txRows = (getAllData(INVESTMENT_SHEETS.TRANSACTIONS) || []).map(rowToInvestmentTx_);

    const stateById = {};
    for (const asset of assets) {
      stateById[asset.id] = {
        investmentId: asset.id,
        symbol: asset.symbol,
        name: asset.name,
        assetType: asset.assetType,
        currency: asset.currency || 'BRL',
        latestPrice: Number(asset.latestPrice || 0),
        quantity: 0,
        avgCost: 0,
        costBasisOpen: 0,
        realizedPnL: 0,
        dividends: 0,
        fees: 0
      };
    }

    // Ordenar por data para cálculo de preço médio e realizado
    txRows.sort((a, b) => String(a.date).localeCompare(String(b.date)) || (Number(a.id) - Number(b.id)));

    for (const tx of txRows) {
      const s = stateById[tx.investmentId];
      if (!s) continue;

      const type = String(tx.type || '').toLowerCase();
      if (type === 'buy') {
        const q = Number(tx.quantity || 0);
        const p = Number(tx.price || 0);
        const prevQty = s.quantity;
        const newQty = prevQty + q;
        const prevCost = s.avgCost * prevQty;
        const newCost = prevCost + (q * p);
        s.quantity = newQty;
        s.avgCost = newQty > 0 ? (newCost / newQty) : 0;
      } else if (type === 'sell') {
        const q = Number(tx.quantity || 0);
        const p = Number(tx.price || 0);
        const sellQty = Math.min(q, s.quantity);
        const realized = (p - s.avgCost) * sellQty;
        s.realizedPnL += realized;
        s.quantity = Math.max(0, s.quantity - sellQty);
        if (s.quantity === 0) s.avgCost = 0;
      } else if (type === 'dividend') {
        s.dividends += Number(tx.amount || 0);
      } else if (type === 'fee') {
        s.fees += Number(tx.amount || 0);
      }
    }

    const positions = Object.values(stateById).map(p => {
      const currentValue = p.quantity * (p.latestPrice || 0);
      const costBasis = p.quantity * (p.avgCost || 0);
      const unrealizedPnL = currentValue - costBasis;
      const totalPnL = unrealizedPnL + p.realizedPnL + p.dividends - p.fees;
      return {
        investmentId: p.investmentId,
        symbol: p.symbol,
        name: p.name,
        assetType: p.assetType,
        currency: p.currency,
        latestPrice: p.latestPrice,
        quantity: Number(p.quantity.toFixed(8)),
        avgCost: Number((p.avgCost || 0).toFixed(8)),
        costBasis: costBasis,
        currentValue: currentValue,
        unrealizedPnL: unrealizedPnL,
        realizedPnL: p.realizedPnL,
        dividends: p.dividends,
        fees: p.fees,
        totalPnL: totalPnL
      };
    });

    const totals = positions.reduce((acc, p) => {
      acc.costBasis += p.costBasis || 0;
      acc.currentValue += p.currentValue || 0;
      acc.unrealizedPnL += p.unrealizedPnL || 0;
      acc.realizedPnL += p.realizedPnL || 0;
      acc.dividends += p.dividends || 0;
      acc.fees += p.fees || 0;
      acc.totalPnL += p.totalPnL || 0;
      return acc;
    }, { costBasis: 0, currentValue: 0, unrealizedPnL: 0, realizedPnL: 0, dividends: 0, fees: 0, totalPnL: 0 });

    positions.sort((a, b) => (b.currentValue || 0) - (a.currentValue || 0));

    return {
      success: true,
      message: 'Carteira carregada',
      data: { positions, totals }
    };
  } catch (error) {
    console.error('[INVESTMENTS] Erro em getPortfolio:', error);
    logEvent('INVESTMENTS', 'ERROR', 'getPortfolio', 'Erro ao calcular carteira', error.stack);
    return { success: false, message: 'Erro ao calcular carteira: ' + error.message };
  }
}

function getPortfolioBundle(token) {
  try {
    if (!validateSession(token)) return { success: false, message: 'Sessão inválida ou expirada' };
    ensureInvestmentSheets_();

    const invVersion = getUserDataVersion('investments');
    const cacheKey = makeCacheKey(`investments_bundle_v${invVersion}`, { v: invVersion });

    return getCachedData(cacheKey, function() {
      const portfolio = getPortfolio(token);
      const assets = listInvestments(token);
      const recentTx = listInvestmentTransactions(token, { limit: 20 });

      return {
        success: true,
        message: 'Dados de investimentos carregados',
        data: {
          portfolio: portfolio && portfolio.success ? portfolio.data : { positions: [], totals: {} },
          investments: assets && assets.success ? assets.data : [],
          recentTransactions: recentTx && recentTx.success ? recentTx.data : []
        }
      };
    }, 120);
  } catch (error) {
    console.error('[INVESTMENTS] Erro em getPortfolioBundle:', error);
    return { success: false, message: 'Erro ao carregar investimentos: ' + error.message };
  }
}

function rowToInvestment_(row) {
  return {
    id: row[0],
    symbol: row[1],
    name: row[2],
    assetType: row[3],
    broker: row[4],
    currency: row[5] || 'BRL',
    latestPrice: Number(row[6] || 0),
    lastPriceAt: row[7] || '',
    isActive: String(row[8]).toLowerCase() !== 'false',
    notes: row[9] || '',
    createdAt: row[10] || '',
    updatedAt: row[11] || ''
  };
}

function rowToInvestmentTx_(row) {
  return {
    id: row[0],
    date: row[1],
    investmentId: row[2],
    type: row[3],
    quantity: row[4] === '' ? '' : Number(row[4]),
    price: row[5] === '' ? '' : Number(row[5]),
    amount: row[6] === '' ? '' : Number(row[6]),
    notes: row[7] || '',
    createdAt: row[8] || '',
    updatedAt: row[9] || ''
  };
}
