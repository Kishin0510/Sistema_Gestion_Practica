const db = require('../conexion');

// Listar todos los grupos
exports.listar = async (req, res) => {
  try {
    const [grupos] = await db.query(`
      SELECT 
        g.*,
        c.nombre as cliente_nombre,
        CONCAT(p.nombres, ' ', p.apellido_paterno) as persona_contacto_nombre
      FROM grupos g
      LEFT JOIN clientes c ON g.id_cliente = c.id_cliente
      LEFT JOIN personas p ON g.id_persona_contacto = p.id_persona
      ORDER BY g.id_grupo DESC
    `);

    res.render('grupos/listar', {
      title: 'Grupos',
      grupos,
      success: req.flash('success'),
      error: req.flash('error')
    });
  } catch (error) {
    console.error('Error al listar grupos:', error);
    res.status(500).send('Error al listar grupos');
  }
};


exports.formCrear = async (req, res) => {
  try {
    // Obtener clientes activos
    const [clientes] = await db.query(`
      SELECT id_cliente, nombre 
      FROM clientes 
      WHERE activo = 1 
      ORDER BY nombre
    `);

    
    const [personas] = await db.query(`
      SELECT 
        id_persona, 
        nombres, 
        apellido_paterno, 
        apellido_materno, 
        run, 
        dv, 
        email 
      FROM personas 
      WHERE activo = 1 
      ORDER BY apellido_paterno, nombres
    `);

    res.render('grupos/crear', {
      title: 'Crear Grupo',
      clientes: clientes || [],
      personas: personas || [],
      formData: req.flash('formData')[0] || {},
      error: req.flash('error')
    });
  } catch (error) {
    console.error('Error al cargar formulario:', error);
    req.flash('error', 'Error al cargar el formulario');
    res.redirect('/grupos');
  }
};

// Crear nuevo grupo
exports.crear = async (req, res) => {
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const {
      id_cliente,
      nombre_grupo,
      id_persona_vincular,
      nombre_contacto,
      email_contacto,
      nombre_empresa,
      direccion,
      ciudad,
      activo = '1'
    } = req.body;

    // Validaciones
    const errores = [];

    if (!id_cliente || id_cliente === '') {
      errores.push('Debe seleccionar un cliente');
    }

    if (!nombre_grupo || nombre_grupo.trim() === '') {
      errores.push('El nombre del grupo es obligatorio');
    } else if (nombre_grupo.length > 100) {
      errores.push('El nombre del grupo no puede exceder los 100 caracteres');
    }

    if (email_contacto && !isValidEmail(email_contacto)) {
      errores.push('El email de contacto no es válido');
    }

    // Verificar si el grupo ya existe
    const [grupoExistente] = await connection.query(
      'SELECT id_grupo FROM grupos WHERE nombre_grupo = ? AND id_cliente = ?',
      [nombre_grupo.trim(), id_cliente]
    );

    if (grupoExistente.length > 0) {
      errores.push('Ya existe un grupo con ese nombre para este cliente');
    }

    if (errores.length > 0) {
      req.flash('error', errores.join(', '));
      req.flash('formData', req.body);
      await connection.rollback();
      connection.release();
      return res.redirect('/grupos/crear');
    }

    
    const [result] = await connection.query(`
      INSERT INTO grupos 
      (id_cliente, nombre_grupo, nombre_contacto, email_contacto, 
       nombre_empresa, direccion, ciudad, activo, fecha_creacion)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())
    `, [
      parseInt(id_cliente),
      nombre_grupo.trim(),
      nombre_contacto ? nombre_contacto.trim() : null,
      email_contacto ? email_contacto.trim() : null,
      nombre_empresa ? nombre_empresa.trim() : null,
      direccion ? direccion.trim() : null,
      ciudad ? ciudad.trim() : null,
      activo === '1' ? 1 : 0
    ]);

    const nuevoGrupoId = result.insertId;

    
    if (id_persona_vincular && id_persona_vincular !== '') {
      
      await connection.query(
        'UPDATE grupos SET id_persona_contacto = ? WHERE id_grupo = ?',
        [parseInt(id_persona_vincular), nuevoGrupoId]
      );

    
    }

    await connection.commit();
    connection.release();

    req.flash('success', `Grupo "${nombre_grupo}" creado correctamente`);
    res.redirect('/grupos');
  } catch (error) {
    await connection.rollback();
    connection.release();

    console.error('Error al crear grupo:', error);
    req.flash('error', 'Error al crear el grupo');
    req.flash('formData', req.body);
    res.redirect('/grupos/crear');
  }
};


exports.formEditar = async (req, res) => {
  try {
    const { id } = req.params;

    
    const [grupos] = await db.query(`
      SELECT * FROM grupos WHERE id_grupo = ?
    `, [id]);

    if (grupos.length === 0) {
      req.flash('error', 'Grupo no encontrado');
      return res.redirect('/grupos');
    }

    const grupo = grupos[0];

    
    const [clientes] = await db.query(`
      SELECT id_cliente, nombre 
      FROM clientes 
      WHERE activo = 1 
      ORDER BY nombre
    `);

    
    const [personas] = await db.query(`
      SELECT 
        id_persona, 
        nombres, 
        apellido_paterno, 
        apellido_materno, 
        run, 
        dv, 
        email 
      FROM personas 
      WHERE activo = 1 
      ORDER BY apellido_paterno, nombres
    `);

    
    let personaVinculada = null;
    if (grupo.id_persona_contacto) {
      const [personasVinculadas] = await db.query(`
        SELECT id_persona, nombres, apellido_paterno, run, dv
        FROM personas 
        WHERE id_persona = ?
      `, [grupo.id_persona_contacto]);

      personaVinculada = personasVinculadas[0] || null;
    }

    res.render('grupos/editar', {
      title: 'Editar Grupo',
      grupo,
      clientes: clientes || [],
      personas: personas || [],
      personaVinculada,
      error: req.flash('error')
    });
  } catch (error) {
    console.error('Error al cargar formulario de edición:', error);
    req.flash('error', 'Error al cargar el formulario de edición');
    res.redirect('/grupos');
  }
};


exports.actualizar = async (req, res) => {
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const { id } = req.params;
    const {
      id_cliente,
      nombre_grupo,
      id_persona_vincular,
      nombre_contacto,
      email_contacto,
      nombre_empresa,
      direccion,
      ciudad,
      activo = '1'
    } = req.body;

    
    const errores = [];

    if (!id_cliente || id_cliente === '') {
      errores.push('Debe seleccionar un cliente');
    }

    if (!nombre_grupo || nombre_grupo.trim() === '') {
      errores.push('El nombre del grupo es obligatorio');
    } else if (nombre_grupo.length > 100) {
      errores.push('El nombre del grupo no puede exceder los 100 caracteres');
    }

    if (email_contacto && !isValidEmail(email_contacto)) {
      errores.push('El email de contacto no es válido');
    }

    // Verificar si el grupo ya existe (excluyendo el actual)
    const [grupoExistente] = await connection.query(
      'SELECT id_grupo FROM grupos WHERE nombre_grupo = ? AND id_cliente = ? AND id_grupo != ?',
      [nombre_grupo.trim(), id_cliente, id]
    );

    if (grupoExistente.length > 0) {
      errores.push('Ya existe un grupo con ese nombre para este cliente');
    }

    if (errores.length > 0) {
      req.flash('error', errores.join(', '));
      await connection.rollback();
      connection.release();
      return res.redirect(`/grupos/editar/${id}`);
    }

    // Actualizar el grupo
    await connection.query(`
      UPDATE grupos 
      SET id_cliente = ?, 
          nombre_grupo = ?, 
          nombre_contacto = ?, 
          email_contacto = ?, 
          nombre_empresa = ?, 
          direccion = ?, 
          ciudad = ?, 
          activo = ?,
          id_persona_contacto = ?
      WHERE id_grupo = ?
    `, [
      parseInt(id_cliente),
      nombre_grupo.trim(),
      nombre_contacto ? nombre_contacto.trim() : null,
      email_contacto ? email_contacto.trim() : null,
      nombre_empresa ? nombre_empresa.trim() : null,
      direccion ? direccion.trim() : null,
      ciudad ? ciudad.trim() : null,
      activo === '1' ? 1 : 0,
      id_persona_vincular && id_persona_vincular !== '' ? parseInt(id_persona_vincular) : null,
      id
    ]);

    await connection.commit();
    connection.release();

    req.flash('success', `Grupo "${nombre_grupo}" actualizado correctamente`);
    res.redirect('/grupos');
  } catch (error) {
    await connection.rollback();
    connection.release();

    console.error('Error al actualizar grupo:', error);
    req.flash('error', 'Error al actualizar el grupo');
    res.redirect(`/grupos/editar/${req.params.id}`);
  }
};

// Eliminar grupo
exports.eliminar = async (req, res) => {
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const { id } = req.params;

    // Verificar si el grupo existe
    const [grupos] = await connection.query(
      'SELECT nombre_grupo FROM grupos WHERE id_grupo = ?',
      [id]
    );

    if (grupos.length === 0) {
      req.flash('error', 'Grupo no encontrado');
      await connection.rollback();
      connection.release();
      return res.redirect('/grupos');
    }

    // Verificar si hay vehículos asociados al grupo
    const [vehiculosAsociados] = await connection.query(
      'SELECT COUNT(*) as count FROM vehiculos WHERE id_grupo = ?',
      [id]
    );

    if (vehiculosAsociados[0].count > 0) {
      req.flash('error', 'No se puede eliminar el grupo porque tiene vehículos asociados');
      await connection.rollback();
      connection.release();
      return res.redirect('/grupos');
    }

    // Eliminar el grupo
    await connection.query('DELETE FROM grupos WHERE id_grupo = ?', [id]);

    await connection.commit();
    connection.release();

    req.flash('success', `Grupo "${grupos[0].nombre_grupo}" eliminado correctamente`);
    res.redirect('/grupos');
  } catch (error) {
    await connection.rollback();
    connection.release();

    console.error('Error al eliminar grupo:', error);
    req.flash('error', 'Error al eliminar el grupo');
    res.redirect('/grupos');
  }
};


exports.buscarPersonaPorId = async (req, res) => {
  try {
    const { id } = req.params;

    const [personas] = await db.query(`
      SELECT 
        id_persona, 
        nombres, 
        apellido_paterno, 
        apellido_materno, 
        run, 
        dv, 
        email, 
        telefono, 
        direccion,
        activo
      FROM personas 
      WHERE id_persona = ?
    `, [id]);

    if (personas.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Persona no encontrada'
      });
    }

    const persona = personas[0];

    
    persona.nombre_completo = `${persona.nombres} ${persona.apellido_paterno} ${persona.apellido_materno}`.trim();

    res.json({
      success: true,
      persona: persona
    });
  } catch (error) {
    console.error('Error al buscar persona por ID:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
};


exports.buscarPersonaPorRun = async (req, res) => {
  try {
    const { run } = req.params;

    
    let runNumero = run;
    let dv = '';

    if (run.includes('-')) {
      [runNumero, dv] = run.split('-');
    }

    
    let query = `
      SELECT 
        id_persona, 
        nombres, 
        apellido_paterno, 
        apellido_materno, 
        run, 
        dv, 
        email, 
        telefono, 
        direccion,
        activo
      FROM personas 
      WHERE run = ?
    `;

    const params = [runNumero];

    if (dv) {
      query += ' AND dv = ?';
      params.push(dv.toUpperCase());
    }

    const [personas] = await db.query(query, params);

    if (personas.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Persona no encontrada'
      });
    }

    const persona = personas[0];

    
    persona.nombre_completo = `${persona.nombres} ${persona.apellido_paterno} ${persona.apellido_materno}`.trim();

    res.json({
      success: true,
      persona: persona
    });
  } catch (error) {
    console.error('Error al buscar persona por RUN:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
};


function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}