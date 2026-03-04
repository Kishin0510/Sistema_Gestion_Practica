const bcrypt = require('bcrypt');
const db = require('../conexion');

const authController = {
    // Mostrar página de login (GET)
    mostrarLogin: async (req, res) => {
        try {
            // Obtener lista de clientes para el registro
            const [clientes] = await db.execute('SELECT id_cliente, nombre FROM clientes ORDER BY nombre');

            // Crear objeto de mensajes con valores por defecto
            const messages = {
                error: req.session.error || null,
                success: req.session.success || null
            };

            console.log('Mostrando login con mensajes:', messages); // Para debug

            // Renderizar la vista con TODAS las variables necesarias
            res.render('Login', {
                title: 'Iniciar Sesión',
                messages: messages, // Pasar como objeto
                clientes: clientes || [],
                // También pasar directamente por si acaso
                error: req.session.error || null,
                success: req.session.success || null
            });

            // Limpiar mensajes de sesión después de mostrarlos
            req.session.error = null;
            req.session.success = null;

        } catch (error) {
            console.error('Error al cargar login:', error);
            res.render('Login', {
                title: 'Iniciar Sesión',
                messages: { error: 'Error al cargar la página', success: null },
                clientes: [],
                error: 'Error al cargar la página',
                success: null
            });
        }
    },

    // Login de usuario (POST)
    login: async (req, res) => {
        try {
            const { correo, contrasena } = req.body;

            console.log('Intentando login para:', correo); // Para debug

            // Validar que se enviaron los campos
            if (!correo || !contrasena) {
                req.session.error = "Correo y contraseña son requeridos";
                console.log('Faltan campos');
                return res.redirect('/auth/login');
            }

            // Buscar usuario por correo
            const [usuarios] = await db.execute(
                'SELECT * FROM usuarios WHERE correo = ? AND activo = TRUE',
                [correo]
            );

            if (usuarios.length === 0) {
                req.session.error = "Correo o contraseña incorrectos";
                console.log('Usuario no encontrado');
                return res.redirect('/auth/login');
            }

            const usuario = usuarios[0];

            // Verificar contraseña
            const contrasenaValida = await bcrypt.compare(contrasena, usuario.contrasena);

            if (!contrasenaValida) {
                req.session.error = "Correo o contraseña incorrectos";
                console.log('Contraseña incorrecta');
                return res.redirect('/auth/login');
            }

            // Crear sesión
            req.session.usuarioId = usuario.id_usuario;
            req.session.username = usuario.username;
            req.session.nombreCompleto = usuario.nombre_completo;
            req.session.tipoUsuario = usuario.tipo_usuario;
            req.session.correo = usuario.correo;
            req.session.idCliente = usuario.id_cliente;

            console.log('Login exitoso para:', usuario.username);

            // Actualizar último login
            await db.execute(
                'UPDATE usuarios SET ultimo_login = NOW() WHERE id_usuario = ?',
                [usuario.id_usuario]
            );

            // Redirigir según tipo de usuario
            if (usuario.tipo_usuario === 'admin') {
                return res.redirect('/admin/dashboard');
            } else {
                return res.redirect('/user/dashboard');
            }

        } catch (error) {
            console.error('Error en login:', error);
            req.session.error = "Error en el servidor. Intenta nuevamente.";
            return res.redirect('/auth/login');
        }
    },

    // Registro de nuevo usuario
    registrar: async (req, res) => {
        try {
            const {
                nombre_completo,
                username,
                correo,
                contrasena,
                confirmar_contrasena,
                tipo_usuario,
                id_cliente
            } = req.body;

            console.log('Registrando usuario:', username, correo); // Para debug

            // Validaciones básicas
            if (!nombre_completo || !username || !correo || !contrasena || !confirmar_contrasena || !tipo_usuario || !id_cliente) {
                req.session.error = "Todos los campos son requeridos";
                return res.redirect('/auth/login?tab=register');
            }

            if (contrasena !== confirmar_contrasena) {
                req.session.error = "Las contraseñas no coinciden";
                return res.redirect('/auth/login?tab=register');
            }

            // Verificar si el correo ya existe
            const [correoExistente] = await db.execute(
                'SELECT id_usuario FROM usuarios WHERE correo = ?',
                [correo]
            );

            if (correoExistente.length > 0) {
                req.session.error = "El correo ya está registrado";
                return res.redirect('/auth/login?tab=register');
            }

            // Verificar si el username ya existe
            const [usernameExistente] = await db.execute(
                'SELECT id_usuario FROM usuarios WHERE username = ?',
                [username]
            );

            if (usernameExistente.length > 0) {
                req.session.error = "El nombre de usuario ya está en uso";
                return res.redirect('/auth/login?tab=register');
            }

            // Hash de la contraseña
            const saltRounds = 10;
            const hashedPassword = await bcrypt.hash(contrasena, saltRounds);

            // Insertar nuevo usuario
            const [result] = await db.execute(
                `INSERT INTO usuarios 
                 (id_cliente, username, contrasena, correo, nombre_completo, tipo_usuario) 
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [id_cliente, username, hashedPassword, correo, nombre_completo, tipo_usuario]
            );

            console.log('Usuario registrado exitosamente, ID:', result.insertId);

            req.session.success = "¡Cuenta creada exitosamente! Ahora puedes iniciar sesión.";
            return res.redirect('/auth/login');

        } catch (error) {
            console.error('Error en registro:', error);
            req.session.error = "Error al crear la cuenta. Intenta nuevamente.";
            return res.redirect('/auth/login?tab=register');
        }
    },

    // Logout
    logout: (req, res) => {
        req.session.destroy((err) => {
            if (err) {
                console.error('Error al cerrar sesión:', err);
                return res.redirect('/');
            }
            res.redirect('/auth/login');
        });
    }
};

module.exports = authController;