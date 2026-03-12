const express = require('express');
const router = express.Router();
const authController = require('../db/controllers/authController');


router.get('/login', (req, res) => {
    res.render('login', { title: 'Gestión Vehicular', error: null, success: null });
});

router.post('/register', authController.register);
router.post('/login', authController.login);
router.get('/logout', authController.logout);

module.exports = router;