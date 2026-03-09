const bcrypt = require('bcrypt');
const db = require('../conexion');

const authController = {

    mostrarLogin: async (req, res) => {
        try {
            const [clientes] = await db.execute(
                'SELECT id_cliente, nombre_cliente, rut_cliente FROM clientes WHERE activo = TRUE ORDER BY nombre_cliente'
            );

            const messages = {
                error: req.session.error || null,
                success: req.session.success || null
            };

            console.log('Mostrando login con mensajes:', messages);

            res.render('Login', {
                title: 'Iniciar Sesión',
                messages: messages,
                clientes: clientes || [],
                error: req.session.error || null,
                success: req.session.success || null
            });

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

    login: async (req, res) => {
        try {
            const { correo, contrasena } = req.body;

            console.log('Intentando login para:', correo);

            if (!correo || !contrasena) {
                req.session.error = "Correo y contraseña son requeridos";
                console.log('Faltan campos');
                return res.redirect('/auth/login');
            }

            const [usuarios] = await db.execute(
                `SELECT u.*, c.nombre_cliente, c.rut_cliente 
                 FROM usuarios u 
                 INNER JOIN clientes c ON u.id_cliente = c.id_cliente 
                 WHERE u.correo = ? AND u.activo = TRUE`,
                [correo]
            );

            if (usuarios.length === 0) {
                req.session.error = "Correo o contraseña incorrectos";
                console.log('Usuario no encontrado');
                return res.redirect('/auth/login');
            }

            const usuario = usuarios[0];

            const contrasenaValida = await bcrypt.compare(contrasena, usuario.contrasena);

            if (!contrasenaValida) {
                req.session.error = "Correo o contraseña incorrectos";
                console.log('Contraseña incorrecta');
                return res.redirect('/auth/login');
            }

            req.session.usuarioId = usuario.id_usuario;
            req.session.username = usuario.username;
            req.session.nombreCompleto = usuario.nombre_completo;
            req.session.tipoUsuario = usuario.tipo_usuario;
            req.session.correo = usuario.correo;
            req.session.idCliente = usuario.id_cliente;
            req.session.nombreCliente = usuario.nombre_cliente;
            req.session.recibeAlertas = usuario.recibe_alertas;

            console.log('Login exitoso para:', usuario.username, 'Tipo:', usuario.tipo_usuario);

            await db.execute(
                'UPDATE usuarios SET ultimo_login = NOW() WHERE id_usuario = ?',
                [usuario.id_usuario]
            );

            switch (usuario.tipo_usuario) {
                case 'super_admin':
                    return res.redirect('/super-admin/dashboard');
                case 'admin_cliente':
                    return res.redirect('/admin-cliente/dashboard');
                case 'actualizador':
                    return res.redirect('/actualizador/documentos');
                case 'visualizador':
                    return res.redirect('/visualizador/consulta');
                default:
                    return res.redirect('/dashboard');
            }

        } catch (error) {
            console.error('Error en login:', error);
            req.session.error = "Error en el servidor. Intenta nuevamente.";
            return res.redirect('/auth/login');
        }
    },

    registrar: async (req, res) => {
        try {
            const {
                nombre_completo,
                username,
                correo,
                contrasena,
                confirmar_contrasena,
                tipo_usuario,
                id_cliente,
                recibe_alertas
            } = req.body;

            console.log('Registrando usuario:', username, correo, 'Tipo:', tipo_usuario);

            if (!nombre_completo || !username || !correo || !contrasena || !confirmar_contrasena || !tipo_usuario || !id_cliente) {
                req.session.error = "Todos los campos son requeridos";
                return res.redirect('/auth/login?tab=register');
            }

            if (contrasena !== confirmar_contrasena) {
                req.session.error = "Las contraseñas no coinciden";
                return res.redirect('/auth/login?tab=register');
            }

            if (contrasena.length < 6) {
                req.session.error = "La contraseña debe tener al menos 6 caracteres";
                return res.redirect('/auth/login?tab=register');
            }

            const tiposValidos = ['super_admin', 'admin_cliente', 'actualizador', 'visualizador'];
            if (!tiposValidos.includes(tipo_usuario)) {
                req.session.error = "Tipo de usuario no válido";
                return res.redirect('/auth/login?tab=register');
            }

            const [cliente] = await db.execute(
                'SELECT id_cliente FROM clientes WHERE id_cliente = ? AND activo = TRUE',
                [id_cliente]
            );

            if (cliente.length === 0) {
                req.session.error = "El cliente seleccionado no es válido";
                return res.redirect('/auth/login?tab=register');
            }

            const [correoExistente] = await db.execute(
                'SELECT id_usuario FROM usuarios WHERE correo = ?',
                [correo]
            );

            if (correoExistente.length > 0) {
                req.session.error = "El correo ya está registrado";
                return res.redirect('/auth/login?tab=register');
            }

            const [usernameExistente] = await db.execute(
                'SELECT id_usuario FROM usuarios WHERE username = ?',
                [username]
            );

            if (usernameExistente.length > 0) {
                req.session.error = "El nombre de usuario ya está en uso";
                return res.redirect('/auth/login?tab=register');
            }

            let recibeAlertasValue = recibe_alertas === 'on' ? 1 : 0;

            if (tipo_usuario === 'super_admin') {
                recibeAlertasValue = 1;
            }

            if (tipo_usuario === 'visualizador') {
                recibeAlertasValue = 0;
            }

            const saltRounds = 10;
            const hashedPassword = await bcrypt.hash(contrasena, saltRounds);

            const [result] = await db.execute(
                `INSERT INTO usuarios 
                 (id_cliente, username, contrasena, correo, nombre_completo, tipo_usuario, recibe_alertas) 
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [id_cliente, username, hashedPassword, correo, nombre_completo, tipo_usuario, recibeAlertasValue]
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

    logout: (req, res) => {
        req.session.destroy((err) => {
            if (err) {
                console.error('Error al cerrar sesión:', err);
                return res.redirect('/');
            }
            res.redirect('/auth/login');
        });
    },

    getDashboardByUserType: (req, res) => {
        const { tipoUsuario } = req.session;

        if (!tipoUsuario) {
            return res.redirect('/auth/login');
        }

        switch (tipoUsuario) {
            case 'super_admin':
                res.render('dashboards/super-admin', {
                    title: 'Panel Super Admin',
                    usuario: req.session
                });
                break;
            case 'admin_cliente':
                res.render('dashboards/admin-cliente', {
                    title: 'Panel Admin Cliente',
                    usuario: req.session
                });
                break;
            case 'actualizador':
                res.render('dashboards/actualizador', {
                    title: 'Panel Actualizador',
                    usuario: req.session
                });
                break;
            case 'visualizador':
                res.render('dashboards/visualizador', {
                    title: 'Panel Visualizador',
                    usuario: req.session
                });
                break;
            default:
                res.redirect('/auth/login');
        }
    }
};

module.exports = authController;