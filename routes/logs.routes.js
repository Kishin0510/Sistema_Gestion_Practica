const express = require('express');
const router = express.Router();
const logsController = require('../db/controllers/logsController');


router.get('/registro-cambios', logsController.listarLogs);

module.exports = router;