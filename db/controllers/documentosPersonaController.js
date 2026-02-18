require('dotenv').config();
const db = require('../conexion');
const fs = require('fs');
const path = require('path');

const logError = (tag, err) => console.error(`Error en ${tag}:`, err.message || err);

const documentoPersonaController = {

    // ============ VISTA PRINCIPAL MEJORADA ============
    mostrarDocumentos: async (req, res) => {
        try {
            const idCliente = req.session?.usuario?.id_cliente || 1;

            console.log('Cargando documentos para cliente:', idCliente);

            // 1. Obtener personas activas - CON MÁS INFORMACIÓN
            const [personas] = await db.execute(`
                SELECT 
                    p.id_persona,
                    p.run,
                    p.dv,
                    CONCAT(p.run, '-', p.dv) as dni,
                    p.nombres,
                    p.apellido_paterno,
                    p.apellido_materno,
                    CONCAT(p.nombres, ' ', p.apellido_paterno) as nombre_completo,
                    p.email,
                    p.telefono,
                    p.cargo,
                    p.activo,
                    c.nombre_cliente,
                    c.rut_cliente
                FROM personas p
                LEFT JOIN clientes c ON p.id_cliente = c.id_cliente
                WHERE p.id_cliente = ? AND p.activo = 1
                ORDER BY p.apellido_paterno ASC, p.nombres ASC
            `, [idCliente]);

            console.log(`Personas encontradas: ${personas.length}`);

            // 2. Obtener tipos de documentos activos
            const [tiposDocumentos] = await db.execute(`
                SELECT 
                    id_tipo_documento,
                    nombre_documento,
                    descripcion,
                    dias_alerta,
                    obligatorio,
                    activo
                FROM tipo_documentos_persona 
                WHERE id_cliente = ? AND activo = 1
                ORDER BY nombre_documento ASC
            `, [idCliente]);

            // 3. Obtener todos los documentos con información completa
            const [documentos] = await db.execute(`
                SELECT 
                    dp.id_documento,
                    dp.id_persona,
                    dp.id_tipo_documento,
                    dp.numero_documento,
                    DATE_FORMAT(dp.fecha_emision, '%Y-%m-%d') as fecha_emision,
                    DATE_FORMAT(dp.fecha_vencimiento, '%Y-%m-%d') as fecha_vencimiento,
                    dp.nombre_archivo,
                    dp.ruta_archivo,
                    dp.observaciones,
                    dp.fecha_subida,
                    dp.estado,
                    CONCAT(p.nombres, ' ', p.apellido_paterno) as persona_nombre_completo,
                    CONCAT(p.run, '-', p.dv) as persona_dni,
                    p.run as persona_run,
                    p.dv as persona_dv,
                    p.cargo,
                    p.email as persona_email,
                    p.telefono as persona_telefono,
                    td.nombre_documento as tipo_documento_nombre,
                    u.nombre_completo as usuario_subida_nombre,
                    DATEDIFF(dp.fecha_vencimiento, CURDATE()) as dias_restantes
                FROM documentos_persona dp
                INNER JOIN personas p ON dp.id_persona = p.id_persona
                LEFT JOIN tipo_documentos_persona td ON dp.id_tipo_documento = td.id_tipo_documento
                LEFT JOIN usuarios u ON dp.usuario_subida = u.id_usuario
                WHERE p.id_cliente = ? AND p.activo = 1
                ORDER BY dp.fecha_vencimiento ASC, dp.fecha_subida DESC
            `, [idCliente]);

            console.log(`Documentos encontrados: ${documentos.length}`);

            // 4. Calcular estado para cada documento
            const hoy = new Date();
            const documentosConEstado = documentos.map(doc => {
                const vencimiento = new Date(doc.fecha_vencimiento);
                const diffTime = vencimiento - hoy;
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                let estadoClass = 'success';
                let estadoTexto = 'Vigente';

                if (diffDays <= 0) {
                    estadoClass = 'danger';
                    estadoTexto = 'Vencido';
                } else if (diffDays <= 7) {
                    estadoClass = 'danger';
                    estadoTexto = 'Urgente';
                } else if (diffDays <= 30) {
                    estadoClass = 'warning';
                    estadoTexto = 'Por vencer';
                }

                return {
                    ...doc,
                    dias_restantes: diffDays,
                    estado_class: estadoClass,
                    estado_texto: estadoTexto
                };
            });

            // 5. Documentos próximos a vencer
            const documentosProximos = documentosConEstado.filter(doc =>
                doc.dias_restantes > 0 && doc.dias_restantes <= 30
            ).sort((a, b) => a.dias_restantes - b.dias_restantes);

            // 6. Estadísticas
            const totalDocumentos = documentos.length;
            const documentosVigentes = documentosConEstado.filter(d => d.dias_restantes > 30).length;
            const documentosPorVencer = documentosConEstado.filter(d => d.dias_restantes > 0 && d.dias_restantes <= 30).length;
            const documentosVencidos = documentosConEstado.filter(d => d.dias_restantes <= 0).length;

            // 7. Renderizar vista con TODOS los datos
            res.render('DocumentosPersonas', {
                title: 'Gestion Documental - Personas',
                layout: 'layouts/main',
                personas: personas,
                tiposDocumentos: tiposDocumentos,
                documentos: documentosConEstado,
                documentosProximos: documentosProximos,
                totalDocumentos: totalDocumentos,
                documentosVigentes: documentosVigentes,
                documentosPorVencer: documentosPorVencer,
                documentosVencidos: documentosVencidos,
                fecha: new Date(),
                success_msg: req.query.success || null,
                error_msg: req.query.error || null
            });

        } catch (err) {
            logError('MOSTRAR DOCUMENTOS', err);
            console.error('Error detallado:', err);

            res.render('DocumentosPersonas', {
                title: 'Gestion Documental - Personas',
                layout: 'layouts/main',
                personas: [],
                tiposDocumentos: [],
                documentos: [],
                documentosProximos: [],
                totalDocumentos: 0,
                documentosVigentes: 0,
                documentosPorVencer: 0,
                documentosVencidos: 0,
                fecha: new Date(),
                error_msg: 'Error al cargar los documentos: ' + err.message
            });
        }
    },

    // ============ AGREGAR DOCUMENTO ============
    agregarDocumento: async (req, res) => {
        let conn;
        try {
            conn = await db.pool.promise().getConnection();
            await conn.beginTransaction();

            const {
                id_persona,
                tipo_documento_nombre,
                numero_documento,
                fecha_emision,
                fecha_vencimiento,
                observaciones,
                enviar_alerta
            } = req.body;

            console.log('Datos recibidos:', req.body);
            console.log('Archivo:', req.file);

            // Validaciones basicas
            if (!id_persona || !tipo_documento_nombre || !numero_documento || !fecha_vencimiento) {
                throw new Error('Faltan campos obligatorios');
            }

            // Verificar que la persona existe
            const [persona] = await conn.execute(
                `SELECT id_persona, id_cliente, CONCAT(nombres, ' ', apellido_paterno) as nombre_completo 
                 FROM personas WHERE id_persona = ? AND activo = 1`,
                [id_persona]
            );

            if (persona.length === 0) {
                throw new Error('La persona seleccionada no existe o esta inactiva');
            }

            const id_cliente = persona[0].id_cliente;

            // PROCESAR TIPO DE DOCUMENTO
            let id_tipo_documento = null;

            // Buscar si ya existe el tipo de documento por nombre
            const [tipoExistente] = await conn.execute(
                `SELECT id_tipo_documento 
                 FROM tipo_documentos_persona 
                 WHERE nombre_documento = ? AND id_cliente = ? AND activo = 1`,
                [tipo_documento_nombre.trim(), id_cliente]
            );

            if (tipoExistente.length > 0) {
                id_tipo_documento = tipoExistente[0].id_tipo_documento;
            } else {
                // Crear nuevo tipo de documento
                const [nuevoTipo] = await conn.execute(
                    `INSERT INTO tipo_documentos_persona 
                     (id_cliente, nombre_documento, descripcion, dias_alerta, obligatorio, activo) 
                     VALUES (?, ?, ?, ?, ?, 1)`,
                    [
                        id_cliente,
                        tipo_documento_nombre.trim(),
                        'Creado automaticamente al registrar documento',
                        30,
                        false
                    ]
                );
                id_tipo_documento = nuevoTipo.insertId;
            }

            // Calcular estado inicial
            const hoy = new Date();
            const vencimiento = new Date(fecha_vencimiento);
            const diffDays = Math.ceil((vencimiento - hoy) / (1000 * 60 * 60 * 24));

            let estado = 'vigente';
            if (diffDays <= 0) {
                estado = 'vencido';
            } else if (diffDays <= 30) {
                estado = 'por_vencer';
            }

            // Procesar archivo si existe
            let nombre_archivo = null;
            let ruta_archivo = null;

            if (req.file) {
                nombre_archivo = req.file.filename;
                ruta_archivo = `/uploads/documentos_persona/${req.file.filename}`;
            }

            // Insertar documento
            const [result] = await conn.execute(`
                INSERT INTO documentos_persona (
                    id_persona,
                    id_tipo_documento,
                    numero_documento,
                    fecha_emision,
                    fecha_vencimiento,
                    nombre_archivo,
                    ruta_archivo,
                    observaciones,
                    fecha_subida,
                    usuario_subida,
                    estado
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?, ?)
            `, [
                id_persona,
                id_tipo_documento,
                numero_documento.trim(),
                fecha_emision || null,
                fecha_vencimiento,
                nombre_archivo,
                ruta_archivo,
                observaciones || null,
                req.session?.usuario?.id_usuario || null,
                estado
            ]);

            // Crear alerta si corresponde
            if ((enviar_alerta === 'on' || enviar_alerta === 'true') && diffDays <= 30 && diffDays > 0) {
                await conn.execute(`
                    INSERT INTO alertas (
                        tipo_entidad,
                        id_entidad,
                        id_documento,
                        tipo_alerta,
                        mensaje,
                        fecha_generacion
                    ) VALUES (?, ?, ?, ?, ?, NOW())
                `, [
                    'persona',
                    id_persona,
                    result.insertId,
                    'documento_por_vencer',
                    `Documento ${tipo_documento_nombre} N°${numero_documento} de ${persona[0].nombre_completo} vence en ${diffDays} dias`
                ]);
            }

            await conn.commit();

            res.redirect('/documentos-persona?success=Documento registrado exitosamente');

        } catch (err) {
            if (conn) await conn.rollback();
            logError('AGREGAR DOCUMENTO', err);
            res.redirect(`/documentos-persona?error=${encodeURIComponent(err.message || 'Error al guardar el documento')}`);
        } finally {
            if (conn) conn.release();
        }
    },

    // ============ API: OBTENER PERSONAS ============
    apiPersonas: async (req, res) => {
        try {
            const idCliente = req.session?.usuario?.id_cliente || 1;

            const [personas] = await db.execute(`
                SELECT 
                    id_persona,
                    run,
                    dv,
                    CONCAT(run, '-', dv) as cedula,
                    nombres,
                    apellido_paterno,
                    apellido_materno,
                    CONCAT(nombres, ' ', apellido_paterno) as nombre_completo,
                    email,
                    telefono,
                    cargo,
                    activo,
                    CASE WHEN activo = 1 THEN 'activo' ELSE 'inactivo' END as estado
                FROM personas 
                WHERE id_cliente = ? AND activo = 1
                ORDER BY apellido_paterno ASC, nombres ASC
            `, [idCliente]);

            res.json({
                success: true,
                personas: personas
            });

        } catch (err) {
            logError('API PERSONAS', err);
            res.status(500).json({
                success: false,
                error: 'Error al cargar personas: ' + err.message
            });
        }
    },

    // ============ API: OBTENER DOCUMENTOS ============
    apiDocumentos: async (req, res) => {
        try {
            const idCliente = req.session?.usuario?.id_cliente || 1;

            const [documentos] = await db.execute(`
                SELECT 
                    dp.id_documento,
                    dp.id_persona,
                    dp.id_tipo_documento,
                    dp.numero_documento,
                    dp.fecha_emision,
                    dp.fecha_vencimiento,
                    dp.nombre_archivo,
                    dp.ruta_archivo,
                    dp.observaciones,
                    dp.fecha_subida,
                    dp.estado,
                    CONCAT(p.nombres, ' ', p.apellido_paterno) as persona_nombre_completo,
                    CONCAT(p.run, '-', p.dv) as persona_dni,
                    p.run as persona_run,
                    p.dv as persona_dv,
                    p.cargo,
                    p.email as persona_email,
                    p.telefono as persona_telefono,
                    td.nombre_documento as tipo_documento_nombre,
                    u.nombre_completo as usuario_subida_nombre,
                    DATEDIFF(dp.fecha_vencimiento, CURDATE()) as dias_restantes
                FROM documentos_persona dp
                INNER JOIN personas p ON dp.id_persona = p.id_persona
                LEFT JOIN tipo_documentos_persona td ON dp.id_tipo_documento = td.id_tipo_documento
                LEFT JOIN usuarios u ON dp.usuario_subida = u.id_usuario
                WHERE p.id_cliente = ? AND p.activo = 1
                ORDER BY dp.fecha_vencimiento ASC, dp.fecha_subida DESC
            `, [idCliente]);

            res.json({
                success: true,
                documentos: documentos
            });

        } catch (err) {
            logError('API DOCUMENTOS', err);
            res.status(500).json({
                success: false,
                error: 'Error al cargar documentos: ' + err.message
            });
        }
    },

    // ============ API: OBTENER ESTADISTICAS ============
    apiEstadisticas: async (req, res) => {
        try {
            const idCliente = req.session?.usuario?.id_cliente || 1;

            const [documentos] = await db.execute(`
                SELECT 
                    fecha_vencimiento
                FROM documentos_persona dp
                INNER JOIN personas p ON dp.id_persona = p.id_persona
                WHERE p.id_cliente = ? AND p.activo = 1
            `, [idCliente]);

            const hoy = new Date();
            let documentosVigentes = 0;
            let documentosPorVencer = 0;
            let documentosVencidos = 0;

            documentos.forEach(doc => {
                const vencimiento = new Date(doc.fecha_vencimiento);
                const diffDays = Math.ceil((vencimiento - hoy) / (1000 * 60 * 60 * 24));

                if (diffDays > 30) {
                    documentosVigentes++;
                } else if (diffDays > 0) {
                    documentosPorVencer++;
                } else {
                    documentosVencidos++;
                }
            });

            res.json({
                success: true,
                totalDocumentos: documentos.length,
                documentosVigentes: documentosVigentes,
                documentosPorVencer: documentosPorVencer,
                documentosVencidos: documentosVencidos
            });

        } catch (err) {
            logError('API ESTADISTICAS', err);
            res.status(500).json({
                success: false,
                error: 'Error al cargar estadisticas: ' + err.message
            });
        }
    },

    // ============ BUSCAR PERSONA POR RUN ============
    buscarPersonaPorRun: async (req, res) => {
        try {
            const { run } = req.params;
            const idCliente = req.session?.usuario?.id_cliente || 1;

            const [personas] = await db.execute(`
                SELECT 
                    id_persona,
                    run,
                    dv,
                    CONCAT(run, '-', dv) as cedula,
                    nombres,
                    apellido_paterno,
                    apellido_materno,
                    CONCAT(nombres, ' ', apellido_paterno) as nombre_completo,
                    email,
                    telefono,
                    cargo,
                    activo
                FROM personas 
                WHERE run = ? AND id_cliente = ? AND activo = 1
            `, [run, idCliente]);

            if (personas.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Persona no encontrada'
                });
            }

            res.json({
                success: true,
                persona: personas[0]
            });

        } catch (err) {
            logError('BUSCAR PERSONA POR RUN', err);
            res.status(500).json({
                success: false,
                error: 'Error al buscar persona: ' + err.message
            });
        }
    },

    // ============ ELIMINAR DOCUMENTO ============
    eliminarDocumento: async (req, res) => {
        let conn;
        try {
            const { id } = req.params;

            conn = await db.pool.promise().getConnection();
            await conn.beginTransaction();

            // Obtener informacion del documento
            const [documento] = await conn.execute(
                'SELECT ruta_archivo FROM documentos_persona WHERE id_documento = ?',
                [id]
            );

            if (documento.length === 0) {
                throw new Error('Documento no encontrado');
            }

            // Eliminar archivo fisico si existe
            if (documento[0].ruta_archivo) {
                const filePath = path.join(__dirname, '../public', documento[0].ruta_archivo);
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                    console.log('Archivo eliminado:', filePath);
                }
            }

            // Eliminar alertas relacionadas
            await conn.execute('DELETE FROM alertas WHERE id_documento = ?', [id]);

            // Eliminar documento
            const [result] = await conn.execute('DELETE FROM documentos_persona WHERE id_documento = ?', [id]);

            if (result.affectedRows === 0) {
                throw new Error('No se pudo eliminar el documento');
            }

            await conn.commit();

            res.json({
                success: true,
                message: 'Documento eliminado exitosamente'
            });

        } catch (err) {
            if (conn) await conn.rollback();
            logError('ELIMINAR DOCUMENTO', err);
            res.status(500).json({
                success: false,
                error: err.message || 'Error al eliminar documento'
            });
        } finally {
            if (conn) conn.release();
        }
    },

    // ============ VER DETALLE ============
    verDetalle: async (req, res) => {
        try {
            const { id } = req.params;
            const idCliente = req.session?.usuario?.id_cliente || 1;

            const [documento] = await db.execute(`
                SELECT 
                    dp.*,
                    CONCAT(p.nombres, ' ', p.apellido_paterno) as persona_nombre_completo,
                    CONCAT(p.run, '-', p.dv) as persona_dni,
                    p.run as persona_run,
                    p.dv as persona_dv,
                    p.email as persona_email,
                    p.telefono as persona_telefono,
                    p.cargo as persona_cargo,
                    td.nombre_documento as tipo_documento_nombre,
                    td.descripcion as tipo_documento_descripcion,
                    td.dias_alerta,
                    u.nombre_completo as usuario_subida_nombre,
                    DATEDIFF(dp.fecha_vencimiento, CURDATE()) as dias_restantes
                FROM documentos_persona dp
                INNER JOIN personas p ON dp.id_persona = p.id_persona
                LEFT JOIN tipo_documentos_persona td ON dp.id_tipo_documento = td.id_tipo_documento
                LEFT JOIN usuarios u ON dp.usuario_subida = u.id_usuario
                WHERE dp.id_documento = ? AND p.id_cliente = ?
            `, [id, idCliente]);

            if (documento.length === 0) {
                return res.redirect('/documentos-persona?error=Documento no encontrado');
            }

            res.render('documentoPersonaDetalle', {
                title: 'Detalle del Documento',
                layout: 'layouts/main',
                documento: documento[0]
            });

        } catch (err) {
            logError('VER DETALLE', err);
            res.redirect('/documentos-persona?error=Error al cargar el detalle');
        }
    },

    // ============ DESCARGAR ARCHIVO ============
    descargarArchivo: async (req, res) => {
        try {
            const { id } = req.params;
            const idCliente = req.session?.usuario?.id_cliente || 1;

            const [documento] = await db.execute(`
                SELECT dp.*, p.id_cliente 
                FROM documentos_persona dp
                INNER JOIN personas p ON dp.id_persona = p.id_persona
                WHERE dp.id_documento = ? AND p.id_cliente = ?
            `, [id, idCliente]);

            if (documento.length === 0 || !documento[0].ruta_archivo) {
                return res.redirect('/documentos-persona?error=Documento no encontrado');
            }

            const filePath = path.join(__dirname, '../public', documento[0].ruta_archivo);

            if (!fs.existsSync(filePath)) {
                return res.redirect('/documentos-persona?error=El archivo no existe');
            }

            res.download(filePath, documento[0].nombre_archivo || 'documento.pdf');

        } catch (err) {
            logError('DESCARGAR ARCHIVO', err);
            res.redirect('/documentos-persona?error=Error al descargar');
        }
    }
};

module.exports = documentoPersonaController;