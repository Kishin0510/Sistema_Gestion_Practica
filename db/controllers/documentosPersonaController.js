require('dotenv').config();
const db = require('../conexion');

const logError = (tag, err) => console.error(` ${tag}`, err.message || err);

const documentosPersonaController = {

   //MÉTODO PAGINA PRINCIPAL
    async index(req, res) {
        try {
            const idCliente = req.session?.idCliente || 1;

            console.log('Cliente cargado:', idCliente);

            const [
                totalDocsRes,
                vigentesRes,
                porVencerRes,
                vencidosRes,
                documentosRes,
                personasRes
            ] = await Promise.all([
                // Total documentos
                db.query(`
                    SELECT COUNT(*) AS total
                    FROM documentos_persona dp
                    INNER JOIN personas p ON dp.id_persona = p.id_persona
                    WHERE p.id_cliente = ?
                `, [idCliente]),

                // Documentos vigentes
                db.query(`
                    SELECT COUNT(*) AS total
                    FROM documentos_persona dp
                    INNER JOIN personas p ON dp.id_persona = p.id_persona
                    WHERE p.id_cliente = ?
                    AND dp.fecha_vencimiento > CURDATE()
                `, [idCliente]),

                // Documentos por vencer (30 días)
                db.query(`
                    SELECT COUNT(*) AS total
                    FROM documentos_persona dp
                    INNER JOIN personas p ON dp.id_persona = p.id_persona
                    WHERE p.id_cliente = ?
                    AND dp.fecha_vencimiento BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 30 DAY)
                `, [idCliente]),

                // Documentos vencidos
                db.query(`
                    SELECT COUNT(*) AS total
                    FROM documentos_persona dp
                    INNER JOIN personas p ON dp.id_persona = p.id_persona
                    WHERE p.id_cliente = ?
                    AND dp.fecha_vencimiento < CURDATE()
                `, [idCliente]),

                // Documentos con todos los detalles
                db.query(`
                    SELECT 
                        dp.id_documento AS id_documento_persona,
                        dp.numero_documento,
                        dp.fecha_emision,
                        dp.fecha_vencimiento,
                        dp.nombre_archivo,
                        dp.observaciones,
                        dp.estado,
                        p.id_persona,
                        p.nombres,
                        p.apellido_paterno,
                        p.apellido_materno,
                        p.run,
                        p.dv,
                        p.cargo,
                        CONCAT(p.apellido_paterno,' ',p.apellido_materno,', ',p.nombres) AS persona_nombre_completo,
                        CONCAT(p.run,'-',p.dv) AS persona_dni,
                        tdp.nombre_documento AS tipo_documento_nombre,
                        tdp.id_tipo_documento
                    FROM documentos_persona dp
                    INNER JOIN personas p ON dp.id_persona = p.id_persona
                    LEFT JOIN tipo_documentos_persona tdp 
                        ON dp.id_tipo_documento = tdp.id_tipo_documento
                    WHERE p.id_cliente = ?
                    ORDER BY dp.fecha_vencimiento ASC
                `, [idCliente]),

                // Personas activas para el modal
                db.query(`
                    SELECT 
                        id_persona,
                        nombres,
                        apellido_paterno,
                        apellido_materno,
                        run,
                        dv,
                        CONCAT(apellido_paterno,' ',apellido_materno,', ',nombres) AS nombre_completo,
                        CONCAT(run,'-',dv) AS run_completo,
                        cargo,
                        email,
                        telefono
                    FROM personas
                    WHERE id_cliente = ?
                    AND activo = 1
                    ORDER BY apellido_paterno, nombres
                `, [idCliente])
            ]);

            // Normalizar datos
            const documentos = documentosRes?.[0] || [];
            const personas = personasRes?.[0] || [];

            // Debug - para verificar datos
            console.log('Documentos encontrados:', documentos.length);
            console.log('Personas activas:', personas.length);
            if (documentos.length > 0) {
                console.log('Ejemplo documento:', {
                    id: documentos[0].id_documento_persona,
                    persona: documentos[0].persona_nombre_completo
                });
            }

            const totalDocumentos = totalDocsRes?.[0]?.[0]?.total || 0;
            const documentosVigentes = vigentesRes?.[0]?.[0]?.total || 0;
            const documentosPorVencer = porVencerRes?.[0]?.[0]?.total || 0;
            const documentosVencidos = vencidosRes?.[0]?.[0]?.total || 0;

            res.render('documentos-persona/index', {
                title: 'Gestión Documental - Personas',
                documentos: documentos,
                personas: personas,
                totalDocumentos: totalDocumentos,
                documentosVigentes: documentosVigentes,
                documentosPorVencer: documentosPorVencer,
                documentosVencidos: documentosVencidos,
                fecha: new Date(),
                success_msg: req.flash?.('success') || null,
                error_msg: req.flash?.('error') || null
            });

        } catch (error) {
            logError('INDEX DOCUMENTOS PERSONA', error);
            console.error('Error detallado:', error);

            res.render('documentos-persona/index', {
                title: 'Gestión Documental - Personas',
                documentos: [],
                personas: [],
                totalDocumentos: 0,
                documentosVigentes: 0,
                documentosPorVencer: 0,
                documentosVencidos: 0,
                fecha: new Date(),
                error_msg: 'Error al cargar la página: ' + error.message
            });
        }
    },

    //REGISTRAR DOCUMENTO A LA BD
    async registrar(req, res) {
        try {
            const {
                id_persona,
                tipo_documento_nombre,
                numero_documento,
                fecha_emision,
                fecha_vencimiento,
                observaciones
            } = req.body;

            const idUsuario = req.session?.idUsuario || 1;
            const idCliente = req.session?.idCliente || 1;

            console.log('Registrando documento:', {
                id_persona,
                tipo_documento_nombre,
                numero_documento,
                fecha_vencimiento
            });

            // Validaciones
            if (!id_persona || !tipo_documento_nombre || !numero_documento || !fecha_vencimiento) {
                req.flash('error', 'Todos los campos obligatorios deben completarse');
                return res.redirect('/documentos-persona');
            }

            // Verificar que la persona existe y pertenece al cliente
            const [personaResult] = await db.query(`
                SELECT id_persona
                FROM personas
                WHERE id_persona = ?
                AND id_cliente = ?
                AND activo = 1
            `, [id_persona, idCliente]);

            if (!personaResult[0] || personaResult[0].length === 0) {
                req.flash('error', 'La persona no existe o no pertenece al cliente');
                return res.redirect('/documentos-persona');
            }

            // Buscar o crear tipo de documento
            let idTipoDocumento;

            const [tipoExistente] = await db.query(`
                SELECT id_tipo_documento
                FROM tipo_documentos_persona
                WHERE id_cliente = ?
                AND nombre_documento = ?
            `, [idCliente, tipo_documento_nombre.trim()]);

            if (tipoExistente[0] && tipoExistente[0].length > 0) {
                idTipoDocumento = tipoExistente[0][0].id_tipo_documento;
            } else {
                const [nuevoTipo] = await db.query(`
                    INSERT INTO tipo_documentos_persona
                    (id_cliente, nombre_documento, dias_alerta, activo)
                    VALUES (?, ?, 30, 1)
                `, [idCliente, tipo_documento_nombre.trim()]);

                idTipoDocumento = nuevoTipo.insertId;
            }

            // Procesar archivo si existe
            let nombreArchivo = null;
            let rutaArchivo = null;

            if (req.file) {
                nombreArchivo = req.file.originalname;
                rutaArchivo = req.file.buffer;
            }

            // Calcular estado automáticamente
            const hoy = new Date();
            const venc = new Date(fecha_vencimiento);
            let estado = 'vigente';

            if (venc < hoy) {
                estado = 'vencido';
            } else {
                const diffTime = venc - hoy;
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                if (diffDays <= 30) {
                    estado = 'por_vencer';
                }
            }

            // Insertar documento
            await db.query(`
                INSERT INTO documentos_persona
                (id_persona, id_tipo_documento, nombre_archivo, ruta_archivo,
                 numero_documento, fecha_emision, fecha_vencimiento,
                 observaciones, usuario_subida, estado)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                id_persona,
                idTipoDocumento,
                nombreArchivo,
                rutaArchivo,
                numero_documento,
                fecha_emision || null,
                fecha_vencimiento,
                observaciones || null,
                idUsuario,
                estado
            ]);

            req.flash('success', 'Documento registrado correctamente');
            res.redirect('/documentos-persona');

        } catch (error) {
            logError('REGISTRAR DOCUMENTO PERSONA', error);
            req.flash('error', 'Error al registrar documento: ' + error.message);
            res.redirect('/documentos-persona');
        }
    },

    //API OBTENER PERSONAS AGREGADAS
    async getPersonas(req, res) {
        try {
            const idCliente = req.session?.idCliente || 1;

            const [personas] = await db.query(`
                SELECT 
                    id_persona,
                    nombres,
                    apellido_paterno,
                    apellido_materno,
                    run,
                    dv,
                    CONCAT(apellido_paterno,' ',apellido_materno,', ',nombres) AS nombre_completo,
                    CONCAT(run,'-',dv) AS run_completo,
                    cargo,
                    email,
                    telefono
                FROM personas
                WHERE id_cliente = ?
                AND activo = 1
                ORDER BY apellido_paterno, nombres
            `, [idCliente]);

            console.log(`API Personas: ${personas[0]?.length || 0} personas encontradas`);

            res.json({
                success: true,
                total: personas[0]?.length || 0,
                personas: personas[0] || []
            });

        } catch (error) {
            logError('API PERSONAS', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    },

    //REVISAR DOCUMENTO
    async verDocumento(req, res) {
        try {
            const id = req.params.id;
            const idCliente = req.session?.idCliente || 1;

            const [documentoResult] = await db.query(`
                SELECT dp.ruta_archivo, dp.nombre_archivo, dp.id_documento
                FROM documentos_persona dp
                INNER JOIN personas p ON dp.id_persona = p.id_persona
                WHERE dp.id_documento = ? AND p.id_cliente = ?
            `, [id, idCliente]);

            const documento = documentoResult[0]?.[0];

            if (!documento || !documento.ruta_archivo) {
                return res.status(404).send('Documento no encontrado');
            }

            // Determinar tipo de contenido según extensión
            let contentType = 'application/octet-stream';
            const ext = documento.nombre_archivo?.split('.').pop().toLowerCase();

            if (ext === 'pdf') contentType = 'application/pdf';
            else if (ext === 'jpg' || ext === 'jpeg') contentType = 'image/jpeg';
            else if (ext === 'png') contentType = 'image/png';

            res.setHeader('Content-Type', contentType);
            res.setHeader('Content-Disposition', `inline; filename="${documento.nombre_archivo}"`);
            res.send(documento.ruta_archivo);

        } catch (error) {
            logError('VER DOCUMENTO', error);
            res.status(500).send('Error al cargar el documento');
        }
    },

    //ELIMINAR
    async eliminar(req, res) {
        try {
            const id = req.params.id;
            const idCliente = req.session?.idCliente || 1;

            // Verificar que el documento pertenece al cliente
            const [documentoResult] = await db.query(`
                SELECT dp.id_documento
                FROM documentos_persona dp
                INNER JOIN personas p ON dp.id_persona = p.id_persona
                WHERE dp.id_documento = ? AND p.id_cliente = ?
            `, [id, idCliente]);

            if (!documentoResult[0] || documentoResult[0].length === 0) {
                return res.status(404).json({
                    success: false,
                    error: 'Documento no encontrado o no autorizado'
                });
            }

            await db.query(`
                DELETE FROM documentos_persona
                WHERE id_documento = ?
            `, [id]);

            res.json({
                success: true,
                message: 'Documento eliminado correctamente'
            });

        } catch (error) {
            logError('ELIMINAR DOCUMENTO', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    },

    //DETALLE DOC
    async detalle(req, res) {
        try {
            const id = req.params.id;
            const idCliente = req.session?.idCliente || 1;

            const [documentoResult] = await db.query(`
                SELECT 
                    dp.id_documento AS id_documento_persona,
                    dp.numero_documento,
                    dp.fecha_emision,
                    dp.fecha_vencimiento,
                    dp.nombre_archivo,
                    dp.observaciones,
                    dp.estado,
                    dp.fecha_subida,
                    p.id_persona,
                    p.nombres,
                    p.apellido_paterno,
                    p.apellido_materno,
                    CONCAT(p.apellido_paterno,' ',p.apellido_materno,', ',p.nombres) AS persona_nombre_completo,
                    CONCAT(p.run,'-',p.dv) AS persona_dni,
                    p.cargo,
                    p.email,
                    p.telefono,
                    tdp.nombre_documento AS tipo_documento_nombre,
                    u.nombre_completo AS usuario_subida_nombre
                FROM documentos_persona dp
                INNER JOIN personas p ON dp.id_persona = p.id_persona
                LEFT JOIN tipo_documentos_persona tdp ON dp.id_tipo_documento = tdp.id_tipo_documento
                LEFT JOIN usuarios u ON dp.usuario_subida = u.id_usuario
                WHERE dp.id_documento = ? AND p.id_cliente = ?
            `, [id, idCliente]);

            const documento = documentoResult[0]?.[0];

            if (!documento) {
                req.flash('error', 'Documento no encontrado');
                return res.redirect('/documentos-persona');
            }

            // Calcular días restantes
            const hoy = new Date();
            const venc = new Date(documento.fecha_vencimiento);
            const diffTime = venc - hoy;
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            res.render('documentos-persona/detalle', {
                title: 'Detalle del Documento',
                documento: documento,
                diasRestantes: diffDays,
                success_msg: req.flash?.('success') || null,
                error_msg: req.flash?.('error') || null
            });

        } catch (error) {
            logError('DETALLE DOCUMENTO', error);
            req.flash('error', 'Error al cargar el detalle');
            res.redirect('/documentos-persona');
        }
    },

    //ACTUALIZAR
    async actualizar(req, res) {
        try {
            const id = req.params.id;
            const {
                numero_documento,
                fecha_emision,
                fecha_vencimiento,
                observaciones
            } = req.body;

            const idCliente = req.session?.idCliente || 1;

            // Verificar que el documento pertenece al cliente
            const [documentoResult] = await db.query(`
                SELECT dp.id_documento
                FROM documentos_persona dp
                INNER JOIN personas p ON dp.id_persona = p.id_persona
                WHERE dp.id_documento = ? AND p.id_cliente = ?
            `, [id, idCliente]);

            if (!documentoResult[0] || documentoResult[0].length === 0) {
                req.flash('error', 'Documento no encontrado o no autorizado');
                return res.redirect('/documentos-persona');
            }

            // Recalcular estado
            const hoy = new Date();
            const venc = new Date(fecha_vencimiento);
            let estado = 'vigente';

            if (venc < hoy) {
                estado = 'vencido';
            } else {
                const diffTime = venc - hoy;
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                if (diffDays <= 30) {
                    estado = 'por_vencer';
                }
            }

            await db.query(`
                UPDATE documentos_persona
                SET numero_documento = ?,
                    fecha_emision = ?,
                    fecha_vencimiento = ?,
                    observaciones = ?,
                    estado = ?,
                    fecha_actualizacion = CURRENT_TIMESTAMP
                WHERE id_documento = ?
            `, [numero_documento, fecha_emision || null, fecha_vencimiento, observaciones || null, estado, id]);

            req.flash('success', 'Documento actualizado correctamente');
            res.redirect('/documentos-persona/detalle/' + id);

        } catch (error) {
            logError('ACTUALIZAR DOCUMENTO', error);
            req.flash('error', 'Error al actualizar documento');
            res.redirect('/documentos-persona');
        }
    }
};

module.exports = documentosPersonaController;