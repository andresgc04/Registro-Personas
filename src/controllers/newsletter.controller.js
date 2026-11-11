const fs = require('fs');
const PersonaModel = require('../models/persona.model');
const NewsletterModel = require('../models/newsletter.model');
const mailerService = require('../services/mailer.service');
const config = require('../config/env');

class NewsletterController {
  /**
   * Vista principal del módulo de Boletines
   */
  static async index(req, res) {
    try {
      const { msg = '', type = 'info' } = req.query;

      // Obtener personas activas elegibles para recibir boletines
      const personasActivas = await PersonaModel.findActivasParaBoletin();
      const historial = await NewsletterModel.findAll();

      // Diagnóstico del estado del servidor SMTP
      const smtpStatus = await mailerService.verifyConnection();

      return res.render('newsletter/index', {
        title: 'Boletines Informativos (Email y WhatsApp)',
        currentUser: req.user,
        personasActivas,
        historial,
        smtpStatus,
        smtpConfig: {
          host: config.SMTP_HOST,
          port: config.SMTP_PORT,
          user: config.SMTP_USER,
          isPlaceholder: mailerService.isPlaceholderConfig()
        },
        alertMessage: msg || null,
        alertType: type,
        errors: [],
        oldInput: {},
        whatsappQueue: null,
        emailResults: null,
        imagenesAdjuntas: null,
        path: '/newsletter'
      });
    } catch (error) {
      console.error('[NewsletterController index error]:', error);
      return res.render('newsletter/index', {
        title: 'Boletines Informativos',
        currentUser: req.user,
        personasActivas: [],
        historial: [],
        smtpStatus: { connected: false, error: error.message },
        smtpConfig: {
          host: config.SMTP_HOST,
          port: config.SMTP_PORT,
          user: config.SMTP_USER,
          isPlaceholder: true
        },
        alertMessage: 'Error al cargar la información del módulo de boletines.',
        alertType: 'error',
        errors: [],
        oldInput: {},
        whatsappQueue: null,
        emailResults: null,
        imagenesAdjuntas: null,
        path: '/newsletter'
      });
    }
  }

  /**
   * Procesa el envío del boletín por Email y/o prepara la cola de WhatsApp con soporte de imágenes
   */
  static async send(req, res) {
    const { titulo, mensaje, canal } = req.body;
    const files = req.files || [];

    if (req.validationErrors && req.validationErrors.length > 0) {
      // Limpiar archivos si hubo error de validación
      if (files.length > 0) {
        files.forEach(f => {
          try { fs.unlinkSync(f.path); } catch (e) { /* ignore */ }
        });
      }

      const personasActivas = await PersonaModel.findActivasParaBoletin();
      const historial = await NewsletterModel.findAll();
      const smtpStatus = await mailerService.verifyConnection();

      return res.status(422).render('newsletter/index', {
        title: 'Boletines Informativos',
        currentUser: req.user,
        personasActivas,
        historial,
        smtpStatus,
        smtpConfig: {
          host: config.SMTP_HOST,
          port: config.SMTP_PORT,
          user: config.SMTP_USER,
          isPlaceholder: mailerService.isPlaceholderConfig()
        },
        alertMessage: 'Por favor complete correctamente los campos del boletín.',
        alertType: 'error',
        errors: req.validationErrors,
        oldInput: req.body,
        whatsappQueue: null,
        emailResults: null,
        imagenesAdjuntas: null,
        path: '/newsletter'
      });
    }

    try {
      const destinatarios = await PersonaModel.findActivasParaBoletin();

      if (destinatarios.length === 0) {
        return res.redirect('/newsletter?msg=' + encodeURIComponent('No hay personas activas para recibir el boletín.') + '&type=warning');
      }

      // Procesar metadatos de imágenes adjuntas
      const imagenes = files.map(f => ({
        filename: f.filename,
        originalname: f.originalname,
        mimetype: f.mimetype,
        size: f.size,
        url: `/uploads/boletines/${f.filename}`,
        path: f.path
      }));

      const baseUrl = `${req.protocol}://${req.get('host')}`;
      const imgAbsoluteUrls = imagenes.map(img => `${baseUrl}${img.url}`);

      let emailResults = {
        exitosos: [],
        fallidos: []
      };
      let whatsappLinks = [];

      // 1. Envío por Correo Electrónico
      if (canal === 'email' || canal === 'ambos') {
        // Bloque HTML con imágenes incrustadas (Inline CID)
        const imagenesHtml = imagenes.length > 0
          ? `
            <div style="margin: 24px 0 12px 0;">
              ${imagenes.map((img, i) => `
                <div style="margin-bottom: 16px; text-align: center;">
                  <img src="cid:boletin_img_${i}" alt="${img.originalname}" style="max-width: 100%; height: auto; border-radius: 8px; border: 1px solid #e2e8f0; display: inline-block; box-shadow: 0 2px 5px rgba(0,0,0,0.06);" />
                </div>
              `).join('')}
            </div>
          `
          : '';

        const htmlTemplate = `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 620px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
            <div style="padding-bottom: 16px; border-bottom: 2px solid #4f46e5; margin-bottom: 20px;">
              <span style="font-size: 11px; font-weight: 700; color: #4f46e5; text-transform: uppercase; letter-spacing: 0.05em;">Comunicado Oficial</span>
              <h1 style="color: #0f172a; font-size: 22px; font-weight: 800; margin: 6px 0 0 0; line-height: 1.3;">${titulo}</h1>
            </div>
            
            <div style="color: #334155; line-height: 1.7; font-size: 15px; white-space: pre-wrap;">
${mensaje}
            </div>

            ${imagenesHtml}

            <div style="margin-top: 32px; padding-top: 16px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #64748b; text-align: center;">
              <p style="margin: 0;">Este es un mensaje institucional del Sistema de Registro Comunitario.</p>
              <p style="margin: 4px 0 0 0; color: #94a3b8;">Usted recibe este correo porque sus datos están registrados en nuestro padrón de seguimiento.</p>
            </div>
          </div>
        `;

        // Adjuntos para Nodemailer con CID para visualización inline directa
        const emailAttachments = imagenes.map((img, i) => ({
          filename: img.originalname,
          path: img.path,
          cid: `boletin_img_${i}`
        }));

        for (const persona of destinatarios) {
          if (persona.email && persona.email.includes('@')) {
            const sendRes = await mailerService.sendNewsletterEmail({
              to: persona.email,
              subject: titulo,
              htmlContent: htmlTemplate,
              textContent: `${titulo}\n\n${mensaje}${imgAbsoluteUrls.length > 0 ? '\n\nImágenes adjuntas:\n' + imgAbsoluteUrls.join('\n') : ''}\n\n---\nSistema de Registro de Personas`,
              attachments: emailAttachments
            });

            if (sendRes.success) {
              emailResults.exitosos.push({
                nombre: `${persona.nombre} ${persona.apellido}`,
                email: persona.email,
                previewUrl: sendRes.previewUrl
              });
            } else {
              emailResults.fallidos.push({
                nombre: `${persona.nombre} ${persona.apellido}`,
                email: persona.email,
                error: sendRes.error
              });
            }
          }
        }
      }

      // 2. Preparación de Enlaces de WhatsApp
      if (canal === 'whatsapp' || canal === 'ambos') {
        whatsappLinks = destinatarios.map(p => {
          let phoneClean = p.telefono.replace(/[^0-9]/g, '');
          if (phoneClean.length === 10) {
            phoneClean = '1' + phoneClean;
          }

          let textoPersonalizado = `Hola ${p.nombre},\n\n*${titulo}*\n\n${mensaje}`;
          if (imgAbsoluteUrls.length > 0) {
            textoPersonalizado += `\n\n📷 *Imagen(es) adjunta(s):*\n` + imgAbsoluteUrls.join('\n');
          }

          const waUrl = `https://api.whatsapp.com/send?phone=${phoneClean}&text=${encodeURIComponent(textoPersonalizado)}`;

          return {
            personaId: p.id,
            nombreCompleto: `${p.nombre} ${p.apellido}`,
            telefono: p.telefono,
            waUrl
          };
        });
      }

      // 3. Registrar boletín en la base de datos con sus imágenes
      const destinatariosCount = (canal === 'email')
        ? emailResults.exitosos.length
        : (canal === 'whatsapp' ? whatsappLinks.length : destinatarios.length);

      await NewsletterModel.create({
        titulo,
        mensaje,
        canal,
        destinatarios_count: destinatariosCount,
        imagenes,
        enviado_por: req.user ? req.user.id : null
      });

      const personasActivas = await PersonaModel.findActivasParaBoletin();
      const historial = await NewsletterModel.findAll();
      const smtpStatus = await mailerService.verifyConnection();

      // Construcción del mensaje de respuesta detallado
      let alertMsg = '';
      let alertType = 'success';

      const imgInfo = imagenes.length > 0 ? ` con ${imagenes.length} imagen(es) adjunta(s)` : '';

      if (canal === 'email') {
        if (emailResults.fallidos.length === 0) {
          alertMsg = `Boletín enviado exitosamente por correo${imgInfo} a ${emailResults.exitosos.length} personas.`;
        } else if (emailResults.exitosos.length > 0) {
          alertMsg = `Boletín despachado parcialmente${imgInfo}: ${emailResults.exitosos.length} enviados con éxito, pero fallaron ${emailResults.fallidos.length}.`;
          alertType = 'warning';
        } else {
          alertMsg = `No se pudo entregar ningún correo (${emailResults.fallidos.length} errores). Revise la configuración de su servidor SMTP abajo.`;
          alertType = 'error';
        }
      } else if (canal === 'whatsapp') {
        alertMsg = `Se prepararon ${whatsappLinks.length} enlaces de WhatsApp listos para enviar${imgInfo}.`;
      } else {
        alertMsg = `Distribución completada${imgInfo}: ${emailResults.exitosos.length} correos entregados y ${whatsappLinks.length} chats de WhatsApp listos.`;
      }

      return res.render('newsletter/index', {
        title: 'Boletines Informativos (Resultados de Distribución)',
        currentUser: req.user,
        personasActivas,
        historial,
        smtpStatus,
        smtpConfig: {
          host: config.SMTP_HOST,
          port: config.SMTP_PORT,
          user: config.SMTP_USER,
          isPlaceholder: mailerService.isPlaceholderConfig()
        },
        alertMessage: alertMsg,
        alertType,
        errors: [],
        oldInput: {},
        whatsappQueue: whatsappLinks.length > 0 ? whatsappLinks : null,
        emailResults: (canal === 'email' || canal === 'ambos') ? emailResults : null,
        imagenesAdjuntas: imagenes.length > 0 ? imagenes : null,
        path: '/newsletter'
      });
    } catch (error) {
      console.error('[NewsletterController send error]:', error);
      return res.redirect('/newsletter?msg=' + encodeURIComponent('Ocurrió un error al despachar el boletín: ' + error.message) + '&type=error');
    }
  }

  /**
   * Endpoint para probar la conexión SMTP enviando un correo de prueba
   */
  static async testSmtp(req, res) {
    const { testEmail } = req.body;
    const destino = (testEmail && testEmail.trim()) || (req.user ? req.user.email : 'admin@registropersonas.com');

    try {
      console.log(`[NewsletterController] Ejecutando prueba de correo a: ${destino}`);
      
      const resSend = await mailerService.sendNewsletterEmail({
        to: destino,
        subject: 'Prueba de Conexión del Sistema de Envío de Correo',
        htmlContent: `
          <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #4f46e5; border-radius: 8px;">
            <h2 style="color: #4f46e5;">¡La conexión de correo funciona correctamente!</h2>
            <p>Este es un correo de prueba enviado desde tu sistema de registro de personas en Express MVC.</p>
            <p style="color: #64748b; font-size: 12px;">Fecha y hora de envío: ${new Date().toLocaleString('es-DO')}</p>
          </div>
        `,
        textContent: '¡La conexión de correo funciona correctamente! Este es un correo de prueba desde tu sistema de registro de personas.'
      });

      if (resSend.success) {
        let msg = `¡Prueba exitosa! Correo enviado correctamente a ${destino}.`;
        if (resSend.previewUrl) {
          msg += ` (Modo Pruebas Ethereal - Link disponible en la pantalla)`;
        }
        return res.redirect('/newsletter?msg=' + encodeURIComponent(msg) + '&type=success');
      } else {
        return res.redirect('/newsletter?msg=' + encodeURIComponent(`Fallo en el envío a ${destino}: ${resSend.error}`) + '&type=error');
      }
    } catch (err) {
      return res.redirect('/newsletter?msg=' + encodeURIComponent(`Error al probar SMTP: ${err.message}`) + '&type=error');
    }
  }
}

module.exports = NewsletterController;
