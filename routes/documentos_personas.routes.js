const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const documentoPersonaController = require('../db/controllers/documentosPersonaController');

// Configuración de Multer
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const dir = 'public/uploads/documentos_persona/';
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        cb(null, dir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        const name = path.basename(file.originalname, ext)
            .replace(/\s+/g, '_')
            .replace(/[^a-zA-Z0-9_]/g, '')
            .toLowerCase()
            .substring(0, 30);
        cb(null, `persona_${name}_${uniqueSuffix}${ext}`);
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Tipo de archivo no permitido. Solo PDF, JPG, PNG'));
        }
    }
});

router.get('/', documentoPersonaController.mostrarDocumentos);
router.get('/detalle/:id', documentoPersonaController.verDetalle);
router.get('/descargar/:id', documentoPersonaController.descargarArchivo);
router.get('/api/personas', documentoPersonaController.apiPersonas);
router.get('/api/persona/run/:run', documentoPersonaController.buscarPersonaPorRun);
router.post('/registrar',
    upload.single('archivo_documento'),
    documentoPersonaController.agregarDocumento
);
router.delete('/eliminar/:id', documentoPersonaController.eliminarDocumento);
router.use((err, req, res, next) => {
    console.error('Error en multer:', err);
    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.redirect('/documentos-persona?error=Archivo demasiado grande (máx. 10MB)');
        }
        return res.redirect('/documentos-persona?error=Error al subir archivo: ' + err.message);
    }
    if (err) {
        return res.redirect('/documentos-persona?error=' + encodeURIComponent(err.message));
    }
    next();
});

module.exports = router;