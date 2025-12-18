/**
 * =============================================================================
 * STATEMENT IMPORT - Importação de Extratos Bancários (CSV)
 * =============================================================================
 *
 * Fluxo:
 * - statementImportAnalyze: detecta delimitador, cabeçalho e sugere mapeamento
 * - statementImportPreview: gera prévia (primeiras N linhas) com defaults
 * - statementImportCommit: importa em lote para a aba Transactions
 *
 * Observações:
 * - Categoria é obrigatória no sistema; quando faltar, usa defaults por tipo.
 * - Deduplicação via importHash (date|type|amount|description|account|source).
 * - Ajusta schema da aba Transactions para incluir colunas de importação.
 * =============================================================================
 */

const STATEMENT_IMPORT_LIMITS = {
  maxCsvBytes: 2 * 1024 * 1024, // 2MB
  maxRows: 5000,
  previewRows: 200,
  maxOverrides: 500
};

const STATEMENT_IMPORT_COLUMNS = ['importBatchId', 'importHash', 'importSource', 'importAccount'];

function statementImportAnalyze(token, csvText) {
  try {
    if (!validateSession(token)) {
      return { success: false, message: 'Sessão inválida ou expirada' };
    }

    const normalized = statementImportNormalizeCsv_(csvText);
    const delimiter = statementImportDetectDelimiter_(normalized);
    const sampleCsv = statementImportTakeFirstLines_(normalized, 60);
    const rows = Utilities.parseCsv(sampleCsv, delimiter);
    const cleaned = rows.filter(r => Array.isArray(r) && r.some(c => String(c || '').trim() !== ''));

    if (cleaned.length === 0) {
      return { success: false, message: 'CSV vazio ou inválido' };
    }

    const headerGuess = statementImportGuessHeader_(cleaned);
    const headers = headerGuess.hasHeader
      ? cleaned[0].map(h => String(h || '').trim())
      : cleaned[0].map((_, i) => `Coluna ${i + 1}`);

    const suggestion = statementImportSuggestMapping_(headers);

    return {
      success: true,
      message: 'OK',
      data: {
        delimiter,
        hasHeader: headerGuess.hasHeader,
        headers,
        mappingSuggestion: suggestion,
        sampleRows: cleaned.slice(headerGuess.hasHeader ? 1 : 0, (headerGuess.hasHeader ? 1 : 0) + 5)
      }
    };
  } catch (error) {
    console.error('[STATEMENT_IMPORT] analyze error:', error);
    return { success: false, message: 'Erro ao analisar CSV: ' + error.message };
  }
}

function statementImportPreview(token, csvText, options) {
  try {
    if (!validateSession(token)) {
      return { success: false, message: 'Sessão inválida ou expirada' };
    }

    const parsed = statementImportParse_(csvText, options);
    if (!parsed.success) return parsed;

    const preview = parsed.data.items.slice(0, STATEMENT_IMPORT_LIMITS.previewRows);

    return {
      success: true,
      message: 'OK',
      data: {
        delimiter: parsed.data.delimiter,
        hasHeader: parsed.data.hasHeader,
        totalRows: parsed.data.totalRows,
        invalidRows: parsed.data.invalidRows,
        previewRows: preview
      }
    };
  } catch (error) {
    console.error('[STATEMENT_IMPORT] preview error:', error);
    return { success: false, message: 'Erro ao gerar prévia: ' + error.message };
  }
}

function statementImportCommit(token, csvText, options) {
  const lock = LockService.getScriptLock();

  try {
    if (!validateSession(token)) {
      return { success: false, message: 'Sessão inválida ou expirada' };
    }

    const parsed = statementImportParse_(csvText, options);
    if (!parsed.success) return parsed;

    ensureTransactionsImportSchema_();

    const txSheet = getSheet('Transactions');
    if (!txSheet) return { success: false, message: 'Aba Transactions não encontrada' };

    const headers = txSheet.getRange(1, 1, 1, txSheet.getLastColumn()).getValues()[0].map(h => String(h || '').trim());
    const headerIndex = Object.create(null);
    headers.forEach((h, i) => { if (h) headerIndex[h] = i; });

    const importBatchId = statementImportCreateBatchId_();
    const importSource = String((options && options.source) || '').trim();
    const importAccount = String((options && options.account) || '').trim();

    const existingHashes = statementImportGetExistingImportHashes_(txSheet, headers, headerIndex);
    const seenInBatch = new Set();

    const defaults = (options && options.defaults) || {};
    const defaultDebitCategory = String(defaults.debitCategory || '').trim();
    const defaultCreditCategory = String(defaults.creditCategory || '').trim();
    const defaultPaymentMethod = String(defaults.paymentMethod || 'Outros').trim() || 'Outros';

    // Permite criar automaticamente categorias "A revisar" se usadas como padrão
    statementImportEnsureReviewCategory_(token, defaultDebitCategory, 'debit');
    statementImportEnsureReviewCategory_(token, defaultCreditCategory, 'credit');

    const overrides = (options && options.overrides) || {};
    const overrideKeys = Object.keys(overrides || {});
    if (overrideKeys.length > STATEMENT_IMPORT_LIMITS.maxOverrides) {
      return { success: false, message: `Muitas edições (${overrideKeys.length}). Reduza para até ${STATEMENT_IMPORT_LIMITS.maxOverrides}.` };
    }

    const items = parsed.data.items;
    if (items.length > STATEMENT_IMPORT_LIMITS.maxRows) {
      return { success: false, message: `Muitas linhas (${items.length}). Limite: ${STATEMENT_IMPORT_LIMITS.maxRows}.` };
    }

    lock.waitLock(30000);

    const lastRow = txSheet.getLastRow();
    const lastId = lastRow > 1 ? parseInt(txSheet.getRange(lastRow, 1).getValue(), 10) : 0;
    let nextId = (isNaN(lastId) ? 0 : lastId) + 1;

    const now = new Date().toISOString();
    const rowsToAppend = [];

    let skippedInvalid = 0;
    let skippedDuplicates = 0;

    for (const item of items) {
      const rowNumber = item.rowNumber;
      const ov = overrides && overrides[rowNumber] ? overrides[rowNumber] : null;

      const enabled = ov && Object.prototype.hasOwnProperty.call(ov, 'enabled') ? Boolean(ov.enabled) : true;
      if (!enabled) continue;

      const resolved = statementImportApplyOverride_(item, ov, {
        defaultDebitCategory,
        defaultCreditCategory,
        defaultPaymentMethod,
        importSource,
        importAccount
      });

      if (!resolved.valid) {
        skippedInvalid += 1;
        continue;
      }

      // Categoria continua sendo obrigatória: se faltou, tenta usar defaults
      if (!resolved.category) {
        resolved.category = resolved.type === 'debit' ? defaultDebitCategory : defaultCreditCategory;
      }

      if (!resolved.category) {
        skippedInvalid += 1;
        continue;
      }

      // Mantém integridade: categoria precisa existir e ser compatível com o tipo
      try {
        if (!validateCategory(resolved.category, resolved.type)) {
          skippedInvalid += 1;
          continue;
        }
      } catch (_) {
        skippedInvalid += 1;
        continue;
      }

      const importHash = statementImportComputeHash_(resolved, importSource, importAccount);
      if (seenInBatch.has(importHash) || existingHashes.has(importHash)) {
        skippedDuplicates += 1;
        continue;
      }
      seenInBatch.add(importHash);

      const baseRow = [
        nextId++,
        resolved.date,
        resolved.type,
        resolved.category,
        resolved.description,
        resolved.amount,
        now,
        now,
        '', // attachmentId
        resolved.paymentMethod || defaultPaymentMethod,
        1, // installments
        1, // installmentNumber
        '' // parentTransactionId
      ];

      const fullRow = baseRow.slice();
      while (fullRow.length < headers.length) fullRow.push('');

      if (headerIndex.importBatchId !== undefined) fullRow[headerIndex.importBatchId] = importBatchId;
      if (headerIndex.importHash !== undefined) fullRow[headerIndex.importHash] = importHash;
      if (headerIndex.importSource !== undefined) fullRow[headerIndex.importSource] = importSource;
      if (headerIndex.importAccount !== undefined) fullRow[headerIndex.importAccount] = importAccount;

      rowsToAppend.push(fullRow);
    }

    if (rowsToAppend.length === 0) {
      return {
        success: false,
        message: 'Nenhuma linha válida para importar (verifique categorias, duplicados e formato do CSV).',
        data: { created: 0, skippedInvalid, skippedDuplicates, importBatchId }
      };
    }

    const ok = addRows('Transactions', rowsToAppend);
    if (!ok) {
      return { success: false, message: 'Falha ao inserir linhas na planilha' };
    }

    logEvent('STATEMENT_IMPORT', 'INFO', 'statementImportCommit', `Import batch ${importBatchId}: created=${rowsToAppend.length}, invalid=${skippedInvalid}, dup=${skippedDuplicates}`, '');
    bumpUserDataVersion('transactions');

    return {
      success: true,
      message: 'Importação concluída',
      data: {
        importBatchId,
        created: rowsToAppend.length,
        skippedInvalid,
        skippedDuplicates
      }
    };
  } catch (error) {
    console.error('[STATEMENT_IMPORT] commit error:', error);
    logEvent('STATEMENT_IMPORT', 'ERROR', 'statementImportCommit', 'Erro ao importar extrato', error.stack);
    return { success: false, message: 'Erro ao importar extrato: ' + error.message };
  } finally {
    try { lock.releaseLock(); } catch (_) {}
  }
}

function statementImportNormalizeCsv_(csvText) {
  const text = String(csvText || '');
  if (!text) return '';

  // remove BOM
  const withoutBom = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  if (withoutBom.length > STATEMENT_IMPORT_LIMITS.maxCsvBytes) {
    throw new Error(`Arquivo muito grande (limite ${Math.round(STATEMENT_IMPORT_LIMITS.maxCsvBytes / 1024 / 1024)}MB)`);
  }
  return withoutBom.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

function statementImportTakeFirstLines_(text, lineCount) {
  const lines = String(text || '').split('\n');
  return lines.slice(0, Math.max(1, lineCount || 1)).join('\n');
}

function statementImportDetectDelimiter_(csvText) {
  const firstLine = String(csvText || '').split('\n')[0] || '';
  const candidates = [',', ';', '\t'];
  let best = ',';
  let bestCount = -1;
  for (const d of candidates) {
    const count = (firstLine.match(new RegExp(`\\${d}`, 'g')) || []).length;
    if (count > bestCount) {
      bestCount = count;
      best = d;
    }
  }
  return best;
}

function statementImportGuessHeader_(rows) {
  if (!rows || rows.length < 2) return { hasHeader: true };

  const r0 = rows[0].map(c => String(c || '').trim());
  const r1 = rows[1].map(c => String(c || '').trim());

  const hasLetters = r0.some(v => /[A-Za-zÀ-ÿ]/.test(v));
  const nextHasNumbers = r1.some(v => /\d/.test(v));

  // Heurística: primeira linha com letras e a próxima com números/datas
  return { hasHeader: Boolean(hasLetters && nextHasNumbers) };
}

function statementImportSuggestMapping_(headers) {
  const normalized = headers.map(h => statementImportNormalizeHeader_(h));

  const findIndex = (patterns) => {
    for (let i = 0; i < normalized.length; i++) {
      for (const p of patterns) {
        if (normalized[i].includes(p)) return i;
      }
    }
    return -1;
  };

  return {
    dateCol: findIndex(['data', 'date', 'dt']),
    descriptionCol: findIndex(['descricao', 'descr', 'historico', 'hist', 'lanc', 'descricao', 'description', 'memo']),
    amountCol: findIndex(['valor', 'amount', 'value', 'vl']),
    debitCol: findIndex(['debito', 'saida', 'despesa']),
    creditCol: findIndex(['credito', 'entrada', 'receita']),
    typeCol: findIndex(['tipo', 'type']),
    categoryCol: findIndex(['categoria', 'category']),
    paymentMethodCol: findIndex(['pagamento', 'payment', 'forma'])
  };
}

function statementImportNormalizeHeader_(header) {
  return String(header || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function statementImportParse_(csvText, options) {
  try {
    const normalized = statementImportNormalizeCsv_(csvText);
    if (!normalized) return { success: false, message: 'CSV vazio' };

    const delimiter = (options && options.delimiter) ? String(options.delimiter) : statementImportDetectDelimiter_(normalized);
    const hasHeader = options && typeof options.hasHeader === 'boolean' ? options.hasHeader : true;
    const mapping = (options && options.mapping) || {};

    const allRows = Utilities.parseCsv(normalized, delimiter)
      .filter(r => Array.isArray(r) && r.some(c => String(c || '').trim() !== ''));

    const startIndex = hasHeader ? 1 : 0;
    const dataRows = allRows.slice(startIndex);

    if (dataRows.length > STATEMENT_IMPORT_LIMITS.maxRows) {
      return { success: false, message: `CSV com muitas linhas (${dataRows.length}). Limite: ${STATEMENT_IMPORT_LIMITS.maxRows}.` };
    }

    const items = [];
    let invalidRows = 0;

    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      const rowNumber = i + 1; // 1-based dentro do CSV (desconsiderando cabeçalho)

      const parsedItem = statementImportParseRow_(row, rowNumber, mapping, options);
      if (!parsedItem.valid) invalidRows += 1;
      items.push(parsedItem);
    }

    return {
      success: true,
      message: 'OK',
      data: {
        delimiter,
        hasHeader,
        totalRows: dataRows.length,
        invalidRows,
        items
      }
    };
  } catch (error) {
    return { success: false, message: 'Erro ao parsear CSV: ' + error.message };
  }
}

function statementImportParseRow_(row, rowNumber, mapping, options) {
  const get = (idx) => {
    if (idx === undefined || idx === null) return '';
    const i = parseInt(idx, 10);
    if (isNaN(i) || i < 0 || i >= row.length) return '';
    return row[i];
  };

  const dateRaw = get(mapping.dateCol);
  const descRaw = get(mapping.descriptionCol);

  const typeRaw = get(mapping.typeCol);
  const catRaw = get(mapping.categoryCol);
  const pmRaw = get(mapping.paymentMethodCol);

  let amount = null;
  let type = null;

  const amountCol = mapping.amountCol;
  const debitCol = mapping.debitCol;
  const creditCol = mapping.creditCol;

  if (amountCol !== undefined && amountCol !== null && String(amountCol) !== '') {
    const parsed = statementImportParseAmount_(get(amountCol));
    if (parsed !== null) {
      if (parsed < 0) {
        type = 'debit';
        amount = Math.abs(parsed);
      } else {
        type = 'credit';
        amount = parsed;
      }
    }
  } else {
    const debitVal = statementImportParseAmount_(get(debitCol));
    const creditVal = statementImportParseAmount_(get(creditCol));
    if (debitVal !== null && debitVal !== 0) {
      type = 'debit';
      amount = Math.abs(debitVal);
    } else if (creditVal !== null && creditVal !== 0) {
      type = 'credit';
      amount = Math.abs(creditVal);
    }
  }

  if (!type && typeRaw) {
    const t = String(typeRaw || '').toLowerCase();
    if (t.includes('deb') || t.includes('sa') || t.includes('desp')) type = 'debit';
    if (t.includes('cred') || t.includes('ent') || t.includes('rece')) type = 'credit';
  }

  const date = statementImportParseDate_(dateRaw);
  const description = String(descRaw || '').trim();
  const category = String(catRaw || '').trim();
  const paymentMethod = String(pmRaw || '').trim();

  const issues = [];
  if (!date) issues.push('Data inválida');
  if (!description) issues.push('Descrição vazia');
  if (amount === null || !(amount > 0)) issues.push('Valor inválido');
  if (!type) issues.push('Tipo não identificado');

  return {
    rowNumber,
    date: date || '',
    type: type || '',
    description,
    amount: amount === null ? 0 : amount,
    category,
    paymentMethod,
    valid: issues.length === 0,
    issues
  };
}

function statementImportParseDate_(value) {
  const v = String(value || '').trim();
  if (!v) return '';

  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;

  // DD/MM/YYYY or DD/MM/YY
  const m = v.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (m) {
    const day = String(parseInt(m[1], 10)).padStart(2, '0');
    const month = String(parseInt(m[2], 10)).padStart(2, '0');
    let year = parseInt(m[3], 10);
    if (m[3].length === 2) year = year >= 70 ? 1900 + year : 2000 + year;
    if (!isNaN(year)) return `${year}-${month}-${day}`;
  }

  // fallback: Date.parse
  const d = new Date(v);
  if (!isNaN(d.getTime())) {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  return '';
}

function statementImportParseAmount_(value) {
  const raw = String(value === null || value === undefined ? '' : value).trim();
  if (!raw) return null;

  // remove currency and spaces
  let s = raw.replace(/[^\d,.\-()]/g, '');

  // parentheses => negative
  let negative = false;
  const paren = s.match(/^\((.*)\)$/);
  if (paren) {
    negative = true;
    s = paren[1];
  }

  // brazilian format: 1.234,56
  const hasComma = s.includes(',');
  const hasDot = s.includes('.');
  if (hasComma && hasDot) {
    s = s.replace(/\./g, '').replace(',', '.');
  } else if (hasComma && !hasDot) {
    s = s.replace(',', '.');
  }

  const n = parseFloat(s);
  if (isNaN(n) || !isFinite(n)) return null;
  return negative ? -Math.abs(n) : n;
}

function statementImportCreateBatchId_() {
  const ts = new Date().toISOString().replace(/[-:.TZ]/g, '');
  const rand = Math.random().toString(16).slice(2, 8);
  return `IMP-${ts}-${rand}`;
}

function statementImportComputeHash_(item, source, account) {
  const payload = [
    item.date,
    item.type,
    String(item.amount),
    (item.description || '').trim().toLowerCase(),
    (account || '').trim().toLowerCase(),
    (source || '').trim().toLowerCase()
  ].join('|');

  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, payload, Utilities.Charset.UTF_8);
  return bytes.map(b => {
    const v = b < 0 ? 256 + b : b;
    return ('0' + v.toString(16)).slice(-2);
  }).join('');
}

function statementImportGetExistingImportHashes_(sheet, headers, headerIndex) {
  const idx = headerIndex.importHash;
  if (idx === undefined) return new Set();

  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return new Set();

  const col = idx + 1;
  const values = sheet.getRange(2, col, lastRow - 1, 1).getValues();
  const set = new Set();
  for (const v of values) {
    const s = String(v[0] || '').trim();
    if (s) set.add(s);
  }
  return set;
}

function statementImportApplyOverride_(item, override, ctx) {
  const out = {
    rowNumber: item.rowNumber,
    date: item.date,
    type: item.type,
    description: item.description,
    amount: item.amount,
    category: item.category,
    paymentMethod: item.paymentMethod,
    valid: item.valid
  };

  if (override) {
    if (typeof override.date === 'string') out.date = override.date;
    if (typeof override.type === 'string') out.type = override.type;
    if (typeof override.description === 'string') out.description = override.description;
    if (override.amount !== undefined && override.amount !== null && override.amount !== '') {
      const n = typeof override.amount === 'string' ? parseFloat(override.amount) : override.amount;
      if (!isNaN(n) && isFinite(n) && n > 0) out.amount = n;
    }
    if (typeof override.category === 'string') out.category = override.category.trim();
    if (typeof override.paymentMethod === 'string') out.paymentMethod = override.paymentMethod.trim();
  }

  // Defaults
  if (!out.paymentMethod) out.paymentMethod = ctx.defaultPaymentMethod || 'Outros';

  // Revalidação básica
  const issues = [];
  if (!out.date || !/^\d{4}-\d{2}-\d{2}$/.test(out.date)) issues.push('Data inválida');
  if (!out.type || (out.type !== 'debit' && out.type !== 'credit')) issues.push('Tipo inválido');
  if (!out.description || !String(out.description).trim()) issues.push('Descrição vazia');
  if (!(out.amount > 0)) issues.push('Valor inválido');

  out.valid = issues.length === 0;
  out.issues = issues;
  return out;
}

function ensureTransactionsImportSchema_() {
  const sheet = getSheet('Transactions');
  if (!sheet) return;

  const lastCol = sheet.getLastColumn();
  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(h => String(h || '').trim());
  const existing = new Set(headers.filter(Boolean));
  const missing = STATEMENT_IMPORT_COLUMNS.filter(h => !existing.has(h));
  if (missing.length === 0) return;

  const startCol = headers.filter(Boolean).length + 1;
  sheet.getRange(1, startCol, 1, missing.length).setValues([missing]);
  sheet.getRange(1, startCol, 1, missing.length)
    .setBackground('#4285f4')
    .setFontColor('#ffffff')
    .setFontWeight('bold')
    .setHorizontalAlignment('center');

  try {
    sheet.setColumnWidth(startCol, 140); // importBatchId
    if (missing.length >= 2) sheet.setColumnWidth(startCol + 1, 220); // importHash
    if (missing.length >= 3) sheet.setColumnWidth(startCol + 2, 140); // importSource
    if (missing.length >= 4) sheet.setColumnWidth(startCol + 3, 180); // importAccount
  } catch (e) {
    console.warn('[STATEMENT_IMPORT] Aviso ao ajustar largura de colunas:', e);
  }
}

function statementImportEnsureReviewCategory_(token, categoryName, kind) {
  const name = String(categoryName || '').trim();
  if (!name) return;

  // Só cria automaticamente se for "A revisar"
  if (name.toLowerCase() !== 'a revisar') return;

  try {
    const existing = checkDuplicateCategory(name, kind);
    if (existing) return;
    createCategory(token, { kind, name });
  } catch (e) {
    console.warn('[STATEMENT_IMPORT] Falha ao garantir categoria A revisar:', e);
  }
}
