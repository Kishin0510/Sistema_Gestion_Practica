const db = require('../conexion');

exports.listar = async (req, res) => {
    try {
        const [grupos] = await db.query(`
            SELECT g.*, c.nombre_cliente
            FROM grupos g
            LEFT JOIN clientes c ON g.id_cliente = c.id_cliente
            ORDER BY g.fecha_creacion DESC
        `);

        const [clientes] = await db.query(`
            SELECT id_cliente, nombre_cliente AS nombre
            FROM clientes
            WHERE activo = 1
            ORDER BY nombre_cliente ASC
        `);

        const cliente_nombre = {};
        grupos.forEach(grupo => {
            if (grupo.nombre_cliente) {
                cliente_nombre[grupo.id_cliente] = grupo.nombre_cliente;
            }
        });

        res.render('listaGrupos', {
            title: 'Mis Grupos',
            grupos,
            clientes,
            cliente_nombre,
            usuario: req.session.usuario,
            success_msg: req.flash ? req.flash('success') : null,
            error_msg: req.flash ? req.flash('error') : null
        });
    } catch (error) {
        console.error('Error al listar grupos:', error);
        res.status(500).send('Error en el servidor');
    }
};

exports.obtenerPorId = async (req, res) => {
    try {
        const { id } = req.params;

        const [grupos] = await db.query(`
            SELECT *
            FROM grupos
            WHERE id_grupo = ?
        `, [id]);

        if (grupos.length > 0) {
            return res.json(grupos[0]);
        }

        return res.status(404).json({ error: 'Grupo no encontrado' });
    } catch (error) {
        console.error('Error al obtener grupo:', error);
        return res.status(500).json({ error: 'Error del servidor' });
    }
};

exports.getListaGrupos = async (req, res) => {
    try {
        const [grupos] = await db.query(`
            SELECT id_grupo, nombre_grupo
            FROM grupos
            WHERE activo = 1
            ORDER BY nombre_grupo ASC
        `);

        return res.json(grupos);
    } catch (error) {
        console.error('Error al obtener lista de grupos:', error);
        return res.status(500).json([]);
    }
};

exports.crear = async (req, res) => {
    let {
        id_cliente,
        nombre_grupo,
        nombre_compania,
        nombre_contacto,
        email_contacto,
        direccion,
        ciudad,
        activo
    } = req.body;

    try {
        if (!req.session.usuario || req.session.usuario.rol !== 'super_admin') {
            return res.status(403).json({ success: false, error: 'No autorizado' });
        }

        if (!id_cliente || id_cliente === "0") {
            const [nuevoCliente] = await db.query(
                'INSERT INTO clientes (nombre_cliente, activo) VALUES (?, 1)',
                ['Cliente General Automático']
            );
            id_cliente = nuevoCliente.insertId;
        }

        await db.query(`
            INSERT INTO grupos 
            (id_cliente, nombre_grupo, nombre_compania, nombre_contacto, email_contacto, direccion, ciudad, activo)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            id_cliente,
            nombre_grupo,
            nombre_compania || null,
            nombre_contacto || null,
            email_contacto || null,
            direccion || null,
            ciudad || null,
            activo === '1' || activo === 1 ? 1 : 0
        ]);

        return res.json({ success: true, message: 'Grupo creado correctamente' });
    } catch (error) {
        console.error('Error al crear grupo:', error);
        return res.status(500).json({
            success: false,
            error: error.message || 'Error al crear el grupo'
        });
    }
};

exports.actualizar = async (req, res) => {
    console.log('=== ACTUALIZAR GRUPO ===');
    console.log('PARAMS:', req.params);
    console.log('BODY:', req.body);
    console.log('USUARIO:', req.session.usuario);

    try {
        if (!req.session.usuario || req.session.usuario.rol !== 'super_admin') {
            return res.status(403).json({ success: false, error: 'No autorizado' });
        }

        const { id } = req.params;
        const {
            nombre_grupo,
            id_cliente,
            nombre_compania,
            nombre_contacto,
            email_contacto,
            activo
        } = req.body;

        if (!nombre_grupo || !id_cliente) {
            return res.status(400).json({
                success: false,
                error: 'El nombre del grupo y el cliente son obligatorios'
            });
        }

        const [result] = await db.query(`
            UPDATE grupos
            SET
                nombre_grupo = ?,
                id_cliente = ?,
                nombre_compania = ?,
                nombre_contacto = ?,
                email_contacto = ?,
                activo = ?
            WHERE id_grupo = ?
        `, [
            nombre_grupo,
            parseInt(id_cliente),
            nombre_compania || null,
            nombre_contacto || null,
            email_contacto || null,
            activo ? 1 : 0,
            parseInt(id)
        ]);

        console.log('RESULT UPDATE:', result);

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                error: 'Grupo no encontrado'
            });
        }

        return res.json({
            success: true,
            message: 'Grupo actualizado correctamente'
        });

    } catch (error) {
        console.error('Error al actualizar grupo:', error);
        return res.status(500).json({
            success: false,
            error: error.message || 'Error en la base de datos'
        });
    }
};

exports.eliminar = async (req, res) => {
    try {
        if (!req.session.usuario || req.session.usuario.rol !== 'super_admin') {
            return res.status(403).json({ success: false, error: 'No autorizado' });
        }

        const { id } = req.params;

        const [result] = await db.query(`
            DELETE FROM grupos
            WHERE id_grupo = ?
        `, [id]);

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                error: 'Grupo no encontrado'
            });
        }

        return res.json({ success: true });
    } catch (error) {
        console.error('Error al eliminar grupo:', error);
        return res.status(500).json({
            success: false,
            error: 'No se puede eliminar el grupo porque tiene registros asociados'
        });
    }
};
exports.formCrear = async (req, res) => {
    try {
        const [clientes] = await db.query(`
            SELECT id_cliente, nombre_cliente AS nombre
            FROM clientes
            WHERE activo = 1
        `);

        const [personas] = await db.query(`
            SELECT id_persona, run, nombres
            FROM personas
            WHERE activo = 1
        `);

        res.render('AgregarGrupo', {
            title: 'Registrar Grupo',
            clientes,
            personas,
            hayClientes: clientes.length > 0,
            usuario: req.session.usuario
        });
    } catch (error) {
        console.error(error);
        res.status(500).send('Error al cargar el formulario de grupos');
    }
};