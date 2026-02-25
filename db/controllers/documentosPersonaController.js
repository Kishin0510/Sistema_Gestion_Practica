const db = require('../conexion');

// Calcular estado según fecha
const calcularEstado = (fechaVencimiento) => {
    const hoy = new Date();
    const venc = new Date(fechaVencimiento);

    const diffDias = Math.ceil((venc - hoy) / (1000 * 60 * 60 * 24));

    if (diffDias < 0) return 'vencido';
    if (diffDias <= 30) return 'por_vencer';
    return 'vigente';
};

const documentosPersonaController = {

    
    async index(req, res) {
        try {

            const [documentos] = await db.query(`
                SELECT 
                    dp.id_documento AS id_documento_persona,
                    CONCAT(p.nombres, ' ', p.apellido_paterno, ' ', IFNULL(p.apellido_materno,'')) AS persona_nombre_completo,
                    CONCAT(p.run, '-', p.dv) AS persona_dni,
                    tdp.nombre_documento AS tipo_documento_nombre,
                    dp.numero_documento,
                    dp.fecha_vencimiento
                FROM documentos_persona dp
                INNER JOIN personas p ON dp.id_persona = p.id_persona
                INNER JOIN tipo_documentos_persona tdp ON dp.id_tipo_documento = tdp.id_tipo_documento
                WHERE p.activo = 1
                ORDER BY dp.id_documento DESC
            `);

            // Agregar estado calculado
            documentos.forEach(doc => {
                doc.estado_calculado = calcularEstado(doc.fecha_vencimiento);
            });

            const totalDocumentos = documentos.length;
            const documentosVigentes = documentos.filter(d => d.estado_calculado === 'vigente').length;
            const documentosPorVencer = documentos.filter(d => d.estado_calculado === 'por_vencer').length;
            const documentosVencidos = documentos.filter(d => d.estado_calculado === 'vencido').length;

            // Personas para el modal
            const [personas] = await db.query(`
                SELECT 
                    id_persona,
                    CONCAT(nombres, ' ', apellido_paterno, ' ', IFNULL(apellido_materno,'')) AS nombre_completo,
                    CONCAT(run, '-', dv) AS run_completo,
                    cargo
                FROM personas
                WHERE activo = 1
                ORDER BY nombres
            `);

            res.render('DocumentosPersonas', {
                title: 'Gestión Documental - Personas',
                documentos,
                personas,
                totalDocumentos,
                documentosVigentes,
                documentosPorVencer,
                documentosVencidos
            });

        } catch (error) {
            console.error(error);
            res.status(500).send('Error al cargar documentos');
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

            // Crear tipo si no existe
            let [tipo] = await db.query(`
                SELECT id_tipo_documento 
                FROM tipo_documentos_persona 
                WHERE nombre_documento = ?
                LIMIT 1
            `, [tipo_documento_nombre]);

            let id_tipo_documento;

            if (tipo.length === 0) {
                const [nuevoTipo] = await db.query(`
                    INSERT INTO tipo_documentos_persona (id_cliente, nombre_documento)
                    VALUES (1, ?)
                `, [tipo_documento_nombre]);

                id_tipo_documento = nuevoTipo.insertId;
            } else {
                id_tipo_documento = tipo[0].id_tipo_documento;
            }

            await db.query(`
                INSERT INTO documentos_persona
                (id_persona, id_tipo_documento, numero_documento, fecha_emision, fecha_vencimiento, observaciones)
                VALUES (?, ?, ?, ?, ?, ?)
            `, [
                id_persona,
                id_tipo_documento,
                numero_documento,
                fecha_emision || null,
                fecha_vencimiento,
                observaciones || null
            ]);

            res.redirect('/documentos-persona');

        } catch (error) {
            console.error(error);
            res.status(500).send('Error al registrar documento');
        }
    },

    // ===============================
    // ELIMINAR
    // ===============================
    async eliminar(req, res) {
        try {

            const { id } = req.params;

            await db.query(`
                DELETE FROM documentos_persona
                WHERE id_documento = ?
            `, [id]);

            res.json({ success: true });

        } catch (error) {
            console.error(error);
            res.json({ success: false, error: 'No se pudo eliminar' });
        }
    }
};

module.exports = documentosPersonaController;