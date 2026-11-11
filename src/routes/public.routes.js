const express = require('express');
const router = express.Router();
const PublicController = require('../controllers/public.controller');
const { publicRegisterLimiter } = require('../middlewares/rateLimiter.middleware');
const { personaValidationRules, handleValidationErrors } = require('../middlewares/validation.middleware');

// Formulario público de registro accesible sin autenticación
router.get('/', PublicController.showRegister);
router.post('/', publicRegisterLimiter, personaValidationRules, handleValidationErrors, PublicController.register);
router.get('/exito', PublicController.showSuccess);

module.exports = router;
