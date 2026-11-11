const express = require('express');
const router = express.Router();
const NewsletterController = require('../controllers/newsletter.controller');
const { requireAuth, requirePermission } = require('../middlewares/auth.middleware');
const { newsletterValidationRules, handleValidationErrors } = require('../middlewares/validation.middleware');
const { handleNewsletterUpload } = require('../middlewares/upload.middleware');

// Rutas protegidas para Administradores con permiso en 'newsletter'
router.use(requireAuth, requirePermission('newsletter'));

router.get('/', NewsletterController.index);
router.post('/enviar', handleNewsletterUpload, newsletterValidationRules, handleValidationErrors, NewsletterController.send);
router.post('/probar-smtp', NewsletterController.testSmtp);

module.exports = router;
