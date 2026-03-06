const express = require('express');
const router = express.Router();
const logsController = require('../db/controllers/logsController');

// Responde a: GET /registro-cambios
router.get('/', logsController.listarLogs);
router.get('/detalle/:id', logsController.verDetalleLog);

module.exports = router;