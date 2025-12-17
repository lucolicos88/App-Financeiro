/**
 * =============================================================================
 * UTILS.GS - Módulo de Funções Utilitárias
 * =============================================================================
 * 
 * Funções auxiliares utilizadas em diversos módulos:
 * - Validação de dados
 * - Formatação de valores
 * - Manipulação de datas
 * - Sanitização de strings
 * - Helpers gerais
 * 
 * Funções reutilizáveis e sem dependências de outros módulos.
 * =============================================================================
 */

/**
 * Valida formato de data (YYYY-MM-DD)
 * 
 * @param {string} dateStr - String de data
 * @returns {boolean} True se válida, False caso contrário
 */
function isValidDate(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') {
    return false;
  }
  
  // Verifica formato
  const regex = /^\d{4}-\d{2}-\d{2}$/;
  if (!regex.test(dateStr)) {
    return false;
  }
  
  // Verifica se é uma data válida
  const date = new Date(dateStr);
  return !isNaN(date.getTime());
}

/**
 * Valida se valor é um número válido
 * 
 * @param {*} value - Valor a validar
 * @returns {boolean} True se válido, False caso contrário
 */
function isValidNumber(value) {
  if (value === null || value === undefined) {
    return false;
  }
  
  const num = typeof value === 'string' ? parseFloat(value) : value;
  return !isNaN(num) && isFinite(num);
}

/**
 * Sanitiza string removendo caracteres perigosos
 *
 * @param {string} str - String a sanitizar
 * @param {number} maxLength - Comprimento máximo (padrão 1000)
 * @returns {string} String sanitizada
 */
function sanitizeString(str, maxLength) {
  // Validação explícita de null/undefined
  if (str === null || str === undefined || typeof str !== 'string') {
    return '';
  }

  // Define comprimento máximo padrão
  if (!maxLength || maxLength < 1) {
    maxLength = 1000;
  }

  // Remove espaços extras e limita comprimento
  return str.trim().substring(0, maxLength);
}

/**
 * Formata valor monetário
 * 
 * @param {number} value - Valor a formatar
 * @param {string} currency - Código da moeda (padrão BRL)
 * @returns {string} Valor formatado
 */
function formatCurrency(value, currency) {
  if (!isValidNumber(value)) {
    return 'R$ 0,00';
  }
  
  const num = parseFloat(value);
  const symbol = currency === 'USD' ? '$' : 'R$';
  
  return symbol + ' ' + num.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/**
 * Formata data para formato brasileiro (DD/MM/YYYY)
 * 
 * @param {string} dateStr - Data em formato YYYY-MM-DD
 * @returns {string} Data formatada
 */
function formatDateBR(dateStr) {
  if (!isValidDate(dateStr)) {
    return '';
  }
  
  const parts = dateStr.split('-');
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

/**
 * Converte data brasileira para formato ISO (YYYY-MM-DD)
 * 
 * @param {string} dateStr - Data em formato DD/MM/YYYY
 * @returns {string} Data em formato ISO
 */
function parseDateBR(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') {
    return '';
  }
  
  const parts = dateStr.split('/');
  if (parts.length !== 3) {
    return '';
  }
  
  const day = parts[0].padStart(2, '0');
  const month = parts[1].padStart(2, '0');
  const year = parts[2];
  
  return `${year}-${month}-${day}`;
}

/**
 * Obtém primeiro dia do mês atual
 * 
 * @returns {string} Data em formato YYYY-MM-DD
 */
function getFirstDayOfMonth() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}-01`;
}

/**
 * Obtém último dia do mês atual
 * 
 * @returns {string} Data em formato YYYY-MM-DD
 */
function getLastDayOfMonth() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const lastDay = new Date(year, month, 0).getDate();
  return `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
}

/**
 * Obtém data de hoje em formato YYYY-MM-DD
 * 
 * @returns {string} Data de hoje
 */
function getToday() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Calcula diferença em dias entre duas datas
 * 
 * @param {string} date1 - Data inicial (YYYY-MM-DD)
 * @param {string} date2 - Data final (YYYY-MM-DD)
 * @returns {number} Diferença em dias
 */
function getDaysDifference(date1, date2) {
  if (!isValidDate(date1) || !isValidDate(date2)) {
    return 0;
  }
  
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  const diffTime = Math.abs(d2 - d1);
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Valida email com regex mais robusto
 *
 * @param {string} email - Email a validar
 * @returns {boolean} True se válido, False caso contrário
 */
function isValidEmail(email) {
  if (!email || typeof email !== 'string') {
    return false;
  }

  // Regex mais robusto para validação de email
  const regex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return regex.test(email);
}

/**
 * Gera ID único usando UUID do Google Apps Script
 *
 * @returns {string} ID único (UUID)
 */
function generateUniqueId() {
  return Utilities.getUuid();
}

/**
 * Trunca texto com reticências
 * 
 * @param {string} text - Texto a truncar
 * @param {number} maxLength - Comprimento máximo
 * @returns {string} Texto truncado
 */
function truncateText(text, maxLength) {
  if (!text || typeof text !== 'string') {
    return '';
  }
  
  if (text.length <= maxLength) {
    return text;
  }
  
  return text.substring(0, maxLength - 3) + '...';
}

/**
 * Remove acentos de string
 * 
 * @param {string} str - String com acentos
 * @returns {string} String sem acentos
 */
function removeAccents(str) {
  if (!str || typeof str !== 'string') {
    return '';
  }
  
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/**
 * Capitaliza primeira letra de cada palavra
 * 
 * @param {string} str - String a capitalizar
 * @returns {string} String capitalizada
 */
function capitalizeWords(str) {
  if (!str || typeof str !== 'string') {
    return '';
  }
  
  return str.toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
}

/**
 * Verifica se string está vazia ou só tem espaços
 * 
 * @param {string} str - String a verificar
 * @returns {boolean} True se vazia, False caso contrário
 */
function isEmptyString(str) {
  return !str || typeof str !== 'string' || str.trim().length === 0;
}

/**
 * Converte objeto para query string
 * 
 * @param {Object} obj - Objeto a converter
 * @returns {string} Query string
 */
function objectToQueryString(obj) {
  if (!obj || typeof obj !== 'object') {
    return '';
  }
  
  const params = [];
  for (const key in obj) {
    if (obj.hasOwnProperty(key) && obj[key] !== null && obj[key] !== undefined) {
      params.push(encodeURIComponent(key) + '=' + encodeURIComponent(obj[key]));
    }
  }
  
  return params.join('&');
}

/**
 * Clona objeto profundamente
 * 
 * @param {Object} obj - Objeto a clonar
 * @returns {Object} Objeto clonado
 */
function deepClone(obj) {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  
  if (obj instanceof Date) {
    return new Date(obj.getTime());
  }
  
  if (obj instanceof Array) {
    return obj.map(item => deepClone(item));
  }
  
  const clonedObj = {};
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      clonedObj[key] = deepClone(obj[key]);
    }
  }
  
  return clonedObj;
}

/**
 * Pausa execução por X milissegundos
 * 
 * @param {number} ms - Milissegundos
 */
function sleep(ms) {
  Utilities.sleep(ms);
}

/**
 * Retry de função com backoff exponencial
 *
 * @param {Function} fn - Função a executar
 * @param {number} maxRetries - Máximo de tentativas
 * @returns {*} Resultado da função
 */
function retryWithBackoff(fn, maxRetries) {
  maxRetries = maxRetries || 3;

  for (let i = 0; i < maxRetries; i++) {
    try {
      return fn();
    } catch (error) {
      if (i === maxRetries - 1) {
        throw new Error(`Failed after ${maxRetries} attempts: ${error.message}`);
      }
      const delay = Math.pow(2, i) * 1000;
      Utilities.sleep(delay);
    }
  }
}

/**
 * =============================================================================
 * CACHE SERVICE - Sistema de Cache para Otimização de Performance
 * =============================================================================
 */

/**
 * Obtém dados do cache ou executa função se não existir
 *
 * @param {string} key - Chave do cache
 * @param {Function} fn - Função para obter dados se não estiver em cache
 * @param {number} ttl - Tempo de vida em segundos (padrão: 600 = 10 min)
 * @returns {*} Dados do cache ou resultado da função
 */
function getCachedData(key, fn, ttl) {
  const cache = CacheService.getUserCache();
  ttl = ttl || 600; // 10 minutos padrão

  try {
    // Tenta obter do cache
    const cached = cache.get(key);
    if (cached !== null) {
      return JSON.parse(cached);
    }

    // Se não existe, executa função e armazena
    const data = fn();
    cache.put(key, JSON.stringify(data), ttl);
    return data;
  } catch (error) {
    // Se falhar, executa função diretamente
    console.error('[CACHE] Error:', error);
    return fn();
  }
}

/**
 * Armazena dados no cache
 *
 * @param {string} key - Chave do cache
 * @param {*} data - Dados a armazenar
 * @param {number} ttl - Tempo de vida em segundos (padrão: 600)
 */
function setCacheData(key, data, ttl) {
  const cache = CacheService.getUserCache();
  ttl = ttl || 600;

  try {
    cache.put(key, JSON.stringify(data), ttl);
  } catch (error) {
    console.error('[CACHE] Set error:', error);
  }
}

/**
 * Invalida cache específico
 *
 * @param {string} key - Chave do cache a invalidar
 */
function invalidateCache(key) {
  const cache = CacheService.getUserCache();

  try {
    cache.remove(key);
  } catch (error) {
    console.error('[CACHE] Invalidate error:', error);
  }
}

/**
 * Invalida múltiplos caches por padrão
 *
 * @param {string} pattern - Padrão de chaves (ex: 'transactions_*')
 */
function invalidateCachePattern(pattern) {
  // CacheService não suporta pattern matching, então invalidamos chaves conhecidas
  const cache = CacheService.getUserCache();

  const commonKeys = [
    'categories_all',
    'transactions_all',
    'transactions_recent',
    'settings_all',
    'dashboard_kpis',
    'reports_balance',
    'reports_category',
    'reports_monthly'
  ];

  commonKeys.forEach(key => {
    if (key.startsWith(pattern.replace('*', ''))) {
      try {
        cache.remove(key);
      } catch (error) {
        console.error('[CACHE] Pattern invalidate error:', error);
      }
    }
  });
}

/**
 * Limpa todo o cache do usuário
 */
function clearAllCache() {
  const cache = CacheService.getUserCache();

  try {
    cache.removeAll(['categories_all', 'transactions_all', 'transactions_recent',
                     'settings_all', 'dashboard_kpis', 'reports_balance',
                     'reports_category', 'reports_monthly']);
  } catch (error) {
    console.error('[CACHE] Clear all error:', error);
  }
}

/**
 * =============================================================================
 * VALIDAÇÕES E UTILIDADES ADICIONAIS
 * =============================================================================
 */

/**
 * Adiciona meses a uma data corretamente (resolve bug de fim de mês)
 *
 * @param {Date} date - Data original
 * @param {number} months - Número de meses a adicionar
 * @returns {Date} Nova data
 */
/**
 * =============================================================================
 * CACHE/CONFIG HELPERS
 * =============================================================================
 */

/**
 * Retorna se debug estÃ¡ habilitado (ScriptProperties: DEBUG=true)
 *
 * @returns {boolean}
 */
function isDebugEnabled() {
  try {
    const props = PropertiesService.getScriptProperties();
    return props.getProperty('DEBUG') === 'true';
  } catch (error) {
    return false;
  }
}

function debugLog() {
  if (!isDebugEnabled()) return;
  try {
    console.log.apply(console, arguments);
  } catch (error) {
    // ignore
  }
}

/**
 * Gera chave curta/estÃ¡vel de cache (evita estourar limite de tamanho de key)
 *
 * @param {string} namespace
 * @param {Object} params
 * @returns {string}
 */
function makeCacheKey(namespace, params) {
  const payload = JSON.stringify(params || {});
  const digest = hashString(payload).substring(0, 16);
  return `${namespace}_${digest}`;
}

/**
 * VersÃ£o de dados por usuÃ¡rio (para invalidar caches de forma confiÃ¡vel)
 *
 * @param {string} namespace
 * @returns {number}
 */
function getUserDataVersion(namespace) {
  namespace = namespace || 'default';
  const key = `data_version_${namespace}`;

  try {
    const props = PropertiesService.getUserProperties();
    const raw = props.getProperty(key);
    const num = parseInt(raw || '1', 10);
    return Number.isFinite(num) && num > 0 ? num : 1;
  } catch (error) {
    return 1;
  }
}

/**
 * Incrementa versÃ£o de dados (use apÃ³s mutaÃ§Ãµes relevantes)
 *
 * @param {string} namespace
 * @returns {number} nova versÃ£o
 */
function bumpUserDataVersion(namespace) {
  namespace = namespace || 'default';
  const key = `data_version_${namespace}`;
  const lock = LockService.getUserLock();

  try {
    lock.waitLock(10000);
    const props = PropertiesService.getUserProperties();
    const current = getUserDataVersion(namespace);
    const next = current + 1;
    props.setProperty(key, String(next));
    return next;
  } catch (error) {
    return getUserDataVersion(namespace);
  } finally {
    try {
      lock.releaseLock();
    } catch (e) {
      // ignore
    }
  }
}

function addMonths(date, months) {
  const d = new Date(date);
  const day = d.getDate();
  d.setMonth(d.getMonth() + months);

  // Se o dia mudou (ex: 31 jan + 1 mês = 3 mar), ajusta para último dia do mês
  if (d.getDate() !== day) {
    d.setDate(0); // Último dia do mês anterior
  }

  return d;
}

/**
 * Valida se data não está muito no futuro
 *
 * @param {string} dateStr - Data em formato YYYY-MM-DD
 * @param {number} maxYears - Máximo de anos no futuro (padrão: 1)
 * @returns {boolean} True se válida, False se muito no futuro
 */
function isValidFutureDate(dateStr, maxYears) {
  if (!isValidDate(dateStr)) {
    return false;
  }

  maxYears = maxYears || 1;
  const date = new Date(dateStr);
  const today = new Date();
  const maxDate = new Date();
  maxDate.setFullYear(today.getFullYear() + maxYears);

  return date <= maxDate;
}

/**
 * Normaliza data removendo informações de hora
 *
 * @param {Date|string} date - Data a normalizar
 * @returns {string} Data normalizada em formato YYYY-MM-DD
 */
function normalizeDate(date) {
  let d;

  if (typeof date === 'string') {
    d = new Date(date);
  } else if (date instanceof Date) {
    d = date;
  } else {
    return getToday();
  }

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

/**
 * Hash simples de string (para anonimização)
 *
 * @param {string} str - String a fazer hash
 * @returns {string} Hash da string
 */
function hashString(str) {
  if (!str || typeof str !== 'string') {
    return '';
  }

  // Usa SHA-256 do Utilities
  const hash = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    str,
    Utilities.Charset.UTF_8
  );

  return hash.map(byte => ('0' + (byte & 0xFF).toString(16)).slice(-2)).join('');
}

/**
 * Anonimiza email para logs
 *
 * @param {string} email - Email a anonimizar
 * @returns {string} Email anonimizado
 */
function anonymizeEmail(email) {
  if (!email || typeof email !== 'string') {
    return 'anonymous';
  }

  // Pega primeiros 3 caracteres + hash dos últimos 6 dígitos do hash completo
  const fullHash = hashString(email);
  const shortHash = fullHash.substring(fullHash.length - 6);

  const atIndex = email.indexOf('@');
  if (atIndex > 0) {
    const prefix = email.substring(0, Math.min(3, atIndex));
    return `${prefix}***@${shortHash}`;
  }

  return `usr_${shortHash}`;
}
