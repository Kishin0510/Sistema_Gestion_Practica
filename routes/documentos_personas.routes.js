const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const documentosPersonaController = require('../db/controllers/documentosPersonaController');

// Configuración de carpetas
const TEMP_PATH = path.join(__dirname, '../../uploads/temp');
const DESCARGAS_PATH = path.join(__dirname, '../../descargas');

// Crear carpetas si no existen
[TEMP_PATH, DESCARGAS_PATH].forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        console.log(`Carpeta creada: ${dir}`);
    }
});

// Configuración de multer para archivos temporales
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, TEMP_PATH);
    },
    filename: function (req, file, cb) {
        // Limpiar nombre del archivo
        const cleanName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
        const timestamp = Date.now();
        cb(null, `${timestamp}-${cleanName}`);
    }
});

const fileFilter = (req, file, cb) => {
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Solo se permiten archivos PDF, JPG, JPEG y PNG'), false);
    }
};

const upload = multer({ 
    storage: storage,
    fileFilter: fileFilter,
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB
});

// Rutas principales
router.get('/', documentosPersonaController.index);

// Rutas para documentos
router.post('/registrar', upload.single('archivo'), documentosPersonaController.registrar);
router.get('/obtener/:id', documentosPersonaController.obtenerPorId);
router.delete('/eliminar/:id', documentosPersonaController.eliminar);
router.get('/descargar/:id', documentosPersonaController.descargarArchivo);
router.get('/ver/:id', documentosPersonaController.verArchivo);

// Rutas para exportar (como los Excel de vehículos)
router.get('/exportar/excel', documentosPersonaController.exportarExcel);
router.get('/exportar/resumen', documentosPersonaController.exportarResumen);

// Ruta para servir archivos estáticos desde descargas
router.use('/descargas', express.static(path.join(__dirname, '../../descargas')));

module.exports = router;