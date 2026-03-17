const db = require('../conexion');
const bcrypt = require('bcryptjs');
const authController = {};

authController.register = async (req, res) => {
    const { nombre_completo, correo, contrasena, tipo_usuario } = req.body;
    const id_cliente = 1;

    try {
        const hashedPassword = await bcrypt.hash(contrasena, 10);
        const query = 'INSERT INTO usuarios (id_cliente, nombre_completo, correo, contrasena, tipo_usuario) VALUES (?, ?, ?, ?, ?)';
        await db.query(query, [id_cliente, nombre_completo, correo, hashedPassword, tipo_usuario]);
        return res.status(201).json({ success: 'Usuario registrado con éxito.' });
    } catch (error) {
        console.error(" Error en registro:", error);
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ error: 'El correo ya existe.' });
        }
        return res.status(500).json({ error: 'Error interno al registrar.' });
    }
};

authController.login = async (req, res) => {
    const { correo, contrasena } = req.body;

    try {
        console.log(` Intentando login para: ${correo}`);
        
        const [results] = await db.query('SELECT * FROM usuarios WHERE correo = ? AND activo = 1', [correo]);

        if (results.length === 0) {
            console.log(" Usuario no encontrado");
            return res.render('Login', { title: 'Iniciar Sesión', error: 'Credenciales inválidas.', success: null });
        }

        let userFound = null;
        for (const user of results) {
            const match = await bcrypt.compare(contrasena, user.contrasena);
            if (match) {
                userFound = user;
                break;
            }
        }

        if (!userFound) {
            return res.render('Login', { title: 'Iniciar Sesión', error: 'Contraseña incorrecta.', success: null });
        }

        
        console.log(`>>> Usuario verificado: ${userFound.nombre_completo} | ROL: ${userFound.tipo_usuario} | Cliente ID: ${userFound.id_cliente}`);

        req.session.usuario = {
            id: userFound.id_usuario,
            nombre: userFound.nombre_completo,
            rol: userFound.tipo_usuario
        };

        req.session.save(() => {
            
            console.log(` Login exitoso para [${userFound.tipo_usuario}], redirigiendo...`);
            db.query('UPDATE usuarios SET ultimo_login = NOW() WHERE id_usuario = ?', [userFound.id_usuario]);
            res.redirect('/');
        });

    } catch (error) {
        console.error(" Error crítico en login:", error);
        res.render('Login', { title: 'Iniciar Sesión', error: 'Error en el servidor.', success: null });
    }
};

authController.logout = (req, res) => {
    req.session.destroy(() => {
        res.redirect('/login');
    });
};

module.exports = authController;