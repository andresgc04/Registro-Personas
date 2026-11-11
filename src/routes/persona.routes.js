const express = require('express');
const router = express.Router();
const PersonaController = require('../controllers/persona.controller');
const { requireAuth, requirePermission } = require('../middlewares/auth.middleware');
const { personaValidationRules, handleValidationErrors } = require('../middlewares/validation.middleware');

// Rutas protegidas para Administradores con permiso en 'personas'
router.use(requireAuth, requirePermission('personas'));

router.get('/', PersonaController.index);
router.get('/nuevo', PersonaController.showCreate);
router.post('/nuevo', personaValidationRules, handleValidationErrors, PersonaController.create);
router.get('/:id', PersonaController.show);
router.get('/:id/editar', PersonaController.showEdit);
router.post('/:id/editar', personaValidationRules, handleValidationErrors, PersonaController.update);
router.post('/:id/toggle', PersonaController.toggleStatus);

module.exports = router;
