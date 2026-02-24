require('dotenv').config();
const db = require('../conexion');
const fs = require('fs');
const path = require('path');

const logError = (tag, err) => console.error(` [ERROR ${tag}]`, err.message || err);

const documentosPersonaController = {

    // 1. Mostrar vista principal y cargar datos del modal
    mostrarDocumentos: async (req, res) => {
        try {
            const idCliente = req.session?.idCliente || 1;

            // OBTENER PERSONAS: Mejorado para que no falle con NULLs y cargue el modal
            const [personas] = await db.execute(`
                SELECT 
                    id_persona, run, dv, cargo,
                    TRIM(CONCAT_WS(' ', nombres, apellido_paterno, COALESCE(apellido_materno, ''))) AS nombre_completo,
                    CONCAT(run, '-', dv) AS run_completo
                FROM personas 
                WHERE activo = 1 
                ORDER BY nombres ASC
            `);

            // Obtener tipos de documentos existentes para el cliente
            const [tiposDocumentos] = await db.execute(`
                SELECT id_tipo_documento, nombre_documento FROM tipo_documentos_persona 
                WHERE id_cliente = ? AND activo = 1
            `, [idCliente]);

            // Obtener listado de documentos registrados
            const [documentos] = await db.execute(`
                SELECT dp.*, dp.id_documento AS id_documento_persona,
                TRIM(CONCAT_WS(' ', p.nombres, p.apellido_paterno)) AS persona_nombre_completo,
                CONCAT(p.run, '-', p.dv) AS persona_dni,
                tdp.nombre_documento AS tipo_documento_nombre
                FROM documentos_persona dp
                LEFT JOIN personas p ON dp.id_persona = p.id_persona
                LEFT JOIN tipo_documentos_persona tdp ON dp.id_tipo_documento = tdp.id_tipo_documento
                WHERE p.id_cliente = ?
                ORDER BY dp.fecha_vencimiento ASC
            `, [idCliente]);

            // Calcular estados dinámicamente
            const hoy = new Date();
            const documentosConEstado = documentos.map(doc => {
                const venc = new Date(doc.fecha_vencimiento);
                const diffDays = Math.ceil((venc - hoy) / (1000 * 60 * 60 * 24));
                let est = 'vigente';
                if (diffDays <= 0) est = 'vencido';
                else if (diffDays <= 30) est = 'por_vencer';
                return { ...doc, dias_restantes: diffDays, estado_calculado: est };
            });

            res.render('documentos-persona/index', {
                title: 'Gestión Documental - Personas',
                personas: personas, // Variable que usa el modal
                tiposDocumentos: tiposDocumentos,
                documentos: documentosConEstado,
                totalDocumentos: documentos.length,
                documentosVigentes: documentosConEstado.filter(d => d.estado_calculado === 'vigente').length,
                documentosPorVencer: documentosConEstado.filter(d => d.estado_calculado === 'por_vencer').length,
                documentosVencidos: documentosConEstado.filter(d => d.estado_calculado === 'vencido').length
            });
        } catch (err) {
            logError('MOSTRAR', err);
            res.status(500).send("Error al cargar la página: " + err.message);
        }
    },

    // 2. Registrar Documento con Transacción
    agregarDocumento: async (req, res) => {
        let conn;
        try {
            conn = await db.pool.promise().getConnection();
            await conn.beginTransaction();

            const { id_persona, tipo_documento_nombre, numero_documento, fecha_vencimiento, fecha_emision, observaciones, enviar_alerta } = req.body;
            const idCliente = req.session?.idCliente || 1;

            // Buscar o crear tipo de documento dinámicamente
            let id_tipo;
            const [existe] = await conn.execute('SELECT id_tipo_documento FROM tipo_documentos_persona WHERE nombre_documento = ? AND id_cliente = ?', [tipo_documento_nombre, idCliente]);

            if (existe.length > 0) {
                id_tipo = existe[0].id_tipo_documento;
            } else {
                const [nuevo] = await conn.execute('INSERT INTO tipo_documentos_persona (id_cliente, nombre_documento) VALUES (?, ?)', [idCliente, tipo_documento_nombre]);
                id_tipo = nuevo.insertId;
            }

            // Manejo de archivo físico
            let ruta = req.file ? `/uploads/documentos/${req.file.filename}` : null;
            let nombreOri = req.file ? req.file.originalname : null;

            const [result] = await conn.execute(`
                INSERT INTO documentos_persona (id_persona, id_tipo_documento, numero_documento, fecha_emision, fecha_vencimiento, ruta_archivo, nombre_archivo, observaciones, estado)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'vigente')
            `, [id_persona, id_tipo, numero_documento, fecha_emision || null, fecha_vencimiento, ruta, nombreOri, observaciones || null]);

            // Sistema de Alertas (opcional según checkbox)
            if (enviar_alerta === 'on') {
                const dias = Math.ceil((new Date(fecha_vencimiento) - new Date()) / (1000 * 60 * 60 * 24));
                if (dias <= 30) {
                    await conn.execute(`INSERT INTO alertas (tipo_entidad, id_entidad, id_documento, tipo_alerta, mensaje) VALUES ('persona', ?, ?, 'documento_por_vencer', ?)`,
                        [id_persona, result.insertId, `Documento ${tipo_documento_nombre} vence en ${dias} días`]);
                }
            }

            await conn.commit();
            res.redirect('/documentos-persona?success=Documento registrado correctamente');
        } catch (err) {
            if (conn) await conn.rollback();
            logError('AGREGAR', err);
            res.redirect('/documentos-persona?error=' + encodeURIComponent(err.message));
        } finally {
            if (conn) conn.release();
        }
    },

    // 3. API para recargar lista de personas
    apiPersonas: async (req, res) => {
        try {
            const [rows] = await db.execute(`
                SELECT id_persona, cargo,
                TRIM(CONCAT_WS(' ', nombres, apellido_paterno)) AS nombre_completo,
                CONCAT(run, '-', dv) AS run_completo
                FROM personas WHERE activo = 1
            `);
            res.json({ success: true, personas: rows });
        } catch (err) {
            res.status(500).json({ success: false });
        }
    },

    // 4. Eliminar Documento y Archivo Físico
    eliminarDocumento: async (req, res) => {
        try {
            const [doc] = await db.execute('SELECT ruta_archivo FROM documentos_persona WHERE id_documento = ?', [req.params.id]);
            if (doc.length > 0 && doc[0].ruta_archivo) {
                const fullPath = path.join(__dirname, '../../public', doc[0].ruta_archivo);
                if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
            }
            await db.execute('DELETE FROM documentos_persona WHERE id_documento = ?', [req.params.id]);
            res.json({ success: true, message: 'Eliminado' });
        } catch (err) {
            res.status(500).json({ success: false, error: err.message });
        }
    },

    obtenerDocumentoPorId: async (req, res) => {
        try {
            const [rows] = await db.execute('SELECT * FROM documentos_persona WHERE id_documento = ?', [req.params.id]);
            res.json({ success: rows.length > 0, documento: rows[0] });
        } catch (err) {
            res.status(500).json({ success: false });
        }
    },

    actualizarDocumento: async (req, res) => {
        // Implementar lógica de actualización similar a agregarDocumento
        res.redirect('/documentos-persona?success=Actualizado');
    }
};

module.exports = documentosPersonaController;