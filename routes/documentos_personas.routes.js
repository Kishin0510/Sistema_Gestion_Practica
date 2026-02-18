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
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Tipo de archivo no permitido. Solo PDF, JPG, PNG'));
        }
    }
});
router.get('/api/documentos', async (req, res) => {
    try {
        const idCliente = req.session?.usuario?.id_cliente || 1;

        const [documentos] = await db.execute(`
            SELECT 
                dp.id_documento,
                dp.id_persona,
                dp.numero_documento,
                dp.fecha_emision,
                dp.fecha_vencimiento,
                dp.nombre_archivo,
                dp.ruta_archivo,
                dp.observaciones,
                dp.fecha_subida,
                dp.estado,
                CONCAT(p.nombres, ' ', p.apellido_paterno) as persona_nombre_completo,
                CONCAT(p.run, '-', p.dv) as persona_dni,
                p.cargo,
                td.nombre_documento as tipo_documento_nombre,
                DATEDIFF(dp.fecha_vencimiento, CURDATE()) as dias_restantes
            FROM documentos_persona dp
            INNER JOIN personas p ON dp.id_persona = p.id_persona
            LEFT JOIN tipo_documentos_persona td ON dp.id_tipo_documento = td.id_tipo_documento
            WHERE p.id_cliente = ? AND p.activo = 1
            ORDER BY dp.fecha_vencimiento ASC, dp.fecha_subida DESC
        `, [idCliente]);

        res.json({
            success: true,
            documentos: documentos
        });

    } catch (err) {
        console.error('Error API documentos:', err);
        res.status(500).json({
            success: false,
            error: 'Error al cargar documentos: ' + err.message
        });
    }
});

/**
 * API: Obtener estadísticas de documentos
 * GET /documentos-persona/api/estadisticas
 */
router.get('/api/estadisticas', async (req, res) => {
    try {
        const idCliente = req.session?.usuario?.id_cliente || 1;

        const [documentos] = await db.execute(`
            SELECT 
                fecha_vencimiento
            FROM documentos_persona dp
            INNER JOIN personas p ON dp.id_persona = p.id_persona
            WHERE p.id_cliente = ? AND p.activo = 1
        `, [idCliente]);

        const hoy = new Date();
        let documentosVigentes = 0;
        let documentosPorVencer = 0;
        let documentosVencidos = 0;

        documentos.forEach(doc => {
            const vencimiento = new Date(doc.fecha_vencimiento);
            const diffDays = Math.ceil((vencimiento - hoy) / (1000 * 60 * 60 * 24));

            if (diffDays > 30) {
                documentosVigentes++;
            } else if (diffDays > 0) {
                documentosPorVencer++;
            } else {
                documentosVencidos++;
            }
        });

        res.json({
            success: true,
            totalDocumentos: documentos.length,
            documentosVigentes: documentosVigentes,
            documentosPorVencer: documentosPorVencer,
            documentosVencidos: documentosVencidos
        });

    } catch (err) {
        console.error('Error API estadísticas:', err);
        res.status(500).json({
            success: false,
            error: 'Error al cargar estadísticas: ' + err.message
        });
    }
});

/**
 * API: Obtener un documento específico
 * GET /documentos-persona/api/documento/:id
 */
router.get('/api/documento/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const idCliente = req.session?.usuario?.id_cliente || 1;

        const [documentos] = await db.execute(`
            SELECT 
                dp.*,
                CONCAT(p.nombres, ' ', p.apellido_paterno) as persona_nombre_completo,
                CONCAT(p.run, '-', p.dv) as persona_dni,
                p.run as persona_run,
                p.dv as persona_dv,
                p.email as persona_email,
                p.telefono as persona_telefono,
                p.cargo as persona_cargo,
                td.nombre_documento as tipo_documento_nombre,
                td.descripcion as tipo_documento_descripcion,
                DATEDIFF(dp.fecha_vencimiento, CURDATE()) as dias_restantes
            FROM documentos_persona dp
            INNER JOIN personas p ON dp.id_persona = p.id_persona
            LEFT JOIN tipo_documentos_persona td ON dp.id_tipo_documento = td.id_tipo_documento
            WHERE dp.id_documento = ? AND p.id_cliente = ?
        `, [id, idCliente]);

        if (documentos.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Documento no encontrado'
            });
        }

        res.json({
            success: true,
            documento: documentos[0]
        });

    } catch (err) {
        console.error('Error API documento específico:', err);
        res.status(500).json({
            success: false,
            error: 'Error al cargar el documento: ' + err.message
        });
    }
});

/**
 * API: Obtener personas activas
 * GET /documentos-persona/api/personas
 */
router.get('/api/personas', async (req, res) => {
    try {
        const idCliente = req.session?.usuario?.id_cliente || 1;

        const [personas] = await db.execute(`
            SELECT 
                id_persona,
                run,
                dv,
                CONCAT(run, '-', dv) as dni,
                nombres,
                apellido_paterno,
                apellido_materno,
                CONCAT(nombres, ' ', apellido_paterno) as nombre_completo,
                email,
                telefono,
                cargo,
                activo
            FROM personas 
            WHERE id_cliente = ? AND activo = 1
            ORDER BY apellido_paterno ASC, nombres ASC
        `, [idCliente]);

        res.json({
            success: true,
            personas: personas
        });

    } catch (err) {
        console.error('Error API personas:', err);
        res.status(500).json({
            success: false,
            error: 'Error al cargar personas: ' + err.message
        });
    }
});

// ============ RUTAS DE VISTAS ============

/**
 * Página principal de documentos de personas
 * GET /documentos-persona
 */
router.get('/', documentoPersonaController.mostrarDocumentos);

/**
 * Ver detalle de un documento
 * GET /documentos-persona/detalle/:id
 */
router.get('/detalle/:id', documentoPersonaController.verDetalle);

/**
 * Descargar archivo de documento
 * GET /documentos-persona/descargar/:id
 */
router.get('/descargar/:id', documentoPersonaController.descargarArchivo);

// ============ RUTAS DE OPERACIONES CRUD ============

/**
 * Registrar nuevo documento
 * POST /documentos-persona/registrar
 */
router.post('/registrar',
    upload.single('archivo_documento'),
    documentoPersonaController.agregarDocumento
);

/**
 * Eliminar documento
 * DELETE /documentos-persona/eliminar/:id
 */
router.delete('/eliminar/:id', documentoPersonaController.eliminarDocumento);

// ============ MANEJADOR DE ERRORES DE MULTER ============
router.use((err, req, res, next) => {
    console.error('Error en multer:', err);

    // Verificar si la solicitud espera JSON (API)
    if (req.path.startsWith('/api/')) {
        return res.status(400).json({
            success: false,
            error: err.message || 'Error al procesar el archivo'
        });
    }

    // Para solicitudes normales, redirigir con mensaje de error
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