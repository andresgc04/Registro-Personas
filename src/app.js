const express = require('express');
const path = require('path');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');

const config = require('./config/env');
const { globalLimiter } = require('./middlewares/rateLimiter.middleware');
const { notFoundHandler, globalErrorHandler } = require('./middlewares/errorHandler.middleware');

// Rutas
const authRoutes = require('./routes/auth.routes');
const dashboardRoutes = require('./routes/dashboard.routes');
const personaRoutes = require('./routes/persona.routes');
const colegioRoutes = require('./routes/colegio.routes');
const publicRoutes = require('./routes/public.routes');
const newsletterRoutes = require('./routes/newsletter.routes');
const usuarioRoutes = require('./routes/usuario.routes');

const app = express();

// 1. Motor de Vistas EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.set('trust proxy', 1);

// 2. Archivos estáticos
app.use(express.static(path.join(__dirname, 'public')));
app.use('/vendor/chart.js', express.static(path.join(__dirname, '../node_modules/chart.js/dist')));

// 3. Seguridad OWASP: Helmet con Content Security Policy (CSP) optimizado
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: [
          "'self'",
          "'unsafe-inline'", // Necesario para scripts dinámicos en vistas EJS
          "'unsafe-eval'"
        ],
        styleSrc: [
          "'self'",
          "'unsafe-inline'",
          'https://fonts.googleapis.com'
        ],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'", 'https:']
      }
    },
    crossOriginEmbedderPolicy: false
  })
);

// 4. Rate Limiting Global
app.use(globalLimiter);

// 5. Body Parsers con límites de tamaño seguros (Mitigación DoS OWASP)
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: true, limit: '100kb' }));

// 6. Cookie Parser para autenticación JWT segura
app.use(cookieParser());

// 7. Logger HTTP
if (config.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// 8. Variables globales disponibles en todas las vistas
app.use((req, res, next) => {
  res.locals.currentYear = new Date().getFullYear();
  res.locals.currentUser = null;
  next();
});

// 9. Enrutamiento Principal
// Redirección raíz al dashboard (o al login si no está autenticado)
app.get('/', (req, res) => {
  if (req.cookies && req.cookies.auth_token) {
    return res.redirect('/dashboard');
  }
  return res.redirect('/auth/login');
});

// Módulos
app.use('/auth', authRoutes);
app.use('/dashboard', dashboardRoutes);
app.use('/personas', personaRoutes);
app.use('/colegios', colegioRoutes);
app.use('/registro', publicRoutes); // Enlace público compartible sin autenticación
app.use('/newsletter', newsletterRoutes);
app.use('/usuarios', usuarioRoutes);

// 10. Manejo de Errores (404 y 500)
app.use(notFoundHandler);
app.use(globalErrorHandler);

module.exports = app;
