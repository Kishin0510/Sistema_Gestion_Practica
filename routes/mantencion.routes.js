const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
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
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB
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
router.delete('/eliminar/:id', mantencionController.eliminarMantencion);
module.exports = router;