const db = require('../conexion');

const logsController = {
    listarLogs: async (req, res) => {
        try {
            const id_cliente_session = 1; // Acceso libre para cliente 1

            const query = `
                SELECT 
                    l.id_log,
                    l.operacion,
                    l.tabla_afectada,
                    l.id_registro_afectado,
                    l.actividad,
                    l.datos_anteriores,
                    l.datos_nuevos,
                    l.ip_origen,
                    DATE_FORMAT(l.fecha_hora, '%d/%m/%Y %H:%i:%s') AS fecha_formateada,
                    CONCAT(p.nombres, ' ', p.apellido_paterno, ' ', IFNULL(p.apellido_materno, '')) AS usuario_nombre,
                    c.nombre_cliente
                FROM logs_registro_cambios l
                INNER JOIN personas p ON l.id_persona = p.id_persona
                INNER JOIN clientes c ON l.id_cliente = c.id_cliente
                WHERE l.id_cliente = ?
                ORDER BY l.fecha_hora DESC
                LIMIT 500
            `;

            const [logs] = await db.query(query, [id_cliente_session]);

            const stats = {
                total: logs.length,
                inserts: logs.filter(l => l.operacion === 'INSERT').length,
                updates: logs.filter(l => l.operacion === 'UPDATE').length,
                deletes: logs.filter(l => l.operacion === 'DELETE').length
            };

            // CAMBIO AQUÍ: Nombre exacto de tu archivo .ejs
            res.render('LogsCambio', {
                title: 'Registro de Auditoría y Cambios',
                logs: logs,
                stats: stats,
                success_msg: req.query.success,
                error_msg: req.query.error
            });

        } catch (error) {
            console.error(' Error al listar logs:', error);
            res.render('LogsCambio', {
                title: 'Registro de Cambios',
                logs: [],
                stats: { total: 0, inserts: 0, updates: 0, deletes: 0 },
                error_msg: 'Error al cargar el historial de auditoría'
            });
        }
    },

    verDetalleLog: async (req, res) => {
        try {
            const { id } = req.params;
            const query = `
                SELECT l.*, 
                CONCAT(p.nombres, ' ', p.apellido_paterno) AS usuario_nombre,
                c.nombre_cliente
                FROM logs_registro_cambios l
                INNER JOIN personas p ON l.id_persona = p.id_persona
                INNER JOIN clientes c ON l.id_cliente = c.id_cliente
                WHERE l.id_log = ?
            `;
            const [rows] = await db.query(query, [id]);

            if (rows.length === 0) return res.status(404).json({ error: 'No encontrado' });
            
            // Enviamos el objeto directo para que el JS de la vista lo entienda
            res.json(rows[0]);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
};

module.exports = logsController;