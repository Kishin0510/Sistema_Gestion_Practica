const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const documentosPersonaController = require('../db/controllers/documentosPersonaController');

// Configuración de Multer para almacenamiento físico
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const dir = 'public/uploads/documentos/';
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        cb(null, dir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, `doc_per_${uniqueSuffix}${ext}`);
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB
});

// RUTAS (Nombres sincronizados con el controlador)
router.get('/', documentosPersonaController.mostrarDocumentos);
router.get('/api/personas', documentosPersonaController.apiPersonas);
router.get('/api/documento/:id', documentosPersonaController.obtenerDocumentoPorId);

router.post('/registrar',
    upload.single('archivo_documento'),
    documentosPersonaController.agregarDocumento // Antes se llamaba .registrar
);

router.post('/actualizar/:id',
    upload.single('archivo_documento'),
    documentosPersonaController.actualizarDocumento
);

router.delete('/eliminar/:id', documentosPersonaController.eliminarDocumento);

module.exports = router;