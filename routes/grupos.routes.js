const express = require('express');
const router = express.Router();
const gruposController = require('../db/controllers/gruposController');
const { permisoPara } = require('../middlewares/roleAuth');


router.get(
    '/',
    permisoPara(['SUPER_ADMIN', 'ADMIN_CLIENTE']),
    gruposController.listar
);
router.get(
    '/crear',
    permisoPara(['SUPER_ADMIN']),
    gruposController.formCrear
);
router.post(
    '/api/crear',
    permisoPara(['SUPER_ADMIN']),
    gruposController.crear
);
router.get(
    '/api/:id',
    permisoPara(['SUPER_ADMIN', 'ADMIN_CLIENTE']),
    gruposController.obtenerPorId
);
router.get(
    '/api/lista',
    permisoPara(['SUPER_ADMIN', 'ADMIN_CLIENTE']),
    gruposController.getListaGrupos
);
router.put(
    '/api/:id',
    permisoPara(['SUPER_ADMIN']),
    gruposController.actualizar
);
router.delete(
    '/api/:id',
    permisoPara(['SUPER_ADMIN']),
    gruposController.eliminar
);
module.exports = router;