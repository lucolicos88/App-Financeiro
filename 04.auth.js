/**
 * =============================================================================
 * AUTH.GS - Módulo de Autenticação e Gerenciamento de Sessão
 * =============================================================================
 * 
 * Responsável por:
 * - Autenticação de usuários com senha
 * - Geração e validação de tokens de sessão
 * - Controle de expiração de sessão
 * - Rate limiting de tentativas de login
 * - Logout e invalidação de sessão
 * 
 * Segurança:
 * - Senhas hasheadas com SHA-256 + salt
 * - Tokens armazenados no CacheService (expiração automática)
 * - Comparação de hash em tempo constante
 * - Rate limiting por IP/usuário
 * =============================================================================
 */

/**
 * Duração da sessão em segundos (6 horas)
 */
const SESSION_DURATION = 6 * 60 * 60;

/**
 * Máximo de tentativas de login por hora
 */
const MAX_LOGIN_ATTEMPTS = 5;

/**
 * Realiza login do usuário
 * Valida senha e gera token de sessão
 * 
 * @param {string} password - Senha fornecida pelo usuário
 * @returns {Object} Objeto com resultado do login
 */
function login(password) {
  try {
    // Validação de entrada
    if (!password || typeof password !== 'string') {
      logEvent('AUTH', 'WARN', 'login', 'Tentativa de login sem senha', '');
      return {
        success: false,
        message: 'Senha é obrigatória'
      };
    }
    
    // Verifica rate limiting
    const rateLimitCheck = checkRateLimit();
    if (!rateLimitCheck.allowed) {
      logEvent('AUTH', 'WARN', 'login', 'Rate limit excedido', '');
      return {
        success: false,
        message: rateLimitCheck.message
      };
    }
    
    // Obtém salt e hash armazenados
    const credentials = getStoredCredentials();
    if (!credentials) {
      logEvent('AUTH', 'ERROR', 'login', 'Credenciais não encontradas', '');
      return {
        success: false,
        message: 'Sistema não configurado. Execute setup() primeiro.'
      };
    }
    
    // Gera hash da senha fornecida
    const passwordHash = hashPassword(password, credentials.salt);
    
    // Compara hashes em tempo constante (evita timing attacks)
    const isValid = constantTimeCompare(passwordHash, credentials.hash);
    
    if (!isValid) {
      // Incrementa contador de tentativas
      incrementLoginAttempts();
      
      logEvent('AUTH', 'WARN', 'login', 'Senha incorreta', '');
      return {
        success: false,
        message: 'Senha incorreta'
      };
    }
    
    // Gera token de sessão
    const token = generateSessionToken();
    
    // Armazena token no cache com expiração
    const cache = CacheService.getUserCache();
    cache.put('session_token', token, SESSION_DURATION);
    cache.put('session_created', new Date().toISOString(), SESSION_DURATION);
    
    // Reset contador de tentativas
    resetLoginAttempts();
    
    // Log de sucesso
    logEvent('AUTH', 'INFO', 'login', 'Login realizado com sucesso', '');
    
    return {
      success: true,
      message: 'Login realizado com sucesso',
      token: token,
      expiresIn: SESSION_DURATION
    };
    
  } catch (error) {
    logEvent('AUTH', 'ERROR', 'login', 'Erro ao fazer login', error.stack);
    return {
      success: false,
      message: 'Erro ao fazer login: ' + error.message
    };
  }
}

/**
 * Realiza logout do usuário
 * Invalida token de sessão atual
 * 
 * @param {string} token - Token de sessão a ser invalidado
 * @returns {Object} Objeto com resultado do logout
 */
function logout(token) {
  try {
    // Validação de entrada
    if (!token || typeof token !== 'string') {
      return {
        success: false,
        message: 'Token inválido'
      };
    }
    
    // Remove token do cache
    const cache = CacheService.getUserCache();
    cache.remove('session_token');
    cache.remove('session_created');
    
    // Log de logout
    logEvent('AUTH', 'INFO', 'logout', 'Logout realizado', '');
    
    return {
      success: true,
      message: 'Logout realizado com sucesso'
    };
    
  } catch (error) {
    logEvent('AUTH', 'ERROR', 'logout', 'Erro ao fazer logout', error.stack);
    return {
      success: false,
      message: 'Erro ao fazer logout: ' + error.message
    };
  }
}

/**
 * Verifica se o usuário está autenticado
 * Valida token de sessão
 * 
 * @param {string} token - Token de sessão a ser validado
 * @returns {Object} Objeto com status de autenticação
 */
function isAuthenticated(token) {
  try {
    // Validação de entrada
    if (!token || typeof token !== 'string') {
      return {
        authenticated: false,
        message: 'Token não fornecido'
      };
    }
    
    // Obtém token armazenado no cache
    const cache = CacheService.getUserCache();
    const storedToken = cache.get('session_token');
    
    // Verifica se token existe
    if (!storedToken) {
      return {
        authenticated: false,
        message: 'Sessão expirada'
      };
    }
    
    // Compara tokens em tempo constante
    const isValid = constantTimeCompare(token, storedToken);
    
    if (!isValid) {
      return {
        authenticated: false,
        message: 'Token inválido'
      };
    }
    
    // Token válido
    return {
      authenticated: true,
      message: 'Usuário autenticado'
    };
    
  } catch (error) {
    logEvent('AUTH', 'ERROR', 'isAuthenticated', 'Erro ao validar token', error.stack);
    return {
      authenticated: false,
      message: 'Erro ao validar sessão'
    };
  }
}

/**
 * Valida sessão antes de executar operação
 * Wrapper para validação de token
 * 
 * @param {string} token - Token de sessão
 * @returns {boolean} True se autenticado, False caso contrário
 */
function validateSession(token) {
  const auth = isAuthenticated(token);
  return auth.authenticated === true;
}

/**
 * Obtém credenciais armazenadas (salt e hash)
 * 
 * @returns {Object|null} Objeto com salt e hash, ou null se não encontrado
 */
function getStoredCredentials() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('Settings');
    
    if (!sheet) {
      return null;
    }
    
    // Lê todos os dados da aba Settings
    const data = sheet.getDataRange().getValues();
    
    let salt = null;
    let hash = null;
    
    // Procura por password_salt e password_hash
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === 'password_salt') {
        salt = data[i][1];
      }
      if (data[i][0] === 'password_hash') {
        hash = data[i][1];
      }
    }
    
    // Retorna null se não encontrou ambos
    if (!salt || !hash) {
      return null;
    }
    
    return { salt, hash };
    
  } catch (error) {
    console.error('[AUTH] Erro ao obter credenciais:', error);
    return null;
  }
}

/**
 * Gera token de sessão único
 * 
 * @returns {string} Token em formato UUID-like
 */
function generateSessionToken() {
  // Gera UUID-like token
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Compara duas strings em tempo constante
 * Previne timing attacks
 * 
 * @param {string} a - Primeira string
 * @param {string} b - Segunda string
 * @returns {boolean} True se iguais, False caso contrário
 */
function constantTimeCompare(a, b) {
  // Se tamanhos diferentes, já retorna false
  if (a.length !== b.length) {
    return false;
  }
  
  // Compara caractere por caractere em tempo constante
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  
  return result === 0;
}

/**
 * Verifica rate limiting de tentativas de login
 * 
 * @returns {Object} Objeto indicando se requisição é permitida
 */
function checkRateLimit() {
  try {
    const cache = CacheService.getUserCache();
    const attempts = parseInt(cache.get('login_attempts') || '0');
    
    if (attempts >= MAX_LOGIN_ATTEMPTS) {
      return {
        allowed: false,
        message: 'Muitas tentativas de login. Aguarde 1 hora.'
      };
    }
    
    return {
      allowed: true,
      message: 'OK'
    };
    
  } catch (error) {
    console.error('[AUTH] Erro ao verificar rate limit:', error);
    // Em caso de erro, permite requisição (fail open)
    return {
      allowed: true,
      message: 'OK'
    };
  }
}

/**
 * Incrementa contador de tentativas de login
 */
function incrementLoginAttempts() {
  try {
    const cache = CacheService.getUserCache();
    const attempts = parseInt(cache.get('login_attempts') || '0');
    
    // Incrementa e armazena por 1 hora
    cache.put('login_attempts', (attempts + 1).toString(), 3600);
    
  } catch (error) {
    console.error('[AUTH] Erro ao incrementar tentativas:', error);
  }
}

/**
 * Reseta contador de tentativas de login
 */
function resetLoginAttempts() {
  try {
    const cache = CacheService.getUserCache();
    cache.remove('login_attempts');
    
  } catch (error) {
    console.error('[AUTH] Erro ao resetar tentativas:', error);
  }
}

/**
 * Altera senha do usuário
 * Requer autenticação
 * 
 * @param {string} token - Token de sessão
 * @param {string} oldPassword - Senha atual
 * @param {string} newPassword - Nova senha
 * @returns {Object} Objeto com resultado da operação
 */
function changePassword(token, oldPassword, newPassword) {
  try {
    // Valida sessão
    if (!validateSession(token)) {
      return {
        success: false,
        message: 'Sessão inválida ou expirada'
      };
    }
    
    // Validações de entrada
    if (!oldPassword || !newPassword) {
      return {
        success: false,
        message: 'Senhas são obrigatórias'
      };
    }
    
    if (newPassword.length < 6) {
      return {
        success: false,
        message: 'Nova senha deve ter no mínimo 6 caracteres'
      };
    }
    
    // Valida senha antiga
    const credentials = getStoredCredentials();
    if (!credentials) {
      return {
        success: false,
        message: 'Erro ao obter credenciais'
      };
    }
    
    const oldPasswordHash = hashPassword(oldPassword, credentials.salt);
    const isValid = constantTimeCompare(oldPasswordHash, credentials.hash);
    
    if (!isValid) {
      logEvent('AUTH', 'WARN', 'changePassword', 'Senha antiga incorreta', '');
      return {
        success: false,
        message: 'Senha atual incorreta'
      };
    }
    
    // Gera novo salt e hash
    const newSalt = generateSalt();
    const newHash = hashPassword(newPassword, newSalt);
    
    // Atualiza na planilha
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('Settings');
    const data = sheet.getDataRange().getValues();
    
    // Atualiza salt e hash
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === 'password_salt') {
        sheet.getRange(i + 1, 2).setValue(newSalt);
      }
      if (data[i][0] === 'password_hash') {
        sheet.getRange(i + 1, 2).setValue(newHash);
      }
    }
    
    // Log de sucesso
    logEvent('AUTH', 'INFO', 'changePassword', 'Senha alterada com sucesso', '');
    
    return {
      success: true,
      message: 'Senha alterada com sucesso'
    };
    
  } catch (error) {
    logEvent('AUTH', 'ERROR', 'changePassword', 'Erro ao alterar senha', error.stack);
    return {
      success: false,
      message: 'Erro ao alterar senha: ' + error.message
    };
  }
}