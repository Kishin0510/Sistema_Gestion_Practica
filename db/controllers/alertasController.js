require('dotenv').config();
const db = require('../conexion');

const logError = (tag, err) => console.error(` ${tag}`, err.message || err);

const alertasController = {

    listarAlertas: async (req, res) => {
        try {
            const usuario = req.session.usuario || null;
            const rol = usuario?.rol ? String(usuario.rol).toUpperCase() : '';

            let query = `
                SELECT 
                    a.id_alerta,
                    a.tipo_entidad,
                    a.id_entidad,
                    a.id_documento,
                    a.tipo_alerta,
                    a.mensaje,
                    a.fecha_generacion,
                    a.fecha_envio,
                    a.enviado,
                    a.metodo_envio,
                    a.leido
                FROM alertas a
            `;

            let params = [];

            
            if (rol === 'ADMIN_CLIENTE') {
                query += ` ORDER BY a.leido ASC, a.fecha_generacion DESC`;
            } else {
                query += ` ORDER BY a.leido ASC, a.fecha_generacion DESC`;
            }

            const [alertas] = await db.execute(query, params);

            const totalAlertas = alertas.length;
            const alertasNoLeidas = alertas.filter(a => !a.leido).length;
            const alertasLeidas = alertas.filter(a => !!a.leido).length;

            res.render('alertas', {
                title: 'Alertas del Sistema',
                layout: 'layouts/main',
                alertas,
                totalAlertas,
                alertasNoLeidas,
                alertasLeidas,
                usuario: req.session.usuario || null,
                success_msg: req.query.success || null,
                error_msg: req.query.error || null
            });

        } catch (err) {
            logError('LISTAR ALERTAS', err);
            res.render('alertas', {
                title: 'Alertas del Sistema',
                layout: 'layouts/main',
                alertas: [],
                totalAlertas: 0,
                alertasNoLeidas: 0,
                alertasLeidas: 0,
                usuario: req.session.usuario || null,
                error_msg: 'Error al cargar las alertas'
            });
        }
    },

    marcarLeida: async (req, res) => {
        try {
            const { id } = req.params;

            const [resultado] = await db.execute(`
                UPDATE alertas
                SET leido = TRUE
                WHERE id_alerta = ?
            `, [id]);

            if (resultado.affectedRows === 0) {
                return res.redirect('/alertas?error=' + encodeURIComponent('Alerta no encontrada'));
            }

            res.redirect('/alertas?success=' + encodeURIComponent('Alerta marcada como leída'));

        } catch (err) {
            logError('MARCAR ALERTA LEIDA', err);
            res.redirect('/alertas?error=' + encodeURIComponent('Error al marcar la alerta como leída'));
        }
    },

    marcarTodasLeidas: async (req, res) => {
        try {
            await db.execute(`
                UPDATE alertas
                SET leido = TRUE
                WHERE leido = FALSE
            `);

            res.redirect('/alertas?success=' + encodeURIComponent('Todas las alertas fueron marcadas como leídas'));

        } catch (err) {
            logError('MARCAR TODAS LEIDAS', err);
            res.redirect('/alertas?error=' + encodeURIComponent('Error al actualizar las alertas'));
        }
    },

    eliminarAlerta: async (req, res) => {
        try {
            const { id } = req.params;

            const [resultado] = await db.execute(`
                DELETE FROM alertas
                WHERE id_alerta = ?
            `, [id]);

            if (resultado.affectedRows === 0) {
                return res.redirect('/alertas?error=' + encodeURIComponent('Alerta no encontrada'));
            }

            res.redirect('/alertas?success=' + encodeURIComponent('Alerta eliminada correctamente'));

        } catch (err) {
            logError('ELIMINAR ALERTA', err);
            res.redirect('/alertas?error=' + encodeURIComponent('Error al eliminar la alerta'));
        }
    }
};

module.exports = alertasController;