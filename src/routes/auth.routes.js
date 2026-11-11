const express = require('express');
const router = express.Router();
const AuthController = require('../controllers/auth.controller');
const { authLimiter } = require('../middlewares/rateLimiter.middleware');
const { redirectIfAuthenticated } = require('../middlewares/auth.middleware');
const { loginValidationRules, handleValidationErrors } = require('../middlewares/validation.middleware');

router.get('/login', redirectIfAuthenticated, AuthController.showLogin);
router.post('/login', authLimiter, loginValidationRules, handleValidationErrors, AuthController.login);
router.get('/logout', AuthController.logout);
router.post('/logout', AuthController.logout);

module.exports = router;
