/**
 * =============================================================================
 * WEBAPP.GS - Módulo do Servidor Web (Web App)
 * =============================================================================
 * 
 * Responsável por:
 * - Servir a interface HTML
 * - Processar requisições HTTP
 * - Rotear chamadas para funções apropriadas
 * - Retornar respostas JSON
 * 
 * Este é o ponto de entrada da aplicação web.
 * =============================================================================
 */

/**
 * Função doGet - Serve a interface HTML
 * Chamada quando usuário acessa a URL do Web App
 * 
 * @param {Object} e - Objeto de evento com parâmetros da requisição
 * @returns {HtmlOutput} Interface HTML
 */
function doGet(e) {
  try {
    // Cria output HTML
    const template = HtmlService.createTemplateFromFile('main');
    
    // Avalia template
    const htmlOutput = template.evaluate();
    
    // Configura título e outras propriedades
    htmlOutput.setTitle('Controle Financeiro Pessoal')
              .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
              .addMetaTag('viewport', 'width=device-width, initial-scale=1');
    
    return htmlOutput;
    
  } catch (error) {
    logError('WEBAPP', 'doGet', error);
    return HtmlService.createHtmlOutput('<h1>Erro ao carregar aplicação</h1><p>' + error.message + '</p>');
  }
}

/**
 * Função doPost - Processa requisições POST (não usado nesta versão)
 * 
 * @param {Object} e - Objeto de evento
 * @returns {Object} Resposta
 */
function doPost(e) {
  return ContentService.createTextOutput(JSON.stringify({
    success: false,
    message: 'Método POST não suportado'
  })).setMimeType(ContentService.MimeType.JSON);
}

/**
 * Include - Função helper para incluir arquivos HTML
 * Permite modularização do HTML (não usado aqui, mas útil)
 * 
 * @param {string} filename - Nome do arquivo
 * @returns {string} Conteúdo do arquivo
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/**
 * Obtém URL do Web App
 * Útil para compartilhar ou referenciar
 * 
 * @returns {string} URL do Web App
 */
function getWebAppUrl() {
  return ScriptApp.getService().getUrl();
}

/**
 * Função de teste para verificar se Web App está funcionando
 * 
 * @returns {Object} Informações do sistema
 */
function testWebApp() {
  return {
    success: true,
    message: 'Web App funcionando corretamente',
    timestamp: new Date().toISOString(),
    url: getWebAppUrl(),
    user: Session.getActiveUser().getEmail()
  };
}

/**
 * Retorna configurações públicas (não sensíveis) para o frontend
 * 
 * @returns {Object} Configurações
 */
function getPublicConfig() {
  return {
    appName: 'Controle Financeiro Pessoal',
    version: '1.0.0',
    sessionDuration: SESSION_DURATION,
    maxLoginAttempts: MAX_LOGIN_ATTEMPTS
  };
}

/**
 * Wrapper genérico para chamar funções do backend
 * Adiciona tratamento de erro padrão
 * 
 * @param {string} functionName - Nome da função
 * @param {Array} args - Argumentos da função
 * @returns {Object} Resultado da função
 */
function callBackendFunction(functionName, args) {
  try {
    // Verifica se função existe
    if (typeof this[functionName] !== 'function') {
      return {
        success: false,
        message: 'Função não encontrada: ' + functionName
      };
    }
    
    // Executa função
    const result = this[functionName].apply(this, args);
    
    return result;
    
  } catch (error) {
    logError('WEBAPP', functionName, error);
    return {
      success: false,
      message: 'Erro ao executar função: ' + error.message
    };
  }
}

/**
 * =============================================================================
 * FUNÇÕES DE PARCELAMENTO DISPONÍVEIS VIA google.script.run
 * =============================================================================
 * 
 * As seguintes funções estão disponíveis para o frontend chamar via
 * google.script.run:
 * 
 * TRANSAÇÕES PARCELADAS:
 * - createTransaction(token, data) - Detecta automaticamente se é parcelado
 * - createInstallmentTransactions(token, data) - Cria parcelas diretamente
 * - getInstallmentGroup(token, parentId) - Busca parcelas de um grupo
 * - deleteInstallmentGroup(token, parentId) - Deleta todas as parcelas
 * 
 * DASHBOARD COM PARCELAMENTO:
 * - getMainKPIs(token) - Retorna KPIs incluindo débitos parcelados
 * - getUpcomingInstallments(token, months) - Parcelas a vencer
 * - getPaymentMethodDistribution(token, startDate, endDate) - Distribuição por forma
 * - getInstallmentStats(token) - Estatísticas de parcelamento
 * 
 * RELATÓRIOS DE PARCELAMENTO:
 * - getInstallmentReport(token, startDate, endDate) - Relatório completo
 * - getInstallmentProjection(token, months) - Projeção futura
 * - getInstallmentCommitmentAnalysis(token, monthlyIncome) - Análise de comprometimento
 * - getInstallmentReportByPaymentMethod(token, method, start, end) - Por forma de pgto
 * 
 * EXEMPLO DE USO NO FRONTEND:
 * 
 * // Criar transação parcelada
 * google.script.run
 *   .withSuccessHandler(onSuccess)
 *   .withFailureHandler(onFailure)
 *   .createTransaction(token, {
 *     date: '2025-10-01',
 *     type: 'debit',
 *     category: 'Alimentação',
 *     description: 'Compra no supermercado',
 *     amount: 1200,
 *     paymentMethod: 'Crédito parcelado',
 *     installments: 12,
 *     attachmentId: ''
 *   });
 * 
 * // Buscar parcelas a vencer nos próximos 3 meses
 * google.script.run
 *   .withSuccessHandler(onSuccess)
 *   .withFailureHandler(onFailure)
 *   .getUpcomingInstallments(token, 3);
 * 
 * // Obter relatório de parcelas
 * google.script.run
 *   .withSuccessHandler(onSuccess)
 *   .withFailureHandler(onFailure)
 *   .getInstallmentReport(token, '2025-01-01', '2025-12-31');
 * 
 * =============================================================================
 */

/**
 * =============================================================================
 * FORMAS DE PAGAMENTO SUPORTADAS
 * =============================================================================
 * 
 * Lista de valores válidos para o campo "paymentMethod":
 * 
 * - 'Dinheiro'           - Pagamento em espécie
 * - 'Débito'             - Cartão de débito
 * - 'Crédito à vista'    - Cartão de crédito em 1x
 * - 'Crédito parcelado'  - Cartão de crédito parcelado (2x ou mais)
 * - 'PIX'                - Transferência via PIX
 * - 'Boleto'             - Boleto bancário
 * - 'Transferência'      - TED/DOC/Transferência
 * - 'Outros'             - Outras formas de pagamento
 * 
 * REGRAS DE PARCELAMENTO:
 * 
 * - installments: número inteiro entre 1 e 60
 * - installments = 1: transação única (à vista)
 * - installments > 1: cria múltiplas transações vinculadas
 * - Cada parcela recebe data incrementada em 1 mês
 * - Parcelas são vinculadas via parentTransactionId
 * - Descrição recebe sufixo (N/TOTAL) automaticamente
 * 
 * VALIDAÇÕES:
 * 
 * - Se installments > 1 e paymentMethod não fornecido: usa 'Crédito parcelado'
 * - Se installments = 1 e paymentMethod não fornecido: usa 'Outros'
 * - Valor é dividido igualmente entre parcelas (última recebe ajuste)
 * - Data base deve ser válida no formato YYYY-MM-DD
 * 
 * =============================================================================
 */