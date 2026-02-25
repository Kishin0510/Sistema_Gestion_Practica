const express = require('express');
const router = express.Router();
const controller = require('../db/controllers/documentosPersonaController');

router.get('/', controller.index);
router.post('/registrar', controller.registrar);
router.delete('/eliminar/:id', controller.eliminar);

module.exports = router;