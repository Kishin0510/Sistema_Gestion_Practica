require('dotenv').config();
const db = require('../conexion');
const fs = require('fs');
const path = require('path');

const logError = (tag, err) =>
    console.error(`Error en ${tag}:`, err.message || err);

const documentoPersonaController = {

    // ===============================
    // VISTA PRINCIPAL
    // ===============================
    mostrarDocumentos: async (req, res) => {
        try {
            const idCliente = req.session?.usuario?.id_cliente || 1;

            const [personas] = await db.execute(`
                SELECT 
                    id_persona,
                    CONCAT(run,'-',dv) as dni,
                    CONCAT(nombres,' ',apellido_paterno) as nombre_completo,
                    cargo,
                    email,
                    telefono
                FROM personas
                WHERE id_cliente = ? AND activo = 1
                ORDER BY apellido_paterno ASC
            `, [idCliente]);

            const [tipos] = await db.execute(`
                SELECT id_tipo_documento, nombre_documento
                FROM tipo_documentos_persona
                WHERE id_cliente = ? AND activo = 1
                ORDER BY nombre_documento ASC
            `, [idCliente]);

            const [documentos] = await db.execute(`
                SELECT 
                    dp.*,
                    CONCAT(p.nombres,' ',p.apellido_paterno) as persona_nombre,
                    CONCAT(p.run,'-',p.dv) as persona_dni,
                    td.nombre_documento,
                    DATEDIFF(dp.fecha_vencimiento, CURDATE()) as dias_restantes
                FROM documentos_persona dp
                INNER JOIN personas p ON dp.id_persona = p.id_persona
                LEFT JOIN tipo_documentos_persona td ON dp.id_tipo_documento = td.id_tipo_documento
                WHERE p.id_cliente = ?
                ORDER BY dp.fecha_vencimiento ASC
            `, [idCliente]);

            res.render('DocumentosPersonas', {
                title: 'Gestión Documental - Personas',
                layout: 'layouts/main',
                personas,
                tiposDocumentos: tipos,
                documentos,
                success_msg: req.query.success || null,
                error_msg: req.query.error || null
            });

        } catch (err) {
            logError('MOSTRAR DOCUMENTOS PERSONA', err);
            res.redirect('/documentos-persona?error=Error al cargar datos');
        }
    },

    // ===============================
    // REGISTRAR DOCUMENTO
    // ===============================
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
                observaciones
            } = req.body;

            if (!id_persona || !tipo_documento_nombre || !fecha_vencimiento) {
                throw new Error('Faltan campos obligatorios');
            }

            const [persona] = await conn.execute(
                'SELECT id_cliente FROM personas WHERE id_persona = ? AND activo = 1',
                [id_persona]
            );

            if (!persona.length) {
                throw new Error('Persona no encontrada');
            }

            const id_cliente = persona[0].id_cliente;

            // Buscar o crear tipo
            let id_tipo_documento;

            const [tipo] = await conn.execute(`
                SELECT id_tipo_documento 
                FROM tipo_documentos_persona
                WHERE nombre_documento = ? AND id_cliente = ? AND activo = 1
            `, [tipo_documento_nombre.trim(), id_cliente]);

            if (tipo.length) {
                id_tipo_documento = tipo[0].id_tipo_documento;
            } else {
                const [nuevo] = await conn.execute(`
                    INSERT INTO tipo_documentos_persona
                    (id_cliente, nombre_documento, activo)
                    VALUES (?, ?, 1)
                `, [id_cliente, tipo_documento_nombre.trim()]);
                id_tipo_documento = nuevo.insertId;
            }

            let nombre_archivo = null;
            let ruta_archivo = null;

            if (req.file) {
                nombre_archivo = req.file.filename;
                ruta_archivo = `/uploads/documentos_persona/${req.file.filename}`;
            }

            await conn.execute(`
                INSERT INTO documentos_persona (
                    id_persona,
                    id_tipo_documento,
                    numero_documento,
                    fecha_emision,
                    fecha_vencimiento,
                    nombre_archivo,
                    ruta_archivo,
                    observaciones,
                    usuario_subida,
                    fecha_subida,
                    estado
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), 'vigente')
            `, [
                id_persona,
                id_tipo_documento,
                numero_documento || null,
                fecha_emision || null,
                fecha_vencimiento,
                nombre_archivo,
                ruta_archivo,
                observaciones || null,
                req.session?.usuario?.id_usuario || null
            ]);

            await conn.commit();

            res.redirect('/documentos-persona?success=Documento registrado');

        } catch (err) {
            if (conn) await conn.rollback();
            logError('AGREGAR DOCUMENTO PERSONA', err);
            res.redirect('/documentos-persona?error=' + encodeURIComponent(err.message));
        } finally {
            if (conn) conn.release();
        }
    },

    // ===============================
    // ELIMINAR
    // ===============================
    eliminarDocumento: async (req, res) => {
        try {
            const { id } = req.params;

            const [doc] = await db.execute(
                'SELECT ruta_archivo FROM documentos_persona WHERE id_documento = ?',
                [id]
            );

            if (!doc.length) {
                return res.json({ success: false });
            }

            if (doc[0].ruta_archivo) {
                const filePath = path.join(__dirname, '../../public', doc[0].ruta_archivo);
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                }
            }

            await db.execute('DELETE FROM documentos_persona WHERE id_documento = ?', [id]);

            res.json({ success: true });

        } catch (err) {
            logError('ELIMINAR DOCUMENTO PERSONA', err);
            res.status(500).json({ success: false });
        }
    },

    // ===============================
    // DESCARGAR
    // ===============================
    descargarArchivo: async (req, res) => {
        try {
            const { id } = req.params;

            const [doc] = await db.execute(
                'SELECT nombre_archivo, ruta_archivo FROM documentos_persona WHERE id_documento = ?',
                [id]
            );

            if (!doc.length || !doc[0].ruta_archivo) {
                return res.redirect('/documentos-persona?error=Archivo no encontrado');
            }

            const filePath = path.join(__dirname, '../../public', doc[0].ruta_archivo);

            if (!fs.existsSync(filePath)) {
                return res.redirect('/documentos-persona?error=Archivo no existe');
            }

            res.download(filePath, doc[0].nombre_archivo);

        } catch (err) {
            logError('DESCARGAR DOCUMENTO PERSONA', err);
            res.redirect('/documentos-persona?error=Error al descargar');
        }
    }
};

module.exports = documentoPersonaController;
