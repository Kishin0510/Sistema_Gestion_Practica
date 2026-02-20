const express = require('express');
const router = express.Router();
const multer = require('multer');

const documentosPersonaController = require('../db/controllers/documentosPersonaController');


const storage = multer.memoryStorage();
const upload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowedTypes = [
            'application/pdf',
            'image/jpeg',
            'image/jpg',
            'image/png'
        ];

        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Solo se permiten PDF, JPG o PNG'));
        }
    }
});


const isAuthenticated = (req, res, next) => {
    if (req.session && req.session.usuario) {
        return next();
    }
    res.redirect('/login');
};

router.use(isAuthenticated);
router.get('/', documentosPersonaController.index);
router.post(
    '/registrar',
    upload.single('archivo_documento'),
    documentosPersonaController.registrar
);

router.get('/api/personas', documentosPersonaController.getPersonas);

module.exports = router;
