const db = require('../conexion');

const logsController = {

    
    listarLogs: async (req, res) => {
        try {
            console.log('Cargando registro de cambios...');

            
            const id_cliente_session = 1;

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

            console.log(` ${logs.length} registro(s) de actividad cargado(s)`);

            
            const stats = {
                total: logs.length,
                inserts: logs.filter(l => l.operacion === 'INSERT').length,
                updates: logs.filter(l => l.operacion === 'UPDATE').length,
                deletes: logs.filter(l => l.operacion === 'DELETE').length
            };

            res.render('logs/index', {
                title: 'Registro de Auditoría y Cambios',
                logs: logs,
                stats: stats,
                success_msg: req.query.success,
                error_msg: req.query.error
            });

        } catch (error) {
            console.error(' Error al listar logs:', error);

            res.render('logs/index', {
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
            const id_cliente_session = 1; 

            const query = `
                SELECT 
                    l.*, 
                    CONCAT(p.nombres, ' ', p.apellido_paterno) AS usuario_nombre,
                    p.email AS usuario_email,
                    c.nombre_cliente
                FROM logs_registro_cambios l
                INNER JOIN personas p ON l.id_persona = p.id_persona
                INNER JOIN clientes c ON l.id_cliente = c.id_cliente
                WHERE l.id_log = ? AND l.id_cliente = ?
            `;

            const [rows] = await db.query(query, [id, id_cliente_session]);

            if (rows.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Registro de log no encontrado o sin permisos'
                });
            }

            
            res.json({
                success: true,
                log: rows[0]
            });

        } catch (error) {
            console.error(' Error al obtener detalle del log:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno al procesar la solicitud de detalle'
            });
        }
    }
};

module.exports = logsController;