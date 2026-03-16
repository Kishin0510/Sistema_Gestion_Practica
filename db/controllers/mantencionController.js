require('dotenv').config();
const db = require('../conexion');
const fs = require('fs');
const path = require('path');
const logError = (tag, err) => console.error(` ${tag}`, err.message || err);
const mantencionController = {
    
    listarMantenciones: async (req, res) => {
        try {
            const [mantenciones] = await db.execute(`
                SELECT 
                    m.id_mantencion,
                    m.id_vehiculo,
                    m.tipo_mantencion,
                    m.kilometraje,
                    m.fecha_mantencion,
                    m.costo_total,
                    m.taller_proveedor,
                    m.nombre_archivo,
                    m.ruta_archivo,
                    m.observaciones,
                    v.patente,
                    v.marca,
                    v.modelo
                FROM mantenciones_vehiculo m
                JOIN vehiculos v ON m.id_vehiculo = v.id_vehiculo
                ORDER BY m.fecha_mantencion DESC
            `);
            res.json({ success: true, mantenciones });
        } catch (err) {
            logError('LISTAR MANTENCIONES', err);
            res.status(500).json({ success: false, error: err.message });
        }
    },

    agregarMantencion: async (req, res) => {
        let conn;
        try {
            conn = await db.pool.promise().getConnection();
            await conn.beginTransaction();

            const {
                id_vehiculo,
                tipo_mantencion,
                kilometraje,
                fecha_mantencion,
                costo,
                taller,
                observaciones
            } = req.body;

            let nombre_archivo = null;
            let ruta_archivo = null;

            if (req.file) {
                nombre_archivo = req.file.filename;
                ruta_archivo = `/uploads/mantenciones/${req.file.filename}`;
            }

            const [result] = await conn.execute(`
                INSERT INTO mantenciones_vehiculo (
                    id_vehiculo,
                    tipo_mantencion,
                    kilometraje,
                    fecha_mantencion,
                    costo_total,
                    taller_proveedor,
                    nombre_archivo,
                    ruta_archivo,
                    observaciones,
                    usuario_id
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                id_vehiculo,
                tipo_mantencion.trim(),
                kilometraje,
                fecha_mantencion,
                costo || 0,
                taller || null,
                nombre_archivo,
                ruta_archivo,
                observaciones || null,
                req.session?.usuario?.id_usuario || null
            ]);

            await conn.commit();
            res.redirect(`/documentos?success=Mantención registrada exitosamente`);

        } catch (err) {
            if (conn) await conn.rollback();
            logError('AGREGAR MANTENCION', err);
            res.redirect(`/documentos?error=${encodeURIComponent(err.message)}`);
        } finally {
            if (conn) conn.release();
        }
    },
    obtenerMantencionPorId: async (req, res) => {
        try {
            const { id } = req.params;
            const [rows] = await db.execute(`
                SELECT * FROM mantenciones_vehiculo WHERE id_mantencion = ?
            `, [id]);

            if (rows.length === 0) {
                return res.status(404).json({ success: false, message: 'No encontrada' });
            }

            
            const mantencion = rows[0];
            if (mantencion.fecha_mantencion) {
                mantencion.fecha_mantencion = new Date(mantencion.fecha_mantencion).toISOString().split('T')[0];
            }

            res.json({ success: true, mantencion });
        } catch (err) {
            res.status(500).json({ success: false, error: err.message });
        }
    },
    actualizarMantencion: async (req, res) => {
        let conn;
        try {
            const { id } = req.params;
            conn = await db.pool.promise().getConnection();
            await conn.beginTransaction();

            const {
                id_vehiculo,
                tipo_mantencion,
                kilometraje,
                fecha_mantencion,
                costo,
                taller,
                observaciones
            } = req.body;

            const [actual] = await conn.execute('SELECT ruta_archivo FROM mantenciones_vehiculo WHERE id_mantencion = ?', [id]);
            let nombre_archivo = actual[0].nombre_archivo;
            let ruta_archivo = actual[0].ruta_archivo;
            if (req.file) {
                
                if (ruta_archivo) {
                    const oldPath = path.join(__dirname, '../public', ruta_archivo);
                    if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
                }
                nombre_archivo = req.file.filename;
                ruta_archivo = `/uploads/mantenciones/${req.file.filename}`;
            }
            await conn.execute(`
                UPDATE mantenciones_vehiculo SET
                    id_vehiculo = ?, tipo_mantencion = ?, kilometraje = ?,
                    fecha_mantencion = ?, costo_total = ?, taller_proveedor = ?,
                    nombre_archivo = ?, ruta_archivo = ?, observaciones = ?
                WHERE id_mantencion = ?
            `, [id_vehiculo, tipo_mantencion, kilometraje, fecha_mantencion, costo, taller, nombre_archivo, ruta_archivo, observaciones, id]);

            await conn.commit();
            res.redirect(`/documentos?success=Mantención actualizada`);
        } catch (err) {
            if (conn) await conn.rollback();
            res.redirect(`/documentos?error=${encodeURIComponent(err.message)}`);
        } finally {
            if (conn) conn.release();
        }
    },
    eliminarMantencion: async (req, res) => {
        try {
            const { id } = req.params;
            const [mantencion] = await db.execute('SELECT ruta_archivo FROM mantenciones_vehiculo WHERE id_mantencion = ?', [id]);

            if (mantencion.length > 0 && mantencion[0].ruta_archivo) {
                const filePath = path.join(__dirname, '../public', mantencion[0].ruta_archivo);
                if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
            }
            await db.execute('DELETE FROM mantenciones_vehiculo WHERE id_mantencion = ?', [id]);
            res.json({ success: true, message: 'Mantención eliminada' });
        } catch (err) {
            res.status(500).json({ success: false, error: err.message });
        }
    }
};

module.exports = mantencionController;