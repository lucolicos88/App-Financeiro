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
  if (!str || typeof str !== 'string') {
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
 * Valida email
 * 
 * @param {string} email - Email a validar
 * @returns {boolean} True se válido, False caso contrário
 */
function isValidEmail(email) {
  if (!email || typeof email !== 'string') {
    return false;
  }
  
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
}

/**
 * Gera ID único baseado em timestamp
 * 
 * @returns {string} ID único
 */
function generateUniqueId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
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
        throw error;
      }
      const delay = Math.pow(2, i) * 1000;
      Utilities.sleep(delay);
    }
  }
}