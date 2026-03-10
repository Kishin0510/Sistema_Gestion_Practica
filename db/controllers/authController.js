const bcrypt = require('bcrypt');
const db = require('../conexion');


const obtenerRutaPorRol = (rol) => {
    switch (rol) {
        case 'super_admin': return '/admin/dashboard';
        case 'admin_cliente': return '/dashboard';
        case 'actualizador': return '/documentos';
        case 'visualizador': return '/lista-general';
        default: return '/';
    }
};

exports.login = async (req, res) => {
    const { correo, contrasena } = req.body;

    if (!correo || !contrasena) {
        req.flash('error', 'Campos obligatorios');
        return res.redirect('/login');
    }

    try {
        const [resultados] = await db.execute(
            'SELECT * FROM usuarios WHERE correo = ? AND activo = 1',
            [correo]
        );

        if (resultados.length === 0) {
            req.flash('error', 'Credenciales inválidas');
            return res.redirect('/login');
        }

        const usuario = resultados[0];
        const match = await bcrypt.compare(contrasena, usuario.contrasena);

        if (!match) {
            req.flash('error', 'Credenciales inválidas');
            return res.redirect('/login');
        }

        
        req.session.usuarioId = usuario.id_usuario;
        req.session.nombre = usuario.nombre_completo;
        req.session.rol = usuario.tipo_usuario;
        req.session.idCliente = usuario.id_cliente;

        await db.execute('UPDATE usuarios SET ultimo_login = NOW() WHERE id_usuario = ?', [usuario.id_usuario]);

        
        const rutaDestino = obtenerRutaPorRol(usuario.tipo_usuario);
        res.redirect(rutaDestino);

    } catch (err) {
        console.error(err);
        req.flash('error', 'Error en el servidor');
        res.redirect('/login');
    }
};

exports.registrar = async (req, res) => {
    
    const { nombre_completo, correo, contrasena, tipo_usuario, id_cliente } = req.body;

    if (!nombre_completo || !correo || !contrasena || !tipo_usuario || !id_cliente) {
        return res.status(400).json({ error: 'Faltan campos requeridos incluyendo el Cliente' });
    }

    try {
        const [existe] = await db.execute('SELECT id_usuario FROM usuarios WHERE correo = ?', [correo]);
        if (existe.length > 0) {
            return res.status(400).json({ error: 'El correo ya está registrado' });
        }

        const hashedPassword = await bcrypt.hash(contrasena, 10);

        
        const [result] = await db.execute(
            'INSERT INTO usuarios (nombre_completo, correo, contrasena, tipo_usuario, id_cliente, activo) VALUES (?, ?, ?, ?, ?, 1)',
            [nombre_completo, correo, hashedPassword, tipo_usuario, id_cliente]
        );

        res.status(200).json({
            success: true,
            message: 'Usuario creado exitosamente',
            redirect: '/login' 
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error al registrar usuario' });
    }
};