require('dotenv').config();
const db = require('../conexion');

const logError = (tag, err) => console.error(` ${tag}`, err.message || err);

const documentosPersonaController = {

    
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
                db.query(`
                    SELECT COUNT(*) AS total
                    FROM documentos_persona dp
                    INNER JOIN personas p ON dp.id_persona = p.id_persona
                    WHERE p.id_cliente = ?
                `, [idCliente]),

                db.query(`
                    SELECT COUNT(*) AS total
                    FROM documentos_persona dp
                    INNER JOIN personas p ON dp.id_persona = p.id_persona
                    WHERE p.id_cliente = ?
                    AND dp.fecha_vencimiento > CURDATE()
                `, [idCliente]),

                db.query(`
                    SELECT COUNT(*) AS total
                    FROM documentos_persona dp
                    INNER JOIN personas p ON dp.id_persona = p.id_persona
                    WHERE p.id_cliente = ?
                    AND dp.fecha_vencimiento BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 30 DAY)
                `, [idCliente]),

                db.query(`
                    SELECT COUNT(*) AS total
                    FROM documentos_persona dp
                    INNER JOIN personas p ON dp.id_persona = p.id_persona
                    WHERE p.id_cliente = ?
                    AND dp.fecha_vencimiento < CURDATE()
                `, [idCliente]),

                db.query(`
                    SELECT 
                        dp.id_documento_persona,
                        dp.numero_documento,
                        dp.fecha_emision,
                        dp.fecha_vencimiento,
                        dp.nombre_archivo,
                        dp.observaciones,

                        CONCAT(p.apellido_paterno,' ',p.apellido_materno,', ',p.nombres) AS persona_nombre_completo,
                        CONCAT(p.run,'-',p.dv) AS persona_dni,
                        p.cargo,

                        tdp.nombre_documento AS tipo_documento_nombre
                    FROM documentos_persona dp
                    INNER JOIN personas p ON dp.id_persona = p.id_persona
                    LEFT JOIN tipo_documentos_persona tdp 
                        ON dp.id_tipo_documento = tdp.id_tipo_documento
                    WHERE p.id_cliente = ?
                    ORDER BY dp.fecha_vencimiento ASC
                `, [idCliente]),

                db.query(`
                    SELECT 
                        id_persona,
                        CONCAT(apellido_paterno,' ',apellido_materno,', ',nombres) AS nombre_completo,
                        CONCAT(run,'-',dv) AS run_completo,
                        cargo
                    FROM personas
                    WHERE id_cliente = ?
                    AND activo = 1
                    ORDER BY apellido_paterno, nombres
                `, [idCliente])
            ]);

            // Normalizar datos
            const documentos = documentosRes?.[0] || [];
            const personas = personasRes?.[0] || [];

            const totalDocumentos = totalDocsRes?.[0]?.[0]?.total || 0;
            const documentosVigentes = vigentesRes?.[0]?.[0]?.total || 0;
            const documentosPorVencer = porVencerRes?.[0]?.[0]?.total || 0;
            const documentosVencidos = vencidosRes?.[0]?.[0]?.total || 0;

            res.render('documentos-persona/index', {
                title: 'Gestión Documental - Personas',

                documentos,
                personas,

                totalDocumentos,
                documentosVigentes,
                documentosPorVencer,
                documentosVencidos,

                fecha: new Date(),
                success_msg: req.flash?.('success') || null,
                error_msg: req.flash?.('error') || null
            });

        } catch (error) {
            logError('INDEX DOCUMENTOS PERSONA', error);

            res.render('documentos-persona/index', {
                title: 'Gestión Documental - Personas',
                documentos: [],
                personas: [],
                totalDocumentos: 0,
                documentosVigentes: 0,
                documentosPorVencer: 0,
                documentosVencidos: 0,
                fecha: new Date(),
                error_msg: 'Error al cargar la página'
            });
        }
    },

    // ===============================
    // REGISTRAR DOCUMENTO
    // ===============================
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

            if (!id_persona || !tipo_documento_nombre || !numero_documento || !fecha_vencimiento) {
                req.flash('error', 'Todos los campos obligatorios deben completarse');
                return res.redirect('/documentos-persona');
            }

            // Verificar persona
            const [[persona]] = await db.query(`
                SELECT id_persona
                FROM personas
                WHERE id_persona = ?
                AND id_cliente = ?
            `, [id_persona, idCliente]);

            if (!persona) {
                req.flash('error', 'La persona no pertenece al cliente');
                return res.redirect('/documentos-persona');
            }

            // Buscar tipo documento
            let idTipoDocumento;

            const [[tipoExistente]] = await db.query(`
                SELECT id_tipo_documento
                FROM tipo_documentos_persona
                WHERE id_cliente = ?
                AND nombre_documento = ?
            `, [idCliente, tipo_documento_nombre]);

            if (tipoExistente) {
                idTipoDocumento = tipoExistente.id_tipo_documento;
            } else {
                const [nuevoTipo] = await db.query(`
                    INSERT INTO tipo_documentos_persona
                    (id_cliente, nombre_documento, dias_alerta, activo)
                    VALUES (?, ?, 30, 1)
                `, [idCliente, tipo_documento_nombre]);

                idTipoDocumento = nuevoTipo.insertId;
            }

            let nombreArchivo = null;
            let rutaArchivo = null;

            if (req.file) {
                nombreArchivo = req.file.originalname;
                rutaArchivo = req.file.buffer;
            }

            await db.query(`
                INSERT INTO documentos_persona
                (id_persona,id_tipo_documento,nombre_archivo,ruta_archivo,
                 numero_documento,fecha_emision,fecha_vencimiento,
                 observaciones,usuario_subida)
                VALUES (?,?,?,?,?,?,?,?,?)
            `, [
                id_persona,
                idTipoDocumento,
                nombreArchivo,
                rutaArchivo,
                numero_documento,
                fecha_emision || null,
                fecha_vencimiento,
                observaciones || null,
                idUsuario
            ]);

            req.flash('success', 'Documento registrado correctamente');
            res.redirect('/documentos-persona');

        } catch (error) {
            logError('REGISTRAR DOCUMENTO PERSONA', error);
            req.flash('error', 'Error al registrar documento');
            res.redirect('/documentos-persona');
        }
    },

    // ===============================
    // API PERSONAS
    // ===============================
    async getPersonas(req, res) {
        try {
            const idCliente = req.session?.idCliente || 1;

            const [personas] = await db.query(`
                SELECT 
                    id_persona,
                    CONCAT(apellido_paterno,' ',apellido_materno,', ',nombres) AS nombre_completo,
                    CONCAT(run,'-',dv) AS run_completo,
                    cargo
                FROM personas
                WHERE id_cliente = ?
                AND activo = 1
                ORDER BY apellido_paterno, nombres
            `, [idCliente]);

            res.json({
                success: true,
                total: personas.length,
                personas: personas || []
            });

        } catch (error) {
            logError('API PERSONAS', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }
};

module.exports = documentosPersonaController;
