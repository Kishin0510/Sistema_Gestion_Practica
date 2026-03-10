const express = require('express');
const router = express.Router();
const authController = require('../db/controllers/authController');

router.post('/login', authController.login);
router.post('/register', authController.registrar);
router.get('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            return res.status(500).send('Error al cerrar sesión');
        }
        res.redirect('/login');
    });
});

module.exports = router;