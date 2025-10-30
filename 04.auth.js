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
 * Obtém credenciais armazenadas (salt e hash) - AGORA USA PROPERTIESSERVICE
 *
 * @returns {Object|null} Objeto com salt e hash, ou null se não encontrado
 */
function getStoredCredentials() {
  try {
    const props = PropertiesService.getScriptProperties();

    const salt = props.getProperty('password_salt');
    const hash = props.getProperty('password_hash');

    // Se não encontrou no PropertiesService, tenta migrar da planilha
    if (!salt || !hash) {
      return migrateCredentialsFromSheet();
    }

    return { salt, hash };

  } catch (error) {
    console.error('[AUTH] Erro ao obter credenciais:', error);
    return null;
  }
}

/**
 * Migra credenciais da planilha para PropertiesService (compatibilidade)
 *
 * @returns {Object|null} Objeto com salt e hash, ou null se não encontrado
 */
function migrateCredentialsFromSheet() {
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

    // Se encontrou, migra para PropertiesService
    if (salt && hash) {
      const props = PropertiesService.getScriptProperties();
      props.setProperty('password_salt', salt);
      props.setProperty('password_hash', hash);

      console.log('[AUTH] Credenciais migradas da planilha para PropertiesService');

      return { salt, hash };
    }

    return null;

  } catch (error) {
    console.error('[AUTH] Erro ao migrar credenciais:', error);
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
 * Verifica rate limiting de tentativas de login - MELHORADO com email
 *
 * @returns {Object} Objeto indicando se requisição é permitida
 */
function checkRateLimit() {
  try {
    const cache = CacheService.getUserCache();
    const userEmail = Session.getEffectiveUser().getEmail() || 'anonymous';

    // Usa email como chave para rate limit individual
    const cacheKey = `login_attempts_${hashString(userEmail).substring(0, 16)}`;
    const lockKey = `account_locked_${hashString(userEmail).substring(0, 16)}`;

    // Verifica se conta está bloqueada
    const isLocked = cache.get(lockKey);
    if (isLocked === 'true') {
      return {
        allowed: false,
        message: 'Conta temporariamente bloqueada devido a múltiplas tentativas falhadas. Aguarde 1 hora.'
      };
    }

    const attempts = parseInt(cache.get(cacheKey) || '0');

    // Bloqueia após 10 tentativas
    if (attempts >= 10) {
      // Bloqueia conta por 1 hora
      cache.put(lockKey, 'true', 3600);
      logEvent('AUTH', 'WARN', 'checkRateLimit', `Conta bloqueada após ${attempts} tentativas`, '');

      return {
        allowed: false,
        message: 'Conta bloqueada devido a múltiplas tentativas falhadas. Aguarde 1 hora.'
      };
    }

    if (attempts >= MAX_LOGIN_ATTEMPTS) {
      return {
        allowed: false,
        message: `Muitas tentativas de login (${attempts}/${MAX_LOGIN_ATTEMPTS}). Aguarde alguns minutos.`
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
 * Incrementa contador de tentativas de login - MELHORADO com email
 */
function incrementLoginAttempts() {
  try {
    const cache = CacheService.getUserCache();
    const userEmail = Session.getEffectiveUser().getEmail() || 'anonymous';
    const cacheKey = `login_attempts_${hashString(userEmail).substring(0, 16)}`;

    const attempts = parseInt(cache.get(cacheKey) || '0');

    // Incrementa e armazena por 1 hora
    cache.put(cacheKey, (attempts + 1).toString(), 3600);

    console.log(`[AUTH] Tentativa falhada ${attempts + 1} para usuário ${anonymizeEmail(userEmail)}`);

  } catch (error) {
    console.error('[AUTH] Erro ao incrementar tentativas:', error);
  }
}

/**
 * Reseta contador de tentativas de login - MELHORADO com email
 */
function resetLoginAttempts() {
  try {
    const cache = CacheService.getUserCache();
    const userEmail = Session.getEffectiveUser().getEmail() || 'anonymous';
    const cacheKey = `login_attempts_${hashString(userEmail).substring(0, 16)}`;
    const lockKey = `account_locked_${hashString(userEmail).substring(0, 16)}`;

    cache.remove(cacheKey);
    cache.remove(lockKey);
    
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
    
    // Validação de senha forte: mínimo 12 caracteres
    if (newPassword.length < 12) {
      return {
        success: false,
        message: 'Nova senha deve ter no mínimo 12 caracteres'
      };
    }

    // Validação de complexidade: deve ter letras e números
    const hasLetters = /[a-zA-Z]/.test(newPassword);
    const hasNumbers = /[0-9]/.test(newPassword);

    if (!hasLetters || !hasNumbers) {
      return {
        success: false,
        message: 'Nova senha deve conter letras e números'
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

    // Atualiza no PropertiesService (seguro)
    const props = PropertiesService.getScriptProperties();
    props.setProperty('password_salt', newSalt);
    props.setProperty('password_hash', newHash);
    
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