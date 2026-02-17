const express = require('express');
const router = express.Router();
const documentoPersonaController = require('../db/controllers/documentosPersonaController');


router.get('/', documentoPersonaController.index);
router.post('/registrar', documentoPersonaController.registrar);
router.delete('/eliminar/:id', documentoPersonaController.eliminar);
router.post('/eliminar/:id', documentoPersonaController.eliminar);
router.get('/descargar/:id', documentoPersonaController.descargar);
router.post('/tipos/nuevo', documentoPersonaController.crearTipoDocumento);
router.get('/api/persona/buscar/:run', documentoPersonaController.buscarPersonaPorRun);
router.get('/api/tipos', documentoPersonaController.apiTiposDocumentos);
router.get('/api/documentos/persona/:id_persona', documentoPersonaController.apiDocumentosPorPersona);
router.get('/nuevo', (req, res) => {
    res.redirect('/documentos-persona?nuevo=1');
});
router.use('*', (req, res) => {
    if (req.xhr || req.headers.accept?.includes('application/json')) {
        return res.status(404).json({
            success: false,
            message: 'Ruta no encontrada'
        });
    }
    res.status(404).render('404', {
        title: 'Pagina no encontrada',
        message: 'La ruta solicitada no existe'
    });
});

module.exports = router;