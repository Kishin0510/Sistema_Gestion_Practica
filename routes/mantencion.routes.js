const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../db/conexion'); 
const mantencionController = require('../db/controllers/mantencionController');

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const dir = 'public/uploads/mantenciones/';
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        cb(null, dir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, `mant_${uniqueSuffix}${path.extname(file.originalname)}`);
    }
});
const upload = multer({ 
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 } 
});

router.get('/documentos', async (req, res) => {
    try {
        const [documentos] = await db.execute(`
            SELECT d.*, v.patente, v.marca, v.modelo 
            FROM documentos_vehiculo d
            LEFT JOIN vehiculos v ON d.id_vehiculo = v.id_vehiculo
        `);

        const [vehiculos] = await db.execute('SELECT id_vehiculo, patente, marca, modelo FROM vehiculos');

        const [mantenciones] = await db.execute(`
            SELECT m.*, v.patente 
            FROM mantenciones_vehiculo m
            JOIN vehiculos v ON m.id_vehiculo = v.id_vehiculo
            ORDER BY m.fecha_mantencion DESC
        `);

        const hoy = new Date();
        const totalDocumentos = documentos.length;
        const documentosVigentes = documentos.filter(d => new Date(d.fecha_vencimiento) > new Date(hoy.getTime() + 30 * 24 * 60 * 60 * 1000)).length;
        const documentosPorVencer = documentos.filter(d => {
            const diff = Math.ceil((new Date(d.fecha_vencimiento) - hoy) / (1000 * 60 * 60 * 24));
            return diff <= 30 && diff > 0;
        }).length;
        const documentosVencidos = documentos.filter(d => new Date(d.fecha_vencimiento) <= hoy).length;

        res.render('documentos', {
            title: 'Gestión Documental',
            documentos,
            vehiculos,
            mantenciones,
            totalDocumentos,
            documentosVigentes,
            documentosPorVencer,
            documentosVencidos,
            success_msg: req.query.success || null,
            error_msg: req.query.error || null
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Error al cargar los datos');
    }
});

router.get('/api/listar', mantencionController.listarMantenciones);
router.get('/api/:id', mantencionController.obtenerMantencionPorId);

router.post('/registrar', 
    upload.single('archivo_mantencion'), 
    mantencionController.agregarMantencion
);

router.post('/actualizar/:id', 
    upload.single('archivo_mantencion'), 
    mantencionController.actualizarMantencion
);

router.get('/eliminar/:id', mantencionController.eliminarMantencion);

module.exports = router;