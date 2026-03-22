const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT,
    secure: false,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});
const enviarAlerta = async (emailDestino, datosDoc) => {
    const mailOptions = {
        from: '"Alertas Gestión Vehicular" <tu-email@ejemplo.com>',
        to: emailDestino,
        subject: ` Vencimiento Próximo: ${datosDoc.tipo}`,
        html: `
            <div style="font-family: Arial, sans-serif; border: 1px solid #eee; padding: 20px;">
                <h2 style="color: #1e3a8a;">Aviso de Vencimiento</h2>
                <p>Estimado/a, le informamos que un documento está por vencer:</p>
                <ul>
                    <li><strong>Vehículo:</strong> ${datosDoc.patente} (${datosDoc.modelo})</li>
                    <li><strong>Documento:</strong> ${datosDoc.tipo}</li>
                    <li><strong>Fecha de Vencimiento:</strong> ${datosDoc.fecha}</li>
                </ul>
                <p style="color: red;"><strong>Días restantes: ${datosDoc.dias}</strong></p>
                <br>
                <small>Este es un mensaje automático del Sistema de Gestión Vehicular.</small>
            </div>
        `
    };
    return transporter.sendMail(mailOptions);
};
module.exports = { enviarAlerta };