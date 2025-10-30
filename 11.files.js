/**
 * =============================================================================
 * FILES.GS - Módulo de Gerenciamento de Arquivos
 * =============================================================================
 */

// CONSTANTES DE SEGURANÇA PARA ARQUIVOS
const MAX_FILE_SIZE_MB = 10;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
  'text/plain',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
];

const ALLOWED_EXTENSIONS = [
  '.jpg', '.jpeg', '.png', '.gif', '.webp',
  '.pdf', '.txt',
  '.xls', '.xlsx',
  '.doc', '.docx'
];

/**
 * Configura a pasta padrão do Drive para uploads
 *
 * @param {string} token - Token de sessão
 * @param {string} folderId - ID da pasta do Drive
 * @returns {Object} Resultado da operação
 */

function setUploadFolder(token, folderId) {
  try {
    console.log('[FILES] setUploadFolder chamada com folderId:', folderId);
    
    if (!validateSession(token)) {
      return {
        success: false,
        message: 'Sessão inválida ou expirada'
      };
    }
    
    // Valida o ID da pasta
    if (!folderId || typeof folderId !== 'string' || folderId.trim().length === 0) {
      return {
        success: false,
        message: 'ID da pasta inválido'
      };
    }
    
    // Verifica se a pasta existe e é acessível
    try {
      const folder = DriveApp.getFolderById(folderId.trim());
      
      // Testa se consegue escrever na pasta
      const testAccess = folder.getName();
      
    } catch (error) {
      console.error('[FILES] Erro ao acessar pasta:', error);
      return {
        success: false,
        message: 'Pasta não encontrada ou sem permissão de acesso'
      };
    }
    
    // Salva nas configurações
    const result = setSetting('upload_folder_id', folderId.trim());
    
    if (!result) {
      return {
        success: false,
        message: 'Erro ao salvar configuração'
      };
    }
    
    logEvent('FILES', 'INFO', 'setUploadFolder', 'Pasta de upload configurada: ' + folderId, '');
    
    return {
      success: true,
      message: 'Pasta configurada com sucesso',
      folderId: folderId.trim()
    };
    
  } catch (error) {
    console.error('[FILES] Erro em setUploadFolder:', error);
    logEvent('FILES', 'ERROR', 'setUploadFolder', 'Erro ao configurar pasta', error.stack);
    return {
      success: false,
      message: 'Erro ao configurar pasta: ' + error.message
    };
  }
}

/**
 * Obtém a pasta configurada para uploads
 * 
 * @param {string} token - Token de sessão
 * @returns {Object} Resultado com ID da pasta
 */
function getUploadFolder(token) {
  try {
    if (!validateSession(token)) {
      return {
        success: false,
        message: 'Sessão inválida ou expirada'
      };
    }
    
    const folderId = getSetting('upload_folder_id');
    
    if (!folderId) {
      return {
        success: true,
        message: 'Nenhuma pasta configurada',
        folderId: null,
        folderName: null
      };
    }
    
    // Tenta obter informações da pasta
    try {
      const folder = DriveApp.getFolderById(folderId);
      
      return {
        success: true,
        message: 'Pasta encontrada',
        folderId: folderId,
        folderName: folder.getName(),
        folderUrl: folder.getUrl()
      };
      
    } catch (error) {
      return {
        success: false,
        message: 'Pasta configurada não encontrada ou sem acesso',
        folderId: folderId
      };
    }
    
  } catch (error) {
    console.error('[FILES] Erro em getUploadFolder:', error);
    return {
      success: false,
      message: 'Erro ao obter pasta: ' + error.message
    };
  }
}

/**
 * Faz upload de arquivo e associa à transação
 * 
 * @param {string} token - Token de sessão
 * @param {number} transactionId - ID da transação
 * @param {Object} fileData - Dados do arquivo (base64, nome, tipo)
 * @returns {Object} Resultado do upload
 */
function uploadTransactionFile(token, transactionId, fileData) {
  try {
    console.log('[FILES] uploadTransactionFile chamada para transação:', transactionId);
    
    if (!validateSession(token)) {
      return {
        success: false,
        message: 'Sessão inválida ou expirada'
      };
    }
    
    // Valida ID da transação
    if (!transactionId || isNaN(parseInt(transactionId))) {
      return {
        success: false,
        message: 'ID da transação inválido'
      };
    }
    
    // Verifica se a transação existe
    const found = findRowById('Transactions', parseInt(transactionId));
    if (!found) {
      return {
        success: false,
        message: 'Transação não encontrada'
      };
    }
    
    // Valida dados do arquivo
    if (!fileData || !fileData.content || !fileData.name || !fileData.mimeType) {
      return {
        success: false,
        message: 'Dados do arquivo inválidos'
      };
    }

    // VALIDAÇÃO DE TIPO DE ARQUIVO (SEGURANÇA)
    if (!ALLOWED_MIME_TYPES.includes(fileData.mimeType)) {
      console.warn('[FILES] Tipo de arquivo não permitido:', fileData.mimeType);
      return {
        success: false,
        message: 'Tipo de arquivo não permitido. Permitidos: imagens (JPG, PNG, GIF, WEBP), PDF, TXT, Excel, Word'
      };
    }

    // VALIDAÇÃO DE EXTENSÃO (SEGURANÇA)
    const fileName = fileData.name.toLowerCase();
    const hasValidExtension = ALLOWED_EXTENSIONS.some(ext => fileName.endsWith(ext));
    if (!hasValidExtension) {
      console.warn('[FILES] Extensão de arquivo não permitida:', fileName);
      return {
        success: false,
        message: 'Extensão de arquivo não permitida'
      };
    }

    // VALIDAÇÃO DE TAMANHO DE ARQUIVO (SEGURANÇA)
    let base64Data = fileData.content;
    if (base64Data.includes('base64,')) {
      base64Data = base64Data.split('base64,')[1];
    }

    // Calcula tamanho em bytes (base64 é ~33% maior que o arquivo original)
    const estimatedSizeBytes = (base64Data.length * 3) / 4;

    if (estimatedSizeBytes > MAX_FILE_SIZE_BYTES) {
      console.warn('[FILES] Arquivo muito grande:', estimatedSizeBytes, 'bytes');
      return {
        success: false,
        message: `Arquivo muito grande. Tamanho máximo: ${MAX_FILE_SIZE_MB}MB`
      };
    }
    
    // Obtém pasta de upload
    const folderId = getSetting('upload_folder_id');
    if (!folderId) {
      return {
        success: false,
        message: 'Pasta de upload não configurada'
      };
    }
    
    let folder;
    try {
      folder = DriveApp.getFolderById(folderId);
    } catch (error) {
      return {
        success: false,
        message: 'Pasta de upload não encontrada'
      };
    }
    
    // Decodifica base64 com tratamento de erros
    let blob;
    try {
      blob = Utilities.newBlob(
        Utilities.base64Decode(base64Data),
        fileData.mimeType,
        fileData.name
      );
    } catch (decodeError) {
      console.error('[FILES] Erro ao decodificar base64:', decodeError);
      return {
        success: false,
        message: 'Erro ao processar arquivo. Dados corrompidos ou inválidos.'
      };
    }
    
    // Gera nome único para o arquivo
    const timestamp = new Date().getTime();
    const extension = fileData.name.includes('.') ? 
      fileData.name.substring(fileData.name.lastIndexOf('.')) : '';
    const baseName = fileData.name.replace(extension, '').substring(0, 30);
    const newFileName = `TX-${transactionId}-${timestamp}-${baseName}${extension}`;
    
    // Faz upload
    const file = folder.createFile(blob.setName(newFileName));
    const fileId = file.getId();
    const fileUrl = file.getUrl();

    console.log('[FILES] Arquivo criado:', newFileName, 'ID:', fileId);

    // SEGURANÇA: Não compartilha publicamente por padrão
    // Mantém permissões restritas (apenas proprietário)
    try {
      // Define permissões mais restritivas
      file.setSharing(DriveApp.Access.PRIVATE, DriveApp.Permission.VIEW);
      console.log('[FILES] Permissões configuradas como PRIVADAS (seguro)');
    } catch (permError) {
      console.warn('[FILES] Aviso ao configurar permissões:', permError.message);
    }

    // Atualiza transação com ID do arquivo
    const currentData = found.data;
    const now = new Date().toISOString();
    
    // Normaliza a data
    let dateStr = currentData[1];
    if (dateStr instanceof Date) {
      const year = dateStr.getFullYear();
      const month = String(dateStr.getMonth() + 1).padStart(2, '0');
      const day = String(dateStr.getDate()).padStart(2, '0');
      dateStr = `${year}-${month}-${day}`;
    } else if (typeof dateStr === 'string' && dateStr.includes('T')) {
      dateStr = dateStr.split('T')[0];
    }
    
    const updatedRow = [
      parseInt(transactionId),
      dateStr,
      currentData[2], // type
      currentData[3], // category
      currentData[4], // description
      currentData[5], // amount
      currentData[6], // createdAt
      now,            // updatedAt
      fileId          // attachmentId
    ];
    
    const success = updateRow('Transactions', found.rowIndex, updatedRow);
    
    if (!success) {
      // Se falhar ao atualizar, deleta o arquivo
      try {
        DriveApp.getFileById(fileId).setTrashed(true);
      } catch (e) {}
      
      return {
        success: false,
        message: 'Erro ao associar arquivo à transação'
      };
    }
    
    logEvent('FILES', 'INFO', 'uploadTransactionFile', 
      `Arquivo anexado à transação ${transactionId}: ${newFileName}`, '');
    
    return {
      success: true,
      message: 'Arquivo enviado com sucesso',
      file: {
        id: fileId,
        name: newFileName,
        url: fileUrl,
        mimeType: fileData.mimeType,
        size: blob.getBytes().length
      }
    };
    
  } catch (error) {
    console.error('[FILES] Erro em uploadTransactionFile:', error);
    logEvent('FILES', 'ERROR', 'uploadTransactionFile', 'Erro ao fazer upload', error.stack);
    return {
      success: false,
      message: 'Erro ao enviar arquivo: ' + error.message
    };
  }
}

/**
 * Obtém informações do arquivo anexado a uma transação
 * 
 * @param {string} token - Token de sessão
 * @param {number} transactionId - ID da transação
 * @returns {Object} Informações do arquivo
 */
function getTransactionFile(token, transactionId) {
  try {
    console.log('[FILES] getTransactionFile - ID:', transactionId);
    
    if (!validateSession(token)) {
      return { success: false, message: 'Sessão inválida' };
    }
    
    // Busca transação
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('Transactions');
    const data = sheet.getDataRange().getValues();
    
    let rowData = null;
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] == transactionId) {
        rowData = data[i];
        break;
      }
    }
    
    if (!rowData) {
      console.log('[FILES] Transação não encontrada');
      return { success: false, message: 'Transação não encontrada' };
    }
    
    const fileId = rowData[8] ? String(rowData[8]).trim() : null;
    console.log('[FILES] FileId:', fileId);
    
    if (!fileId) {
      return { success: true, hasFile: false, message: 'Nenhum arquivo anexado' };
    }
    
    try {
      const file = DriveApp.getFileById(fileId);
      
      // Configura permissões
      try {
        file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      } catch (e) {
        console.warn('[FILES] Não foi possível alterar permissões:', e.message);
      }
      
      const viewUrl = 'https://drive.google.com/file/d/' + fileId + '/view';
      const downloadUrl = 'https://drive.google.com/uc?export=download&id=' + fileId;
      
      return {
        success: true,
        hasFile: true,
        file: {
          id: fileId,
          name: file.getName(),
          url: file.getUrl(),
          viewUrl: viewUrl,
          downloadUrl: downloadUrl,
          mimeType: file.getMimeType(),
          size: file.getSize()
        }
      };
      
    } catch (fileError) {
      console.error('[FILES] Erro ao acessar arquivo:', fileError);
      return {
        success: false,
        message: 'Arquivo não acessível. Pode ter sido deletado ou você não tem permissão.',
        fileId: fileId
      };
    }
    
  } catch (error) {
    console.error('[FILES] Erro geral:', error);
    return { success: false, message: 'Erro: ' + error.message };
  }
}

/**
 * Remove arquivo anexado de uma transação
 * 
 * @param {string} token - Token de sessão
 * @param {number} transactionId - ID da transação
 * @returns {Object} Resultado da operação
 */
function removeTransactionFile(token, transactionId) {
  try {
    console.log('[FILES] removeTransactionFile chamada para transação:', transactionId);
    
    if (!validateSession(token)) {
      return {
        success: false,
        message: 'Sessão inválida ou expirada'
      };
    }
    
    const found = findRowById('Transactions', parseInt(transactionId));
    if (!found) {
      return {
        success: false,
        message: 'Transação não encontrada'
      };
    }
    
    const fileId = found.data[8];
    
    if (!fileId) {
      return {
        success: true,
        message: 'Nenhum arquivo para remover'
      };
    }
    
    // VALIDAÇÃO DE PROPRIEDADE: Verifica se usuário pode deletar o arquivo
    try {
      const file = DriveApp.getFileById(fileId);

      // Verifica se o arquivo pertence ao proprietário da planilha
      const currentUser = Session.getEffectiveUser().getEmail();
      const fileOwner = file.getOwner().getEmail();
      const spreadsheetOwner = SpreadsheetApp.getActiveSpreadsheet().getOwner().getEmail();

      // Permite delete apenas se usuário é owner da planilha
      if (currentUser !== spreadsheetOwner) {
        console.warn('[FILES] Usuário não autorizado a deletar arquivo:', currentUser);
        return {
          success: false,
          message: 'Você não tem permissão para deletar este arquivo'
        };
      }

      // Move arquivo para lixeira
      file.setTrashed(true);
      console.log('[FILES] Arquivo movido para lixeira:', fileId);
    } catch (error) {
      console.warn('[FILES] Erro ao mover arquivo para lixeira:', error.message);
      return {
        success: false,
        message: 'Erro ao deletar arquivo: ' + error.message
      };
    }
    
    // Remove referência da transação
    const currentData = found.data;
    const now = new Date().toISOString();
    
    let dateStr = currentData[1];
    if (dateStr instanceof Date) {
      const year = dateStr.getFullYear();
      const month = String(dateStr.getMonth() + 1).padStart(2, '0');
      const day = String(dateStr.getDate()).padStart(2, '0');
      dateStr = `${year}-${month}-${day}`;
    } else if (typeof dateStr === 'string' && dateStr.includes('T')) {
      dateStr = dateStr.split('T')[0];
    }
    
    const updatedRow = [
      parseInt(transactionId),
      dateStr,
      currentData[2],
      currentData[3],
      currentData[4],
      currentData[5],
      currentData[6],
      now,
      '' // Remove attachmentId
    ];
    
    const success = updateRow('Transactions', found.rowIndex, updatedRow);
    
    if (!success) {
      return {
        success: false,
        message: 'Erro ao remover referência do arquivo'
      };
    }
    
    logEvent('FILES', 'INFO', 'removeTransactionFile', 
      `Arquivo removido da transação ${transactionId}`, '');
    
    return {
      success: true,
      message: 'Arquivo removido com sucesso'
    };
    
  } catch (error) {
    console.error('[FILES] Erro em removeTransactionFile:', error);
    logEvent('FILES', 'ERROR', 'removeTransactionFile', 'Erro ao remover arquivo', error.stack);
    return {
      success: false,
      message: 'Erro ao remover arquivo: ' + error.message
    };
  }
}