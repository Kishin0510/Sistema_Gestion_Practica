const db = require('../conexion');

exports.listar = async (req, res) => {
    try {
        const [grupos] = await db.query(`
            SELECT g.*, c.nombre as cliente_nombre
            FROM grupos g
            LEFT JOIN clientes c ON g.id_cliente = c.id_cliente
            ORDER BY g.id_grupo DESC
        `);

        const [clientes] = await db.query('SELECT id_cliente, nombre FROM clientes WHERE activo = 1 ORDER BY nombre ASC');

        res.render('grupos/listar', {
            title: 'Mis Grupos',
            grupos,
            clientes,
            usuario: req.session.usuario,
            success_msg: req.flash('success'),
            error_msg: req.flash('error')
        });
    } catch (error) {
        console.error('Error al listar:', error);
        res.status(500).send('Error en el servidor');
    }
};
exports.obtenerPorId = async (req, res) => {
    try {
        const { id } = req.params;
        const [grupos] = await db.query('SELECT * FROM grupos WHERE id_grupo = ?', [id]);
        if (grupos.length > 0) {
            res.json(grupos[0]);
        } else {
            res.status(404).json({ error: 'Grupo no encontrado' });
        }
    } catch (error) {
        console.error('Error al obtener grupo:', error);
        res.status(500).json({ error: 'Error del servidor' });
    }
};

exports.getUsuariosPorGrupo = async (req, res) => {
    try {
        const { id } = req.params;
        const [usuarios] = await db.query(`
            SELECT id_persona, nombres, apellido_paterno, run, dv, email 
            FROM personas 
            WHERE id_grupo = ?`, [id]);
        
        const respuesta = usuarios.map(u => ({
            ...u,
            nombre_completo: `${u.nombres} ${u.apellido_paterno}`
        }));
        
        res.json(respuesta);
    } catch (error) {
        console.error('Error al obtener usuarios del grupo:', error);
        res.status(500).json([]);
    }
};

exports.getListaGrupos = async (req, res) => {
    try {
        const [grups] = await db.query('SELECT id_grupo, nombre_grupo FROM grupos WHERE activo = 1');
        res.json(grups);
    } catch (error) {
        res.status(500).json([]);
    }
};

exports.cambiarGrupoMultiple = async (req, res) => {
    if (!req.session.usuario || req.session.usuario.rol !== 'super_admin') {
        return res.status(403).json({ success: false, error: 'No autorizado' });
    }

    const { usuarios, id_grupo_nuevo } = req.body; 
    
    if (!usuarios || !id_grupo_nuevo) {
        return res.status(400).json({ success: false, error: 'Datos incompletos' });
    }

    try {
        await db.query('UPDATE personas SET id_grupo = ? WHERE id_persona IN (?)', [id_grupo_nuevo, usuarios]);
        res.json({ success: true });
    } catch (error) {
        console.error('Error al mover usuarios:', error);
        res.status(500).json({ success: false, error: 'Error en base de datos' });
    }
};

exports.crear = async (req, res) => {
    const { nombre_grupo, id_cliente, nombre_compania, nombre_contacto, email_contacto, activo } = req.body;
    try {
        await db.query(`
            INSERT INTO grupos (nombre_grupo, id_cliente, nombre_compania, nombre_contacto, email_contacto, activo) 
            VALUES (?, ?, ?, ?, ?, ?)`, 
            [nombre_grupo, id_cliente, nombre_compania, nombre_contacto, email_contacto, activo || 1]);
        
        req.flash('success', 'Grupo creado exitosamente');
        res.redirect('/grupos');
    } catch (error) {
        console.error(error);
        req.flash('error', 'Error al crear el grupo');
        res.redirect('/grupos/crear');
    }
};

exports.actualizar = async (req, res) => {
    const { id } = req.params;
    const { nombre_grupo, id_cliente, nombre_compania, nombre_contacto, email_contacto, activo } = req.body;
    
    try {
        if (!nombre_grupo || !id_cliente) {
            return res.status(400).json({ success: false, error: 'El nombre del grupo y cliente son obligatorios' });
        }

        await db.query(`
            UPDATE grupos 
            SET nombre_grupo = ?, 
                id_cliente = ?, 
                nombre_compania = ?, 
                nombre_contacto = ?, 
                email_contacto = ?, 
                activo = ?
            WHERE id_grupo = ?`, 
            [
                nombre_grupo, 
                id_cliente, 
                nombre_compania || null, 
                nombre_contacto || null, 
                email_contacto || null, 
                activo ? 1 : 0, 
                id
            ]
        );
        
        res.json({ success: true, message: 'Grupo actualizado correctamente' });
    } catch (error) {
        console.error('Error al actualizar grupo:', error);
        res.status(500).json({ success: false, error: 'Error en la base de datos' });
    }
};

exports.eliminar = async (req, res) => {
    const { id } = req.params;
    try {
        await db.query('DELETE FROM grupos WHERE id_grupo = ?', [id]);
        res.json({ success: true });
    } catch (error) {
        console.error('Error al eliminar:', error);
        res.status(500).json({ success: false, error: 'No se puede eliminar el grupo porque tiene registros asociados' });
    }
};

exports.formCrear = (req, res) => {
    res.render('grupos/crear', { title: 'Registrar Grupo' });
};

exports.formEditar = async (req, res) => {
    const { id } = req.params;
    const [grupo] = await db.query('SELECT * FROM grupos WHERE id_grupo = ?', [id]);
    res.render('grupos/editar', { title: 'Editar Grupo', grupo: grupo[0] });
};