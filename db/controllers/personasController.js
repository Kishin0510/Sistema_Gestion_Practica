const db = require('../conexion');

const personasController = {
    // Listar todas las personas
    listarPersonas: async (req, res) => {
        try {
            console.log(' Cargando listado de personas...');

            // Primero, verifiquemos la estructura de la tabla
            const [estructura] = await db.query('DESCRIBE personas');
            console.log('Estructura tabla personas:', estructura);

            // Consulta corregida usando id_persona
            const query = `
                SELECT 
                    p.*,
                    c.nombre_cliente,
                    c.rut_cliente,
                    CONCAT(p.nombres, ' ', p.apellido_paterno, ' ', COALESCE(p.apellido_materno, '')) AS nombre_completo
                FROM personas p
                LEFT JOIN clientes c ON p.id_cliente = c.id_cliente
                ORDER BY p.id_persona DESC
            `;

            const [personas] = await db.query(query);
            
            console.log(` ${personas.length} persona(s) cargada(s)`);

            res.render('listarPersonas', {
                title: 'Listado de Personas',
                personas: personas,
                success: req.query.success,
                error: req.query.error
            });

        } catch (error) {
            console.error(' Error al listar personas:', error);
            
            // Intentar con una consulta más simple
            try {
                const [personas] = await db.query(`
                    SELECT p.*, c.nombre_cliente 
                    FROM personas p
                    LEFT JOIN clientes c ON p.id_cliente = c.id_cliente
                    ORDER BY p.fecha_registro DESC
                `);
                
                res.render('listarPersonas', {
                    title: 'Listado de Personas',
                    personas: personas || [],
                    success: req.query.success,
                    error: req.query.error
                });
            } catch (err2) {
                console.error(' Error en consulta de respaldo:', err2);
                res.render('listarPersonas', {
                    title: 'Listado de Personas',
                    personas: [],
                    error: 'Error al cargar las personas'
                });
            }
        }
    },

    // Mostrar formulario para agregar persona
    mostrarFormularioAgregar: async (req, res) => {
        try {
            console.log(' Cargando formulario de agregar persona...');

            // Obtener clientes activos
            let clientes = [];
            try {
                const [rowsClientes] = await db.query(
                    'SELECT id_cliente, nombre_cliente, rut_cliente FROM clientes WHERE activo = 1 ORDER BY nombre_cliente'
                );
                clientes = rowsClientes || [];
                console.log(` ${clientes.length} cliente(s) cargado(s)`);
            } catch (err) {
                console.log(' No se pudieron obtener clientes:', err.message);
            }

            // Datos del formulario si hay error
            let datosForm = {};
            if (req.query.datos) {
                try {
                    datosForm = JSON.parse(decodeURIComponent(req.query.datos));
                } catch (e) { }
            }

            // Calcular si hay clientes
            const hayClientes = clientes && clientes.length > 0;

            res.render('agregarPersona', {
                title: 'Agregar Persona',
                clientes: clientes,
                datosFormulario: datosForm,
                hayClientes: hayClientes,
                success: req.query.success,
                error: req.query.error
            });

        } catch (error) {
            console.error(' Error al cargar formulario:', error);
            res.render('agregarPersona', {
                title: 'Agregar Persona',
                clientes: [],
                hayClientes: false,
                error: 'Error al cargar el formulario'
            });
        }
    },

    // Procesar formulario de persona
    agregarPersona: async (req, res) => {
        try {
            console.log(' Procesando nueva persona...');

            const {
                id_cliente,
                run,
                dv,
                nombres,
                apellido_paterno,
                apellido_materno,
                email,
                telefono,
                fecha_nacimiento,
                cargo,
                activo
            } = req.body;

            console.log('Datos recibidos:', {
                id_cliente, run, dv, nombres, apellido_paterno,
                apellido_materno, email, telefono, fecha_nacimiento, cargo, activo
            });

            // Validación de campos obligatorios
            const camposObligatorios = [
                { campo: run, nombre: 'RUN' },
                { campo: dv, nombre: 'DV' },
                { campo: nombres, nombre: 'Nombres' },
                { campo: apellido_paterno, nombre: 'Apellido Paterno' }
            ];

            const camposFaltantes = camposObligatorios
                .filter(item => !item.campo || item.campo.trim() === '')
                .map(item => item.nombre);

            if (camposFaltantes.length > 0) {
                const datosJSON = encodeURIComponent(JSON.stringify(req.body));
                return res.redirect(`/personas/agregar?error=Faltan campos obligatorios: ${camposFaltantes.join(', ')}&datos=${datosJSON}`);
            }

            // Validar formato RUN
            if (!/^\d{7,8}$/.test(run)) {
                const datosJSON = encodeURIComponent(JSON.stringify(req.body));
                return res.redirect(`/personas/agregar?error=RUN debe tener 7 u 8 dígitos&datos=${datosJSON}`);
            }

            // Validar formato DV
            if (!/^[0-9K]$/i.test(dv)) {
                const datosJSON = encodeURIComponent(JSON.stringify(req.body));
                return res.redirect(`/personas/agregar?error=DV debe ser un número (0-9) o la letra K&datos=${datosJSON}`);
            }

            // Manejar cliente
            let clienteId = id_cliente;
            let clienteCreado = false;

            // Si no hay cliente seleccionado o es 0, crear uno
            if (!clienteId || clienteId === '0') {
                console.log(' Creando cliente automáticamente...');
                
                const nombreCompleto = `${nombres} ${apellido_paterno} ${apellido_materno || ''}`.trim();
                const rutCompleto = `${run}-${dv.toUpperCase()}`;
                
                try {
                    const [clienteResult] = await db.query(
                        'INSERT INTO clientes (nombre_cliente, rut_cliente, correo_contacto, telefono, activo) VALUES (?, ?, ?, ?, ?)',
                        [
                            nombreCompleto || 'Cliente Generado',
                            rutCompleto,
                            email || null,
                            telefono || null,
                            1
                        ]
                    );
                    
                    clienteId = clienteResult.insertId;
                    clienteCreado = true;
                    console.log(` Cliente creado ID: ${clienteId}`);
                } catch (clienteErr) {
                    console.error(' Error creando cliente:', clienteErr);
                    const datosJSON = encodeURIComponent(JSON.stringify(req.body));
                    return res.redirect(`/personas/agregar?error=No se pudo crear cliente automático&datos=${datosJSON}`);
                }
            }

            // Verificar que el cliente existe
            const [clienteCheck] = await db.query(
                'SELECT id_cliente FROM clientes WHERE id_cliente = ?',
                [clienteId]
            );

            if (clienteCheck.length === 0) {
                const datosJSON = encodeURIComponent(JSON.stringify(req.body));
                return res.redirect(`/personas/agregar?error=Cliente no válido&datos=${datosJSON}`);
            }

            // Verificar RUN único para el cliente
            const [runExistente] = await db.query(
                'SELECT id_persona FROM personas WHERE id_cliente = ? AND run = ?',
                [clienteId, run]
            );

            if (runExistente.length > 0) {
                const datosJSON = encodeURIComponent(JSON.stringify(req.body));
                return res.redirect(`/personas/agregar?error=El RUN ya existe para este cliente&datos=${datosJSON}`);
            }

            // Insertar persona
            console.log(' Insertando persona...');

            const [result] = await db.query(
                `INSERT INTO personas (
                    id_cliente,
                    run,
                    dv,
                    nombres,
                    apellido_paterno,
                    apellido_materno,
                    email,
                    telefono,
                    fecha_nacimiento,
                    cargo,
                    activo
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    clienteId,
                    run.trim(),
                    dv.toUpperCase().trim(),
                    nombres.trim(),
                    apellido_paterno.trim(),
                    apellido_materno ? apellido_materno.trim() : null,
                    email ? email.trim() : null,
                    telefono ? telefono.trim() : null,
                    fecha_nacimiento || null,
                    cargo ? cargo.trim() : null,
                    activo === '1' ? 1 : 0
                ]
            );

            console.log(' Persona creada ID:', result.insertId);
            
            let mensajeExito = `Persona agregada exitosamente (ID: ${result.insertId})`;
            if (clienteCreado) {
                mensajeExito += ' - Cliente creado automáticamente';
            }
            
            return res.redirect(`/personas?success=${encodeURIComponent(mensajeExito)}`);

        } catch (error) {
            console.error(' Error al agregar persona:', error);

            // Mantener datos si hay error
            const datosJSON = encodeURIComponent(JSON.stringify(req.body));

            if (error.code === 'ER_BAD_FIELD_ERROR') {
                console.error(' Error de campo en base de datos:', error.sqlMessage);
                return res.redirect(`/personas/agregar?error=Error en estructura de base de datos&datos=${datosJSON}`);
            }

            if (error.code === 'ER_DUP_ENTRY') {
                return res.redirect(`/personas/agregar?error=RUN duplicado para este cliente&datos=${datosJSON}`);
            }

            if (error.code === 'ER_NO_REFERENCED_ROW_2') {
                return res.redirect(`/personas/agregar?error=Cliente no existe en la base de datos&datos=${datosJSON}`);
            }

            return res.redirect(`/personas/agregar?error=Error: ${error.message}&datos=${datosJSON}`);
        }
    },

    // Mostrar formulario de edición
    mostrarFormularioEditar: async (req, res) => {
        try {
            const { id } = req.params;
            console.log(`  Cargando formulario edición persona ID: ${id}`);

            // Obtener persona - usar id_persona
            const [personas] = await db.query(
                'SELECT * FROM personas WHERE id_persona = ?', 
                [id]
            );

            if (personas.length === 0) {
                return res.redirect('/personas?error=Persona no encontrada');
            }

            const persona = personas[0];

            // Obtener clientes activos
            const [clientes] = await db.query(
                'SELECT id_cliente, nombre_cliente, rut_cliente FROM clientes WHERE activo = 1 ORDER BY nombre_cliente'
            );

            res.render('editarPersona', {
                title: 'Editar Persona',
                persona: persona,
                clientes: clientes,
                error: req.query.error
            });

        } catch (error) {
            console.error(' Error al cargar formulario de edición:', error);
            res.redirect('/personas?error=Error al cargar formulario de edición');
        }
    },

    // Actualizar persona
    actualizarPersona: async (req, res) => {
        try {
            const { id } = req.params;
            console.log(` Actualizando persona ID: ${id}`);

            const {
                id_cliente,
                run,
                dv,
                nombres,
                apellido_paterno,
                apellido_materno,
                email,
                telefono,
                fecha_nacimiento,
                cargo,
                activo
            } = req.body;

            // Validación de campos obligatorios
            const camposObligatorios = [
                { campo: id_cliente, nombre: 'Cliente' },
                { campo: run, nombre: 'RUN' },
                { campo: dv, nombre: 'DV' },
                { campo: nombres, nombre: 'Nombres' },
                { campo: apellido_paterno, nombre: 'Apellido Paterno' }
            ];

            const camposFaltantes = camposObligatorios
                .filter(item => !item.campo || item.campo.trim() === '')
                .map(item => item.nombre);

            if (camposFaltantes.length > 0) {
                return res.redirect(`/personas/editar/${id}?error=Faltan campos obligatorios: ${camposFaltantes.join(', ')}`);
            }

            // Verificar si la persona existe - usar id_persona
            const [personaExistente] = await db.query(
                'SELECT id_persona FROM personas WHERE id_persona = ?',
                [id]
            );

            if (personaExistente.length === 0) {
                return res.redirect('/personas?error=Persona no encontrada');
            }

            // Verificar RUN único (excluyendo el actual) - usar id_persona
            const [runDuplicado] = await db.query(
                'SELECT id_persona FROM personas WHERE id_cliente = ? AND run = ? AND id_persona != ?',
                [id_cliente, run, id]
            );

            if (runDuplicado.length > 0) {
                return res.redirect(`/personas/editar/${id}?error=El RUN ya existe para otra persona de este cliente`);
            }

            // Actualizar persona - usar id_persona
            const [result] = await db.query(
                `UPDATE personas SET
                    id_cliente = ?,
                    run = ?,
                    dv = ?,
                    nombres = ?,
                    apellido_paterno = ?,
                    apellido_materno = ?,
                    email = ?,
                    telefono = ?,
                    fecha_nacimiento = ?,
                    cargo = ?,
                    activo = ?
                WHERE id_persona = ?`,
                [
                    id_cliente,
                    run.trim(),
                    dv.toUpperCase().trim(),
                    nombres.trim(),
                    apellido_paterno.trim(),
                    apellido_materno ? apellido_materno.trim() : null,
                    email ? email.trim() : null,
                    telefono ? telefono.trim() : null,
                    fecha_nacimiento || null,
                    cargo ? cargo.trim() : null,
                    activo === '1' ? 1 : 0,
                    id
                ]
            );

            console.log(` Persona ${id} actualizada`);
            return res.redirect('/personas?success=Persona actualizada exitosamente');

        } catch (error) {
            console.error(' Error al actualizar persona:', error);
            return res.redirect(`/personas/editar/${req.params.id}?error=Error al actualizar persona`);
        }
    },

    // Eliminar persona
    eliminarPersona: async (req, res) => {
        try {
            const { id } = req.params;
            console.log(`  Eliminando persona ID: ${id}`);

            const [result] = await db.query('DELETE FROM personas WHERE id_persona = ?', [id]);

            if (result.affectedRows > 0) {
                console.log(` Persona ${id} eliminada`);
                return res.redirect('/personas?success=Persona eliminada exitosamente');
            } else {
                return res.redirect('/personas?error=Persona no encontrada');
            }

        } catch (error) {
            console.error(' Error al eliminar persona:', error);
            
            if (error.code === 'ER_ROW_IS_REFERENCED_2') {
                return res.redirect('/personas?error=No se puede eliminar la persona porque tiene vehículos asociados');
            }
            
            return res.redirect('/personas?error=Error al eliminar persona');
        }
    }
};

module.exports = personasController;