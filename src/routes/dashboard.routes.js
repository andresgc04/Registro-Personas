const express = require('express');
const router = express.Router();
const DashboardController = require('../controllers/dashboard.controller');
const { requireAuth, requirePermission } = require('../middlewares/auth.middleware');

router.get('/', requireAuth, requirePermission('dashboard'), DashboardController.index);

module.exports = router;
