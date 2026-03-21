const express = require('express');
const router = express.Router();
const gruposController = require('../db/controllers/gruposController');

router.get('/', gruposController.listar);
router.get('/api/grupos/:id', gruposController.obtenerPorId);
router.get('/api/usuarios/grupo/:id', gruposController.getUsuariosPorGrupo);
router.get('/api/grupos/lista', gruposController.getListaGrupos); 
router.post('/api/usuarios/cambiar-grupo-multiple', gruposController.cambiarGrupoMultiple);
router.get('/crear', gruposController.formCrear);
router.post('/crear', gruposController.crear);
router.post('/editar/:id', gruposController.actualizar);
router.post('/eliminar/:id', gruposController.eliminar);

module.exports = router;