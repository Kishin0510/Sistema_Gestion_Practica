const express = require('express');
const router = express.Router();
const authController = require('../db/controllers/authController');
const { permisoPara } = require('../middlewares/roleAuth');


router.post('/login', authController.login);
router.post('/register', permisoPara(['super_admin', 'admin_cliente']), authController.registrar);
router.get('/logout', (req, res) => {
    req.session.destroy(() => res.redirect('/login'));
});

module.exports = router;