// routes/personas/documentos.routes.js
const express = require('express');
const router = express.Router();
const db = require('../../db/conexion');
const {
    personaDocument,
    handleUploadErrors,
    enrichFileInfo
} = require('../../middleware/upload');


router.post('/:id_persona/documentos',
    personaDocument,
    enrichFileInfo,
    handleUploadErrors,
    async (req, res) => {
        try {
            const { id_persona } = req.params;
            const {
                id_tipo_documento,
                numero_documento,
                fecha_emision,
                fecha_vencimiento,
                observaciones,
                id_cliente 
            } = req.body;
            if (!req.file) {
                return res.status(400).json({
                    success: false,
                    message: 'No se ha subido ningún archivo'
                });
            }
            // Validar campos requeridos
            if (!id_tipo_documento || !fecha_vencimiento) {
                return res.status(400).json({
                    success: false,
                    message: 'id_tipo_documento y fecha_vencimiento son requeridos'
                });
            }
            const [persona] = await db.query(
                'SELECT id_cliente FROM personas WHERE id_persona = ?',
                [id_persona]
            );

            if (persona.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Persona no encontrada'
                });
            }

            const clienteId = persona[0].id_cliente;

           
            const hoy = new Date();
            const fechaVenc = new Date(fecha_vencimiento);
            const diasDiferencia = Math.ceil((fechaVenc - hoy) / (1000 * 60 * 60 * 24));

            let estado = 'vigente';
            if (diasDiferencia < 0) {
                estado = 'vencido';
            } else if (diasDiferencia <= 30) {
                estado = 'por_vencer';
            }

            
            const usuario_subida = req.user ? req.user.id_usuario : 1;

            
            const query = `
        INSERT INTO documentos_persona (
          id_persona, id_tipo_documento, nombre_archivo,
          ruta_archivo, numero_documento, fecha_emision,
          fecha_vencimiento, estado, observaciones, usuario_subida
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

            const values = [
                id_persona,
                id_tipo_documento,
                req.file.originalname,
                req.file.path.replace(/\\/g, '/'), 
                numero_documento || null,
                fecha_emision || null,
                fecha_vencimiento,
                estado,
                observaciones || null,
                usuario_subida
            ];

            const [result] = await db.query(query, values);

            
            const [documentoInsertado] = await db.query(`
        SELECT dp.*, tdp.nombre as tipo_documento_nombre 
        FROM documentos_persona dp
        LEFT JOIN tipo_documentos_persona tdp ON dp.id_tipo_documento = tdp.id_tipo_documento
        WHERE dp.id_documento = ?
      `, [result.insertId]);

            res.status(201).json({
                success: true,
                message: 'Documento subido exitosamente',
                data: {
                    ...documentoInsertado[0],
                    url: `/uploads/documentos/personas/persona_${id_persona}/${req.file.filename}`,
                    metadata: req.file.metadata
                }
            });

        } catch (error) {
            console.error('Error al subir documento:', error);

            
            if (req.file && req.file.path) {
                try {
                    fs.unlinkSync(req.file.path);
                } catch (err) {
                    console.error('Error al eliminar archivo:', err);
                }
            }

            res.status(500).json({
                success: false,
                message: 'Error al procesar el documento',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    }
);

router.get('/:id_persona/documentos', async (req, res) => {
    try {
        const { id_persona } = req.params;

        const query = `
      SELECT 
        dp.*,
        tdp.nombre as tipo_documento,
        tdp.descripcion,
        CONCAT(p.nombres, ' ', p.apellido_paterno) as persona_nombre,
        p.run,
        p.dv
      FROM documentos_persona dp
      LEFT JOIN tipo_documentos_persona tdp ON dp.id_tipo_documento = tdp.id_tipo_documento
      LEFT JOIN personas p ON dp.id_persona = p.id_persona
      WHERE dp.id_persona = ?
      ORDER BY 
        CASE dp.estado 
          WHEN 'vencido' THEN 1
          WHEN 'por_vencer' THEN 2
          WHEN 'vigente' THEN 3
        END,
        dp.fecha_vencimiento ASC,
        dp.fecha_subida DESC
    `;

        const [documentos] = await db.query(query, [id_persona]);
        documentos.forEach(doc => {
            if (doc.ruta_archivo) {
                
                const fileName = path.basename(doc.ruta_archivo);
                doc.url = `/uploads/documentos/personas/persona_${id_persona}/${fileName}`;
            }
            doc.run_completo = doc.run ? `${doc.run}-${doc.dv}` : null;
        });

        res.json({
            success: true,
            count: documentos.length,
            data: documentos
        });
    } catch (error) {
        console.error('Error al obtener documentos:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener documentos'
        });
    }
});
router.get('/documentos/descargar/:id_documento', async (req, res) => {
    try {
        const { id_documento } = req.params;

        const [documentos] = await db.query(
            'SELECT ruta_archivo, nombre_archivo, id_persona FROM documentos_persona WHERE id_documento = ?',
            [id_documento]
        );

        if (documentos.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Documento no encontrado'
            });
        }
        const doc = documentos[0];
        const filePath = doc.ruta_archivo;
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({
                success: false,
                message: 'El archivo físico no fue encontrado'
            });
        }

        // Enviar archivo para descarga
        res.download(filePath, doc.nombre_archivo);

    } catch (error) {
        console.error('Error al descargar documento:', error);
        res.status(500).json({
            success: false,
            message: 'Error al descargar el documento'
        });
    }
});
module.exports = router;