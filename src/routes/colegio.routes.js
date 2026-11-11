const express = require('express');
const router = express.Router();
const ColegioController = require('../controllers/colegio.controller');
const { requireAuth, requirePermission } = require('../middlewares/auth.middleware');
const { colegioValidationRules, handleValidationErrors } = require('../middlewares/validation.middleware');

// Rutas protegidas para Administradores con permiso en 'colegios'
router.use(requireAuth, requirePermission('colegios'));

router.get('/', ColegioController.index);
router.get('/nuevo', ColegioController.showCreate);
router.post('/nuevo', colegioValidationRules, handleValidationErrors, ColegioController.create);
router.post('/:id/toggle', ColegioController.toggleStatus);

module.exports = router;
