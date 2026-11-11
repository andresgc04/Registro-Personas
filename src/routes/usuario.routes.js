const express = require('express');
const router = express.Router();
const UsuarioController = require('../controllers/usuario.controller');
const { requireAuth, requirePermission } = require('../middlewares/auth.middleware');
const { userCreateValidationRules, userEditValidationRules, handleValidationErrors } = require('../middlewares/validation.middleware');

// Todas las rutas de usuarios requieren autenticación y permiso del módulo 'usuarios' (Superadmin)
router.use(requireAuth, requirePermission('usuarios'));

router.get('/', UsuarioController.index);
router.get('/nuevo', UsuarioController.showCreate);
router.post('/nuevo', userCreateValidationRules, handleValidationErrors, UsuarioController.create);
router.get('/:id/editar', UsuarioController.showEdit);
router.post('/:id/editar', userEditValidationRules, handleValidationErrors, UsuarioController.update);
router.post('/:id/toggle', UsuarioController.toggleStatus);
router.post('/:id/eliminar', UsuarioController.delete);

module.exports = router;

