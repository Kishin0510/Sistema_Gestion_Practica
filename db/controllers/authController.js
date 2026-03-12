const db = require('../conexion'); 
const bcrypt = require('bcryptjs');

const authController = {};

authController.register = async (req, res) => {
    const { nombre_completo, correo, contrasena, tipo_usuario } = req.body;
    const id_cliente = 1; 

    try {
        
        const hashedPassword = await bcrypt.hash(contrasena, 10);

        const query = 'INSERT INTO usuarios (id_cliente, nombre_completo, correo, contrasena, tipo_usuario) VALUES (?, ?, ?, ?, ?)';

        
        db.query(query, [id_cliente, nombre_completo, correo, hashedPassword, tipo_usuario], (err, result) => {
            if (err) {
                console.error("Error en DB durante registro:", err.code);

                
                if (err.code === 'ER_DUP_ENTRY') {
                    return res.status(400).json({ error: 'El correo electrónico ya está registrado.' });
                }

                
                return res.status(500).json({ error: 'Error al guardar en la base de datos.' });
            }

            // Registro exitoso
            return res.status(201).json({ success: 'Usuario registrado con éxito.' });
        });

    } catch (error) {
        console.error("Error en el proceso de encriptación/registro:", error);
        return res.status(500).json({ error: 'Error interno al procesar el registro.' });
    }
};

authController.login = (req, res) => {
    const { correo, contrasena } = req.body;

    // Buscamos al usuario por correo y que esté activo
    const query = 'SELECT * FROM usuarios WHERE correo = ? AND activo = 1';

    db.query(query, [correo], async (err, results) => {
        if (err) {
            console.error("Error en DB durante login:", err);
            return res.render('login', { error: 'Error en el servidor. Intente más tarde.', success: null });
        }

        // Si no existe el usuario
        if (results.length === 0) {
            return res.render('login', { error: 'El correo no está registrado o la cuenta está inactiva.', success: null });
        }

        const user = results[0];

        try {
            
            const validPassword = await bcrypt.compare(contrasena, user.contrasena);

            if (!validPassword) {
                return res.render('login', { error: 'Contraseña incorrecta.', success: null });
            }

            // Crear sesión del usuario
            req.session.user = {
                id: user.id_usuario,
                nombre: user.nombre_completo,
                rol: user.tipo_usuario
            };

            
            db.query('UPDATE usuarios SET ultimo_login = NOW() WHERE id_usuario = ?', [user.id_usuario]);

            
            return res.redirect('/');

        } catch (error) {
            console.error("Error al comparar contraseñas:", error);
            return res.render('login', { error: 'Error al validar credenciales.', success: null });
        }
    });
};

authController.logout = (req, res) => {
    if (req.session) {
        req.session.destroy((err) => {
            if (err) {
                console.error("Error al cerrar sesión:", err);
            }
            res.redirect('/auth/login');
        });
    } else {
        res.redirect('/auth/login');
    }
};

module.exports = authController;