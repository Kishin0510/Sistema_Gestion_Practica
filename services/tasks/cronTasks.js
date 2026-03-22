const cron = require('node-cron');
const db = require('../../db/conexion');
const { enviarAlerta } = require('../services/emailService');

cron.schedule('0 9 * * *', async () => {
    console.log('--- Iniciando revisión de vencimientos ---');
    
    try {
        
        const [docs] = await db.query(`
            SELECT d.tipo_documento_nombre, d.fecha_vencimiento, v.patente, v.modelo, p.email
            FROM documentos d
            JOIN vehiculos v ON d.id_vehiculo = v.id_vehiculo
            JOIN personas p ON v.id_responsable = p.id_persona
            WHERE DATEDIFF(d.fecha_vencimiento, CURDATE()) IN (30, 7, 1)
        `);
        for (const doc of docs) {
            if (doc.email) {
                await enviarAlerta(doc.email, {
                    tipo: doc.tipo_documento_nombre,
                    patente: doc.patente,
                    modelo: doc.modelo,
                    fecha: new Date(doc.fecha_vencimiento).toLocaleDateString(),
                    dias: 'Próximo'
                });
                console.log(`Alerta enviada a ${doc.email} por patente ${doc.patente}`);
            }
        }
    } catch (error) {
        console.error('Error en tarea cron:', error);
    }
});