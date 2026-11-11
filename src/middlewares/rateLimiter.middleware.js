const rateLimit = require('express-rate-limit');

// Rate limit global general (OWASP: Prevención de Denegación de Servicio / DoS)
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 300, // Máximo 300 peticiones por IP
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Demasiadas solicitudes desde esta IP, por favor intente nuevamente en 15 minutos.'
});

// Rate limit estricto para Login (OWASP A07: Prevención de ataques de Fuerza Bruta y Credential Stuffing)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 10, // Máximo 10 intentos de login
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Demasiados intentos de inicio de sesión. Por motivos de seguridad su IP ha sido bloqueada temporalmente durante 15 minutos.'
});

// Rate limit para el enlace público de registro de personas (Prevención de bots / spam de formularios)
const publicRegisterLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 20, // Máximo 20 registros por hora por IP
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Ha superado el límite de registros permitidos por hora desde su red. Por favor intente más tarde.'
});

module.exports = {
  globalLimiter,
  authLimiter,
  publicRegisterLimiter
};
