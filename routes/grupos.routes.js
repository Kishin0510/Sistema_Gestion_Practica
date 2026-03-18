const express = require('express');
const router = express.Router();
const gruposController = require('../db/controllers/gruposController');

// Vistas de la aplicación
router.get('/', gruposController.listar);
router.get('/crear', gruposController.formCrear);
router.post('/crear', gruposController.crear);
router.get('/editar/:id', gruposController.formEditar);
router.post('/editar/:id', gruposController.actualizar);
router.post('/eliminar/:id', gruposController.eliminar);
router.get('/api/usuarios/grupo/:id', gruposController.getUsuariosPorGrupo);
router.get('/api/lista-grupos', gruposController.getListaGrupos);
router.post('/api/usuarios/cambiar-grupo', gruposController.cambiarGrupoUsuario);
router.get('/api/personas/buscar/id/:id', gruposController.buscarPersonaPorId);
router.get('/api/personas/buscar/run/:run', gruposController.buscarPersonaPorRun);

module.exports = router;