const nodemailer = require('nodemailer');
const config = require('../config/env');

let cachedTransporter = null;
let isEtherealDynamic = false;
let testAccountCredentials = null;

/**
 * Determina si las credenciales SMTP configuradas son de prueba/placeholder
 */
function isPlaceholderConfig() {
  const host = (config.SMTP_HOST || '').toLowerCase();
  const user = (config.SMTP_USER || '').toLowerCase();
  const pass = (config.SMTP_PASS || '').toLowerCase();

  return (
    !user ||
    !pass ||
    user.includes('demo_user') ||
    pass.includes('demo_password') ||
    user.includes('your-email') ||
    host === 'smtp.ethereal.email'
  );
}

/**
 * Inicializa y obtiene el transporte de Nodemailer adecuado
 */
async function getTransporter() {
  if (cachedTransporter) {
    return cachedTransporter;
  }

  // 1. Si el usuario configuró credenciales SMTP reales en .env
  if (!isPlaceholderConfig()) {
    console.log(`[Mailer] Inicializando SMTP real con host: ${config.SMTP_HOST}:${config.SMTP_PORT} (${config.SMTP_USER})`);
    
    const isGmail = config.SMTP_HOST.toLowerCase().includes('gmail');
    const isOutlook = config.SMTP_HOST.toLowerCase().includes('office365') || config.SMTP_HOST.toLowerCase().includes('outlook');

    const cleanPass = isGmail
      ? String(config.SMTP_PASS || '').replace(/\s+/g, '')
      : config.SMTP_PASS;

    const transportOptions = {
      host: config.SMTP_HOST,
      port: config.SMTP_PORT,
      secure: config.SMTP_PORT === 465, // true para 465, false para 587/25
      auth: {
        user: config.SMTP_USER,
        pass: cleanPass
      },
      tls: {
        rejectUnauthorized: false // Permite servidores locales o con certificados autogenerados
      },
      connectionTimeout: 10000,
      greetingTimeout: 5000,
      socketTimeout: 15000
    };

    if (isGmail) {
      transportOptions.service = 'gmail';
    }

    cachedTransporter = nodemailer.createTransport(transportOptions);
    isEtherealDynamic = false;
    return cachedTransporter;
  }

  // 2. Si no hay credenciales SMTP reales, crear cuenta dinámica real en Ethereal para testing
  console.log('[Mailer] Credenciales SMTP reales no configuradas o en modo demo. Creando cuenta de pruebas Ethereal dinámica...');
  try {
    const testAccount = await nodemailer.createTestAccount();
    testAccountCredentials = testAccount;
    cachedTransporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass
      }
    });
    isEtherealDynamic = true;
    console.log(`[Mailer] Cuenta de pruebas Ethereal creada con éxito: ${testAccount.user}`);
    return cachedTransporter;
  } catch (err) {
    console.warn('[Mailer] No se pudo crear cuenta en Ethereal (posible falta de red externa). Usando transporte local de simulación:', err.message);
    cachedTransporter = {
      sendMail: async (options) => {
        console.log(`[Mailer Local Simulado] Para: ${options.to} | Asunto: ${options.subject}`);
        return { messageId: 'simulated-' + Date.now(), accepted: [options.to] };
      },
      verify: async () => true
    };
    isEtherealDynamic = false;
    return cachedTransporter;
  }
}

/**
 * Verifica el estado y conectividad del servidor SMTP actual
 */
async function verifyConnection() {
  try {
    const transporter = await getTransporter();
    if (transporter && typeof transporter.verify === 'function') {
      await transporter.verify();
    }
    return {
      connected: true,
      isEthereal: isEtherealDynamic || isPlaceholderConfig(),
      host: isEtherealDynamic ? 'smtp.ethereal.email (Generado en tiempo real)' : config.SMTP_HOST,
      user: isEtherealDynamic ? (testAccountCredentials ? testAccountCredentials.user : 'Ethereal Test') : config.SMTP_USER
    };
  } catch (error) {
    console.error('[Mailer Verify Error]:', error.message);
    return {
      connected: false,
      isEthereal: isEtherealDynamic,
      error: error.message,
      code: error.code || 'UNKNOWN'
    };
  }
}

/**
 * Envía un correo electrónico individual con información de entrega y URL de visualización
 */
async function sendNewsletterEmail({ to, subject, htmlContent, textContent, attachments = [] }) {
  try {
    const client = await getTransporter();
    
    // Configurar remitente seguro
    const fromAddress = config.EMAIL_FROM && !config.EMAIL_FROM.includes('noreply@registropersonas.com')
      ? config.EMAIL_FROM
      : (config.SMTP_USER && !isPlaceholderConfig() ? `Sistema de Registro <${config.SMTP_USER}>` : '"Sistema de Registro" <noreply@registropersonas.com>');

    const mailOptions = {
      from: fromAddress,
      to,
      subject,
      text: textContent,
      html: htmlContent,
      attachments: attachments || []
    };

    const info = await client.sendMail(mailOptions);
    
    // Si se usó Ethereal (real o dinámico), obtener la URL web para ver el correo
    let previewUrl = null;
    try {
      previewUrl = nodemailer.getTestMessageUrl(info);
    } catch {
      previewUrl = null;
    }

    if (previewUrl) {
      console.log(`[Mailer Preview Web]: Ver correo enviado a ${to} en: ${previewUrl}`);
    }

    return {
      success: true,
      messageId: info.messageId,
      previewUrl,
      accepted: info.accepted || [to]
    };
  } catch (error) {
    console.error(`[Mailer Send Error a ${to}]:`, error.message);
    return {
      success: false,
      error: error.message,
      code: error.code || 'SEND_ERROR'
    };
  }
}

/**
 * Resetea el transporter (útil si se actualizan variables de entorno)
 */
function resetTransporter() {
  cachedTransporter = null;
  isEtherealDynamic = false;
  testAccountCredentials = null;
}

module.exports = {
  getTransporter,
  verifyConnection,
  sendNewsletterEmail,
  isPlaceholderConfig,
  resetTransporter
};
