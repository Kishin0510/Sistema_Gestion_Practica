const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: Number(process.env.EMAIL_PORT || 587),
    secure: false,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

function obtenerEstadoAlerta(dias) {
    const diasNum = Number(dias);

    if (diasNum <= 0) {
        return {
            texto: 'VENCIDO',
            color: '#dc3545',
            fondo: '#f8d7da',
            asunto: 'Documento Vencido'
        };
    }
    if (diasNum <= 7) {
        return {
            texto: 'URGENTE',
            color: '#dc3545',
            fondo: '#f8d7da',
            asunto: 'Documento por vencer'
        };
    }

    if (diasNum <= 30) {
        return {
            texto: 'POR VENCER',
            color: '#856404',
            fondo: '#fff3cd',
            asunto: 'Documento próximo a vencer'
        };
    }
    return {
        texto: 'VIGENTE',
        color: '#198754',
        fondo: '#d1e7dd',
        asunto: 'Documento vigente'
    };
}
function obtenerEstiloMotivo(motivo) {
    const texto = String(motivo || '').toLowerCase().trim();

    if (
        texto.includes('urgente') ||
        texto.includes('crítico') ||
        texto.includes('critico') ||
        texto.includes('inmediato') ||
        texto.includes('alta')
    ) {
        return {
            nivel: 'URGENTE',
            color: '#dc3545',
            fondo: '#f8d7da',
            borde: '#dc3545'
        };
    }
    if (
        texto.includes('medio') ||
        texto.includes('moderado') ||
        texto.includes('pronto') ||
        texto.includes('media')
    ) {
        return {
            nivel: 'MEDIA',
            color: '#856404',
            fondo: '#fff3cd',
            borde: '#ffc107'
        };
    }
    return {
        nivel: 'BAJA',
        color: '#198754',
        fondo: '#d1e7dd',
        borde: '#198754'
    };
}
function normalizarDestinatarios(emailDestino) {
    if (Array.isArray(emailDestino)) return emailDestino;
    if (!emailDestino) return [];
    return String(emailDestino)
        .split(',')
        .map(email => email.trim())
        .filter(Boolean);
}
const enviarAlerta = async (emailDestino, datosDoc) => {
    const estado = obtenerEstadoAlerta(datosDoc.dias);
    const mailOptions = {
        from: `"Alertas Gestión Vehicular" <${process.env.EMAIL_USER}>`,
        to: normalizarDestinatarios(emailDestino),
        subject: `${estado.asunto}: ${datosDoc.tipo}`,
        html: `
            <div style="font-family: Arial, sans-serif; border: 1px solid #eee; padding: 20px;">
                <h2 style="color: #1e3a8a;">Aviso de Vencimiento</h2>

                <div style="background:${estado.fondo}; color:${estado.color}; padding:12px; border-radius:8px; margin-bottom:15px; font-weight:bold; text-align:center;">
                    Estado: ${estado.texto}
                </div>

                <p>Estimado/a, le informamos que un documento requiere atención:</p>

                <ul>
                    <li><strong>Vehículo:</strong> ${datosDoc.patente} (${datosDoc.modelo})</li>
                    <li><strong>Documento:</strong> ${datosDoc.tipo}</li>
                    <li><strong>Fecha de Vencimiento:</strong> ${datosDoc.fecha}</li>
                </ul>

                <p style="color:${estado.color}; font-weight:bold;">
                    Días restantes: ${datosDoc.dias}
                </p>

                <br>
                <small>Este es un mensaje automático del Sistema de Gestión Vehicular.</small>
            </div>
        `
    };

    return transporter.sendMail(mailOptions);
};
const enviarCorreoCambioVencimiento = async (emailDestino, datosCambio) => {
    const motivoEstilo = obtenerEstiloMotivo(datosCambio.motivo);
    const mailOptions = {
        from: `"Alertas Gestión Vehicular" <${process.env.EMAIL_USER}>`,
        to: normalizarDestinatarios(emailDestino),
        subject: `Modificación de vencimiento: ${datosCambio.tipo_documento}`,
        html: `
            <div style="font-family: Arial, sans-serif; border: 1px solid #eee; padding: 20px;">
                <h2 style="color: #1e3a8a;">Modificación de Fecha de Vencimiento</h2>
                <p>Se detectó un cambio en la fecha de vencimiento de un documento realizado por un usuario con rol <strong>ACTUALIZADOR</strong>.</p>

                <table style="width: 100%; border-collapse: collapse; margin-top: 15px;">
                    <tr>
                        <td style="padding: 10px; border: 1px solid #ddd; background: #f8f9fa; width: 220px;"><strong>Usuario</strong></td>
                        <td style="padding: 10px; border: 1px solid #ddd;">${datosCambio.usuario}</td>
                    </tr>
                    <tr>
                        <td style="padding: 10px; border: 1px solid #ddd; background: #f8f9fa;"><strong>Vehículo</strong></td>
                        <td style="padding: 10px; border: 1px solid #ddd;">${datosCambio.patente} - ${datosCambio.marca} ${datosCambio.modelo}</td>
                    </tr>
                    <tr>
                        <td style="padding: 10px; border: 1px solid #ddd; background: #f8f9fa;"><strong>Documento</strong></td>
                        <td style="padding: 10px; border: 1px solid #ddd;">${datosCambio.tipo_documento}</td>
                    </tr>
                    <tr>
                        <td style="padding: 10px; border: 1px solid #ddd; background: #f8f9fa;"><strong>N° Documento</strong></td>
                        <td style="padding: 10px; border: 1px solid #ddd;">${datosCambio.numero_documento}</td>
                    </tr>
                    <tr>
                        <td style="padding: 10px; border: 1px solid #ddd; background: #f8f9fa;"><strong>Fecha vencimiento anterior</strong></td>
                        <td style="padding: 10px; border: 1px solid #ddd;">${datosCambio.fecha_anterior}</td>
                    </tr>
                    <tr>
                        <td style="padding: 10px; border: 1px solid #ddd; background: #f8f9fa;"><strong>Nueva fecha vencimiento</strong></td>
                        <td style="padding: 10px; border: 1px solid #ddd;">${datosCambio.fecha_nueva}</td>
                    </tr>
                    <tr>
                        <td style="padding: 10px; border: 1px solid #ddd; background: #f8f9fa;"><strong>Motivo del cambio</strong></td>
                        <td style="padding: 10px; border: 1px solid #ddd;">
                            <div style="
                                background:${motivoEstilo.fondo};
                                color:${motivoEstilo.color};
                                border:2px solid ${motivoEstilo.borde};
                                padding:10px 14px;
                                border-radius:8px;
                                font-weight:bold;
                                text-transform:uppercase;
                                text-align:center;
                                letter-spacing:0.5px;
                            ">
                                ${motivoEstilo.nivel} - ${datosCambio.motivo}
                            </div>
                        </td>
                    </tr>
                </table>

                <br>
                <small>Este es un mensaje automático del Sistema de Gestión Vehicular.</small>
            </div>
        `
    };
    return transporter.sendMail(mailOptions);
};
module.exports = {
    enviarAlerta,
    enviarCorreoCambioVencimiento
};