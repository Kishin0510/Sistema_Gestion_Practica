const db = require('../conexion');


exports.listar = async (req, res) => {
  try {
    
    const [grupos] = await db.query(`
      SELECT g.*, c.nombre as cliente_nombre,
      CONCAT(p.nombres, ' ', p.apellido_paterno) as persona_contacto_nombre
      FROM grupos g
      LEFT JOIN clientes c ON g.id_cliente = c.id_cliente
      LEFT JOIN personas p ON g.id_persona_contacto = p.id_persona
      ORDER BY g.id_grupo DESC
    `);

    
    const [clientes] = await db.query('SELECT id_cliente, nombre FROM clientes WHERE activo = 1 ORDER BY nombre ASC');

    
    const [personas] = await db.query('SELECT id_persona, nombres, apellido_paterno, run, dv, email, telefono FROM personas WHERE activo = 1');

    res.render('grupos/listar', {
      title: 'Mis Grupos',
      grupos,
      clientes,  
      personas,  
      usuario: req.session.usuario, 
      success_msg: req.flash('success'),
      error_msg: req.flash('error')
    });
  } catch (error) {
    console.error('Error al listar:', error);
    res.status(500).send('Error en el servidor');
  }
};


exports.getUsuariosPorGrupo = async (req, res) => {
  try {
    const { id } = req.params;
    const [usuarios] = await db.query(`
      SELECT id_persona, CONCAT(nombres, ' ', apellido_paterno) as nombre_completo, run, email as correo 
      FROM personas WHERE id_grupo = ?`, [id]);
    res.json(usuarios);
  } catch (e) { res.status(500).json([]); }
};

exports.getListaGrupos = async (req, res) => {
  try {
    const [grups] = await db.query('SELECT id_grupo, nombre_grupo FROM grupos WHERE activo = 1');
    res.json(grups);
  } catch (e) { res.status(500).json([]); }
};

exports.cambiarGrupoUsuario = async (req, res) => {
  if (!req.session.usuario || req.session.usuario.rol !== 'super_admin') {
    return res.status(403).json({ success: false, error: 'No autorizado' });
  }
  const { id_usuario, id_grupo_nuevo } = req.body;
  try {
    await db.query('UPDATE personas SET id_grupo = ? WHERE id_persona = ?', [id_grupo_nuevo, id_usuario]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false }); }
};

// Mantener funciones crear, eliminar, actualizar, buscarPersonaPorId, etc.
exports.crear = async (req, res) => { /* Tu código original sin borrar nada */ };
exports.actualizar = async (req, res) => { /* Tu código original sin borrar nada */ };
exports.eliminar = async (req, res) => { /* Tu código original sin borrar nada */ };
exports.buscarPersonaPorId = async (req, res) => { /* Tu código original sin borrar nada */ };
exports.buscarPersonaPorRun = async (req, res) => { /* Tu código original sin borrar nada */ };
exports.formCrear = async (req, res) => { /* Tu código original sin borrar nada */ };
exports.formEditar = async (req, res) => { /* Tu código original sin borrar nada */ };