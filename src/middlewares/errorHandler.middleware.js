const config = require('../config/env');

/**
 * Middleware para rutas no encontradas (404)
 */
function notFoundHandler(req, res) {
  res.status(404);
  if (req.xhr || (req.headers.accept && req.headers.accept.includes('application/json'))) {
    return res.json({ error: 'Recurso no encontrado (404).' });
  }
  return res.render('errors/404', {
    title: 'Página No Encontrada - 404',
    url: req.originalUrl,
    currentUser: res.locals.currentUser || null
  });
}

/**
 * Manejador centralizado de errores (OWASP A05: Security Misconfiguration)
 * Oculta stack traces en producción para evitar divulgación de información sensible.
 */
function globalErrorHandler(err, req, res, next) {
  const statusCode = err.status || 500;
  console.error(`[Error Handler] ${req.method} ${req.url} -> Error:`, err.message);

  if (config.NODE_ENV === 'development') {
    console.error(err.stack);
  }

  res.status(statusCode);

  if (req.xhr || (req.headers.accept && req.headers.accept.includes('application/json'))) {
    return res.json({
      error: config.NODE_ENV === 'development' ? err.message : 'Ha ocurrido un error interno en el servidor.'
    });
  }

  return res.render('errors/500', {
    title: 'Error del Servidor - 500',
    message: config.NODE_ENV === 'development' ? err.message : 'Ocurrió un error inesperado. Intente de nuevo más tarde.',
    stack: config.NODE_ENV === 'development' ? err.stack : null,
    currentUser: res.locals.currentUser || null
  });
}

module.exports = {
  notFoundHandler,
  globalErrorHandler
};
