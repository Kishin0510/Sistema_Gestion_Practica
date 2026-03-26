const express = require('express');
const router = express.Router();
const alertasController = require('../db/controllers/alertasController');
const { permisoPara } = require('../middlewares/roleAuth');

router.get('/',
    permisoPara(['SUPER_ADMIN', 'ADMIN_CLIENTE']),
    alertasController.listarAlertas
);
router.post('/marcar-leida/:id',
    permisoPara(['SUPER_ADMIN', 'ADMIN_CLIENTE']),
    alertasController.marcarLeida
);
router.post('/marcar-todas',
    permisoPara(['SUPER_ADMIN', 'ADMIN_CLIENTE']),
    alertasController.marcarTodasLeidas
);
router.post('/eliminar/:id',
    permisoPara(['SUPER_ADMIN', 'ADMIN_CLIENTE']),
    alertasController.eliminarAlerta
);
module.exports = router;