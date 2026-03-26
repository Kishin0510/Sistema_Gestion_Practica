const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const documentoVehiculoController = require('../db/controllers/documentoController');
const { permisoPara } = require('../middlewares/roleAuth');

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
        const name = path.basename(file.originalname, ext)
            .replace(/\s+/g, '_')
            .replace(/[^a-zA-Z0-9_]/g, '')
            .toLowerCase()
            .substring(0, 30);
        cb(null, `doc_${name}_${uniqueSuffix}${ext}`);
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 },
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
            cb(new Error('Tipo de archivo no permitido. Solo PDF, JPG, PNG'));
        }
    }
});

router.get('/',
    permisoPara(['SUPER_ADMIN', 'ADMIN_CLIENTE', 'ACTUALIZADOR', 'VISUALIZADOR']),
    documentoVehiculoController.mostrarDocumentos
);

router.get('/api/vehiculos',
    permisoPara(['SUPER_ADMIN', 'ADMIN_CLIENTE', 'ACTUALIZADOR', 'VISUALIZADOR']),
    documentoVehiculoController.apiVehiculos
);

router.get('/api/tipos',
    permisoPara(['SUPER_ADMIN', 'ADMIN_CLIENTE', 'ACTUALIZADOR', 'VISUALIZADOR']),
    documentoVehiculoController.apiTiposDocumentos
);

router.get('/api/vehiculo/patente/:patente',
    permisoPara(['SUPER_ADMIN', 'ADMIN_CLIENTE', 'ACTUALIZADOR', 'VISUALIZADOR']),
    documentoVehiculoController.buscarVehiculoPorPatente
);

router.get('/api/documento/:id',
    permisoPara(['SUPER_ADMIN', 'ADMIN_CLIENTE', 'ACTUALIZADOR', 'VISUALIZADOR']),
    documentoVehiculoController.obtenerDocumentoPorId
);

router.post('/vehiculo/registrar',
    permisoPara(['SUPER_ADMIN', 'ACTUALIZADOR']),
    upload.single('archivo_documento'),
    documentoVehiculoController.agregarDocumento
);
router.post('/vehiculo/actualizar-fechas/:id',
    permisoPara(['SUPER_ADMIN', 'ACTUALIZADOR']),
    documentoVehiculoController.actualizarFechasDocumento
);
router.post('/actualizar/:id',
    permisoPara(['SUPER_ADMIN', 'ACTUALIZADOR']),
    upload.single('archivo_documento'),
    documentoVehiculoController.actualizarDocumento
);

router.delete('/eliminar/:id',
    permisoPara(['SUPER_ADMIN', 'ADMIN_CLIENTE']),
    documentoVehiculoController.eliminarDocumento
);

router.use((err, req, res, next) => {
    console.error('Error en multer:', err);

    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.redirect('/documentos?error=Archivo demasiado grande (máx. 10MB)');
        }
        return res.redirect('/documentos?error=Error al subir archivo: ' + err.message);
    }

    if (err) {
        return res.redirect('/documentos?error=' + encodeURIComponent(err.message));
    }

    next();
});

router.post('/vehiculo/actualizar-fechas/:id', (req, res) => {
    console.log('ENTRÓ A ACTUALIZAR FECHAS');
    res.send('Ruta encontrada');
});
module.exports = router;