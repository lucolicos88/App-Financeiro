/**
 * =============================================================================
 * EMAIL-REPORTS.GS - Módulo de Envio de Relatórios por Email
 * =============================================================================
 *
 * Responsável por enviar relatórios financeiros formatados por email:
 * - Relatórios mensais automáticos
 * - Relatórios personalizados sob demanda
 * - Templates HTML profissionais
 * - Gráficos e tabelas formatadas
 *
 * Versão: 2.4.0
 * =============================================================================
 */

/**
 * Envia relatório por email (chamada manual)
 *
 * @param {string} token - Token de sessão
 * @param {string} reportType - Tipo de relatório (monthly, annual, custom)
 * @param {Object} options - Opções adicionais
 * @returns {Object} Resultado
 */
function sendEmailReport(token, reportType, options) {
  try {
    console.log('[EMAIL] sendEmailReport chamada, tipo:', reportType);

    if (!validateSession(token)) {
      return {
        success: false,
        message: 'Sessão inválida ou expirada'
      };
    }

    // Obter configurações
    const settingsResult = getUserSettings(token);
    if (!settingsResult.success) {
      return settingsResult;
    }

    const settings = settingsResult.data;
    const email = settings.email || Session.getActiveUser().getEmail();

    // Gerar relatório baseado no tipo
    let reportData;
    let subject;
    let htmlBody;

    if (reportType === 'monthly') {
      const now = new Date();
      const year = options?.year || now.getFullYear();
      const month = options?.month || now.getMonth() + 1;

      reportData = getMonthlyReport(token, year, month);
      if (!reportData.success) {
        return reportData;
      }

      subject = `Relatório Financeiro - ${getMonthName(month)}/${year}`;
      htmlBody = generateMonthlyReportHTML(reportData.data, settings);

    } else if (reportType === 'annual') {
      const year = options?.year || new Date().getFullYear();

      reportData = getAnnualReport(token, year);
      if (!reportData.success) {
        return reportData;
      }

      subject = `Relatório Anual - ${year}`;
      htmlBody = generateAnnualReportHTML(reportData.data, settings);

    } else if (reportType === 'custom') {
      const startDate = options?.startDate;
      const endDate = options?.endDate;

      if (!startDate || !endDate) {
        return {
          success: false,
          message: 'Datas inicial e final são obrigatórias para relatório personalizado'
        };
      }

      reportData = getReportByPeriod(token, startDate, endDate);
      if (!reportData.success) {
        return reportData;
      }

      subject = `Relatório Personalizado - ${startDate} a ${endDate}`;
      htmlBody = generateCustomReportHTML(reportData.data, settings);

    } else {
      return {
        success: false,
        message: 'Tipo de relatório inválido'
      };
    }

    // Enviar email
    GmailApp.sendEmail(email, subject, '', {
      htmlBody: htmlBody,
      name: 'Controle Financeiro'
    });

    console.log('[EMAIL] Email enviado para:', email);

    // Atualizar data do último envio
    updateUserSettings(token, {
      lastReportSentDate: new Date().toISOString()
    });

    return {
      success: true,
      message: 'Relatório enviado por email com sucesso',
      data: {
        email: email,
        reportType: reportType,
        sentAt: new Date().toISOString()
      }
    };

  } catch (error) {
    console.error('[EMAIL] Erro em sendEmailReport:', error);
    logEvent('EMAIL', 'ERROR', 'sendEmailReport', 'Erro ao enviar email', error.stack);
    return {
      success: false,
      message: 'Erro ao enviar email: ' + error.message
    };
  }
}

/**
 * Função chamada pelo trigger para envio automático
 */
function sendScheduledEmailReport() {
  try {
    console.log('[EMAIL] sendScheduledEmailReport (trigger) chamada');

    // Obter token de admin (usuário ativo)
    const email = Session.getActiveUser().getEmail();

    // Buscar sessão ativa ou criar nova
    const sessions = getSheet(SHEET_NAMES.SESSIONS);
    if (!sessions) {
      console.error('[EMAIL] Planilha de sessões não encontrada');
      return;
    }

    const data = sessions.getDataRange().getValues();
    let token = null;

    // Procurar sessão ativa
    for (let i = data.length - 1; i >= 1; i--) {
      const [tokenValue, , expiresAt] = data[i];
      if (new Date(expiresAt) > new Date()) {
        token = tokenValue;
        break;
      }
    }

    // Se não encontrou sessão, não pode enviar
    if (!token) {
      console.log('[EMAIL] Nenhuma sessão ativa encontrada para envio automático');
      return;
    }

    // Obter configurações
    const settingsResult = getUserSettings(token);
    if (!settingsResult.success) {
      console.error('[EMAIL] Erro ao obter configurações');
      return;
    }

    const settings = settingsResult.data;

    // Verificar se está habilitado
    if (!settings.emailReportsEnabled) {
      console.log('[EMAIL] Envio automático está desabilitado');
      return;
    }

    // Determinar tipo de relatório baseado na frequência
    const frequency = settings.emailReportsFrequency || 'monthly';
    const now = new Date();

    let result;

    if (frequency === 'daily') {
      // Relatório do dia anterior
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);

      const startDate = yesterday.toISOString().split('T')[0];
      const endDate = startDate;

      result = sendEmailReport(token, 'custom', { startDate, endDate });

    } else if (frequency === 'weekly') {
      // Relatório dos últimos 7 dias
      const weekAgo = new Date(now);
      weekAgo.setDate(weekAgo.getDate() - 7);

      const startDate = weekAgo.toISOString().split('T')[0];
      const endDate = now.toISOString().split('T')[0];

      result = sendEmailReport(token, 'custom', { startDate, endDate });

    } else if (frequency === 'monthly') {
      // Relatório do mês anterior
      const lastMonth = now.getMonth() === 0 ? 12 : now.getMonth();
      const year = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();

      result = sendEmailReport(token, 'monthly', { year, month: lastMonth });
    }

    if (result && result.success) {
      console.log('[EMAIL] Relatório automático enviado com sucesso');
    } else {
      console.error('[EMAIL] Erro ao enviar relatório automático');
    }

  } catch (error) {
    console.error('[EMAIL] Erro em sendScheduledEmailReport:', error);
    logEvent('EMAIL', 'ERROR', 'sendScheduledEmailReport', 'Erro no trigger', error.stack);
  }
}

/**
 * Gera HTML para relatório mensal
 */
function generateMonthlyReportHTML(reportData, settings) {
  const { period, summary, byCategory } = reportData;

  const balance = summary.balance;
  const balanceColor = balance >= 0 ? '#10b981' : '#ef4444';
  const balanceIcon = balance >= 0 ? '✅' : '⚠️';

  let categoriesHTML = '';
  byCategory.slice(0, 5).forEach(cat => {
    const typeColor = cat.type === 'credit' ? '#10b981' : '#ef4444';
    categoriesHTML += `
      <tr>
        <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${cat.category}</td>
        <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; color: ${typeColor}; font-weight: 600; text-align: right;">
          ${formatCurrency(cat.total)}
        </td>
        <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: center; color: #6b7280;">
          ${cat.count}
        </td>
      </tr>
    `;
  });

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 0; background-color: #f3f4f6;">
  <div style="max-width: 600px; margin: 0 auto; background-color: white; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">

    <!-- Header -->
    <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center;">
      <h1 style="margin: 0; color: white; font-size: 24px;">💰 Relatório Financeiro</h1>
      <p style="margin: 10px 0 0 0; color: #e0e7ff; font-size: 16px;">
        ${period.startDate} a ${period.endDate}
      </p>
    </div>

    <!-- Summary -->
    <div style="padding: 30px;">
      <div style="background-color: #f9fafb; border-radius: 8px; padding: 20px; margin-bottom: 25px;">
        <h2 style="margin: 0 0 20px 0; color: #1f2937; font-size: 18px;">Resumo do Período</h2>

        <div style="display: flex; justify-content: space-between; margin-bottom: 15px;">
          <span style="color: #6b7280;">📈 Entradas:</span>
          <span style="color: #10b981; font-weight: 600; font-size: 18px;">${formatCurrency(summary.totalCredits)}</span>
        </div>

        <div style="display: flex; justify-content: space-between; margin-bottom: 15px;">
          <span style="color: #6b7280;">📉 Saídas:</span>
          <span style="color: #ef4444; font-weight: 600; font-size: 18px;">${formatCurrency(summary.totalDebits)}</span>
        </div>

        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 15px 0;">

        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span style="color: #1f2937; font-weight: 600; font-size: 16px;">${balanceIcon} Saldo:</span>
          <span style="color: ${balanceColor}; font-weight: 700; font-size: 22px;">${formatCurrency(balance)}</span>
        </div>
      </div>

      <!-- Top Categories -->
      <div>
        <h2 style="margin: 0 0 15px 0; color: #1f2937; font-size: 18px;">Top 5 Categorias</h2>
        <table style="width: 100%; border-collapse: collapse; background-color: #f9fafb; border-radius: 8px; overflow: hidden;">
          <thead>
            <tr style="background-color: #e5e7eb;">
              <th style="padding: 12px 8px; text-align: left; color: #374151; font-weight: 600;">Categoria</th>
              <th style="padding: 12px 8px; text-align: right; color: #374151; font-weight: 600;">Total</th>
              <th style="padding: 12px 8px; text-align: center; color: #374151; font-weight: 600;">Transações</th>
            </tr>
          </thead>
          <tbody>
            ${categoriesHTML}
          </tbody>
        </table>
      </div>

      <div style="margin-top: 25px; padding: 15px; background-color: #eff6ff; border-left: 4px solid #3b82f6; border-radius: 4px;">
        <p style="margin: 0; color: #1e40af; font-size: 14px;">
          <strong>💡 Dica:</strong> Total de ${summary.transactionCount} transações registradas neste período.
        </p>
      </div>
    </div>

    <!-- Footer -->
    <div style="background-color: #f9fafb; padding: 20px; text-align: center; border-top: 1px solid #e5e7eb;">
      <p style="margin: 0; color: #6b7280; font-size: 13px;">
        Controle Financeiro Pessoal<br>
        <a href="${ScriptApp.getService().getUrl()}" style="color: #6366f1; text-decoration: none;">Acessar o aplicativo</a>
      </p>
      <p style="margin: 10px 0 0 0; color: #9ca3af; font-size: 12px;">
        Email enviado automaticamente em ${new Date().toLocaleString('pt-BR')}
      </p>
    </div>

  </div>
</body>
</html>
  `;
}

/**
 * Gera HTML para relatório anual
 */
function generateAnnualReportHTML(reportData, settings) {
  const { year, summary, byMonth } = reportData;

  const balance = summary.balance;
  const balanceColor = balance >= 0 ? '#10b981' : '#ef4444';

  let monthsHTML = '';
  byMonth.forEach(month => {
    const monthBalance = month.balance;
    const monthColor = monthBalance >= 0 ? '#10b981' : '#ef4444';

    monthsHTML += `
      <tr>
        <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${month.monthName}</td>
        <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; color: #10b981; text-align: right;">
          ${formatCurrency(month.totalCredits)}
        </td>
        <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; color: #ef4444; text-align: right;">
          ${formatCurrency(month.totalDebits)}
        </td>
        <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; color: ${monthColor}; font-weight: 600; text-align: right;">
          ${formatCurrency(monthBalance)}
        </td>
      </tr>
    `;
  });

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 0; background-color: #f3f4f6;">
  <div style="max-width: 700px; margin: 0 auto; background-color: white; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">

    <!-- Header -->
    <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center;">
      <h1 style="margin: 0; color: white; font-size: 24px;">📊 Relatório Anual ${year}</h1>
      <p style="margin: 10px 0 0 0; color: #e0e7ff; font-size: 16px;">
        Resumo completo do ano
      </p>
    </div>

    <!-- Summary -->
    <div style="padding: 30px;">
      <div style="background-color: #f9fafb; border-radius: 8px; padding: 20px; margin-bottom: 25px;">
        <h2 style="margin: 0 0 20px 0; color: #1f2937; font-size: 18px;">Totais do Ano</h2>

        <div style="display: flex; justify-content: space-between; margin-bottom: 15px;">
          <span style="color: #6b7280;">📈 Total de Entradas:</span>
          <span style="color: #10b981; font-weight: 600; font-size: 18px;">${formatCurrency(summary.totalCredits)}</span>
        </div>

        <div style="display: flex; justify-content: space-between; margin-bottom: 15px;">
          <span style="color: #6b7280;">📉 Total de Saídas:</span>
          <span style="color: #ef4444; font-weight: 600; font-size: 18px;">${formatCurrency(summary.totalDebits)}</span>
        </div>

        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 15px 0;">

        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span style="color: #1f2937; font-weight: 600; font-size: 16px;">Saldo Anual:</span>
          <span style="color: ${balanceColor}; font-weight: 700; font-size: 22px;">${formatCurrency(balance)}</span>
        </div>
      </div>

      <!-- Monthly Breakdown -->
      <div>
        <h2 style="margin: 0 0 15px 0; color: #1f2937; font-size: 18px;">Resumo Mensal</h2>
        <div style="overflow-x: auto;">
          <table style="width: 100%; border-collapse: collapse; background-color: #f9fafb; border-radius: 8px; overflow: hidden;">
            <thead>
              <tr style="background-color: #e5e7eb;">
                <th style="padding: 12px 8px; text-align: left; color: #374151; font-weight: 600;">Mês</th>
                <th style="padding: 12px 8px; text-align: right; color: #374151; font-weight: 600;">Entradas</th>
                <th style="padding: 12px 8px; text-align: right; color: #374151; font-weight: 600;">Saídas</th>
                <th style="padding: 12px 8px; text-align: right; color: #374151; font-weight: 600;">Saldo</th>
              </tr>
            </thead>
            <tbody>
              ${monthsHTML}
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Footer -->
    <div style="background-color: #f9fafb; padding: 20px; text-align: center; border-top: 1px solid #e5e7eb;">
      <p style="margin: 0; color: #6b7280; font-size: 13px;">
        Controle Financeiro Pessoal<br>
        <a href="${ScriptApp.getService().getUrl()}" style="color: #6366f1; text-decoration: none;">Acessar o aplicativo</a>
      </p>
    </div>

  </div>
</body>
</html>
  `;
}

/**
 * Gera HTML para relatório personalizado
 */
function generateCustomReportHTML(reportData, settings) {
  return generateMonthlyReportHTML(reportData, settings);
}
