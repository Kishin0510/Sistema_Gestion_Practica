const express = require('express');
const router = express.Router();
const multer = require('multer');

const documentosPersonaController = require('../db/controllers/documentosPersonaController');

// Configuración de multer para archivos
const storage = multer.memoryStorage();
const upload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB máximo
    fileFilter: (req, file, cb) => {
        const allowedTypes = [
            'application/pdf',
            'image/jpeg',
            'image/jpg',
            'image/png',
            'image/webp'
        ];

        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Solo se permiten PDF, JPG, PNG o WEBP'));
        }
    }
});

// Middleware de autenticación
const isAuthenticated = (req, res, next) => {
    // Por ahora permitimos acceso sin autenticación para pruebas
    // if (req.session && req.session.usuario) {
    //     return next();
    // }
    // res.redirect('/login');
    
    // Temporal: crear sesión dummy si no existe
    if (!req.session) req.session = {};
    if (!req.session.idCliente) req.session.idCliente = 1;
    if (!req.session.idUsuario) req.session.idUsuario = 1;
    
    next();
};

// Aplicar middleware de autenticación a todas las rutas
router.use(isAuthenticated);

// ===============================
// RUTAS PRINCIPALES
// ===============================

/**
 * @route   GET /documentos-persona
 * @desc    Página principal de documentos de personas
 * @access  Privado
 */
router.get('/', documentosPersonaController.index);

/**
 * @route   POST /documentos-persona/registrar
 * @desc    Registrar un nuevo documento de persona
 * @access  Privado
 */
router.post(
    '/registrar',
    upload.single('archivo_documento'),
    documentosPersonaController.registrar
);

// ===============================
// RUTAS API
// ===============================

/**
 * @route   GET /documentos-persona/api/personas
 * @desc    Obtener lista de personas activas (para recargar select)
 * @access  Privado
 */
router.get('/api/personas', documentosPersonaController.getPersonas);

// ===============================
// RUTAS PARA DOCUMENTOS INDIVIDUALES
// ===============================

/**
 * @route   GET /documentos-persona/ver/:id
 * @desc    Ver/descargar archivo de documento
 * @access  Privado
 */
router.get('/ver/:id', documentosPersonaController.verDocumento);

/**
 * @route   GET /documentos-persona/detalle/:id
 * @desc    Ver detalle completo de un documento
 * @access  Privado
 */
router.get('/detalle/:id', documentosPersonaController.detalle);

/**
 * @route   POST /documentos-persona/actualizar/:id
 * @desc    Actualizar un documento existente
 * @access  Privado
 */
router.post(
    '/actualizar/:id',
    upload.single('archivo_documento'),
    documentosPersonaController.actualizar
);

/**
 * @route   DELETE /documentos-persona/eliminar/:id
 * @desc    Eliminar un documento
 * @access  Privado
 */
router.delete('/eliminar/:id', documentosPersonaController.eliminar);

// ===============================
// RUTA PARA ERROR DE MULTER
// ===============================

/**
 * Manejador de errores de multer
 */
router.use((error, req, res, next) => {
    if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
            req.flash('error', 'El archivo es demasiado grande. Máximo 10MB');
        } else {
            req.flash('error', 'Error al subir el archivo: ' + error.message);
        }
    } else if (error) {
        req.flash('error', error.message);
    }
    
    // Redirigir según el método
    if (req.method === 'POST' || req.method === 'PUT') {
        res.redirect('back');
    } else {
        next();
    }
});

module.exports = router;