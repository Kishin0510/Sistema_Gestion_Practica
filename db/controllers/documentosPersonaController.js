const db = require('../conexion');
const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');


const DESCARGAS_PATH = path.join(__dirname, '../../descargas');
const DOCS_PERSONAS_PATH = path.join(DESCARGAS_PATH, 'documentos_personas');


if (!fs.existsSync(DESCARGAS_PATH)) fs.mkdirSync(DESCARGAS_PATH, { recursive: true });
if (!fs.existsSync(DOCS_PERSONAS_PATH)) fs.mkdirSync(DOCS_PERSONAS_PATH, { recursive: true });


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
                    dp.fecha_vencimiento,
                    dp.nombre_archivo,
                    CASE WHEN dp.ruta_archivo IS NOT NULL THEN TRUE ELSE FALSE END AS tiene_archivo
                FROM documentos_persona dp
                INNER JOIN personas p ON dp.id_persona = p.id_persona
                INNER JOIN tipo_documentos_persona tdp ON dp.id_tipo_documento = tdp.id_tipo_documento
                WHERE p.activo = 1
                ORDER BY dp.id_documento DESC
            `);

            documentos.forEach(doc => {
                doc.estado_calculado = calcularEstado(doc.fecha_vencimiento);

                // Determinar clase CSS según estado
                if (doc.estado_calculado === 'vencido') doc.estado_class = 'danger';
                else if (doc.estado_calculado === 'por_vencer') doc.estado_class = 'warning';
                else doc.estado_class = 'success';
            });

            const totalDocumentos = documentos.length;
            const documentosVigentes = documentos.filter(d => d.estado_calculado === 'vigente').length;
            const documentosPorVencer = documentos.filter(d => d.estado_calculado === 'por_vencer').length;
            const documentosVencidos = documentos.filter(d => d.estado_calculado === 'vencido').length;

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
            console.error('Error en index:', error);
            res.status(500).send('Error al cargar documentos');
        }
    },

    
    async registrar(req, res) {
        let conn;
        try {
            conn = await db.pool.promise().getConnection();
            await conn.beginTransaction();

            const {
                id_persona,
                tipo_documento_nombre,
                numero_documento,
                fecha_emision,
                fecha_vencimiento,
                observaciones
            } = req.body;

            if (!id_persona || !tipo_documento_nombre || !numero_documento || !fecha_vencimiento) {
                throw new Error('Faltan campos obligatorios');
            }

            const [persona] = await conn.execute(
                'SELECT id_persona, id_cliente FROM personas WHERE id_persona = ? AND activo = 1',
                [id_persona]
            );

            if (persona.length === 0) {
                throw new Error('La persona seleccionada no existe o está inactiva');
            }

            const id_cliente = persona[0].id_cliente;

            
            let [tipo] = await conn.query(`
                SELECT id_tipo_documento 
                FROM tipo_documentos_persona 
                WHERE nombre_documento = ?
                LIMIT 1
            `, [tipo_documento_nombre]);

            let id_tipo_documento;

            if (tipo.length === 0) {
                const [nuevoTipo] = await conn.query(`
                    INSERT INTO tipo_documentos_persona (id_cliente, nombre_documento)
                    VALUES (?, ?)
                `, [id_cliente, tipo_documento_nombre]);

                id_tipo_documento = nuevoTipo.insertId;
            } else {
                id_tipo_documento = tipo[0].id_tipo_documento;
            }

            
            let nombre_archivo = null;
            let ruta_archivo_relativa = null;

            if (req.file) {
                
                const timestamp = Date.now();
                const random = Math.round(Math.random() * 1000);
                const ext = path.extname(req.file.originalname);
                const nombreSinEspacios = req.file.originalname.replace(/\s+/g, '_');
                const nombreUnico = `${timestamp}-${random}${ext}`;

                
                const rutaCompleta = path.join(DOCS_PERSONAS_PATH, nombreUnico);

                
                fs.renameSync(req.file.path, rutaCompleta);

                nombre_archivo = req.file.originalname; 
                ruta_archivo_relativa = `/descargas/documentos_personas/${nombreUnico}`;
            }

            
            await conn.query(`
                INSERT INTO documentos_persona
                (id_persona, id_tipo_documento, numero_documento, fecha_emision, fecha_vencimiento, 
                 observaciones, nombre_archivo, ruta_archivo, fecha_subida, usuario_subida)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?)
            `, [
                id_persona,
                id_tipo_documento,
                numero_documento,
                fecha_emision || null,
                fecha_vencimiento,
                observaciones || null,
                nombre_archivo,
                ruta_archivo_relativa,
                req.session?.usuario?.id_usuario || null
            ]);

            await conn.commit();

            res.redirect('/documentos-persona?success=Documento registrado exitosamente');

        } catch (error) {
            if (conn) await conn.rollback();
            console.error('Error en registrar:', error);

            
            if (req.file && req.file.path && fs.existsSync(req.file.path)) {
                try {
                    fs.unlinkSync(req.file.path);
                } catch (e) {
                    console.error('Error al eliminar archivo temporal:', e);
                }
            }

            res.redirect(`/documentos-persona?error=${encodeURIComponent(error.message || 'Error al registrar')}`);
        } finally {
            if (conn) conn.release();
        }
    },

    
    async obtenerPorId(req, res) {
        try {
            const { id } = req.params;

            const [documento] = await db.execute(`
                SELECT 
                    dp.id_documento,
                    dp.id_persona,
                    dp.id_tipo_documento,
                    dp.numero_documento,
                    dp.fecha_emision,
                    dp.fecha_vencimiento,
                    dp.observaciones,
                    dp.nombre_archivo,
                    dp.ruta_archivo,
                    CASE WHEN dp.ruta_archivo IS NOT NULL THEN TRUE ELSE FALSE END AS tiene_archivo,
                    CONCAT(p.nombres, ' ', p.apellido_paterno, ' ', IFNULL(p.apellido_materno,'')) AS persona_nombre,
                    tdp.nombre_documento AS tipo_documento_nombre
                FROM documentos_persona dp
                INNER JOIN personas p ON dp.id_persona = p.id_persona
                INNER JOIN tipo_documentos_persona tdp ON dp.id_tipo_documento = tdp.id_tipo_documento
                WHERE dp.id_documento = ?
            `, [id]);

            if (documento.length === 0) {
                return res.status(404).json({ success: false, message: 'Documento no encontrado' });
            }

            const doc = documento[0];

            
            if (doc.fecha_emision) {
                const fecha = new Date(doc.fecha_emision);
                doc.fecha_emision = fecha.toISOString().split('T')[0];
            }
            if (doc.fecha_vencimiento) {
                const fecha = new Date(doc.fecha_vencimiento);
                doc.fecha_vencimiento = fecha.toISOString().split('T')[0];
            }

            res.json({ success: true, documento: doc });

        } catch (error) {
            console.error('Error al obtener documento:', error);
            res.status(500).json({ success: false, error: 'Error al obtener el documento' });
        }
    },

    
    async descargarArchivo(req, res) {
        try {
            const { id } = req.params;

            const [documento] = await db.execute(
                'SELECT nombre_archivo, ruta_archivo FROM documentos_persona WHERE id_documento = ?',
                [id]
            );

            if (documento.length === 0 || !documento[0].ruta_archivo) {
                return res.status(404).send('Archivo no encontrado');
            }

            
            const rutaCompleta = path.join(__dirname, '../..', documento[0].ruta_archivo);

            if (!fs.existsSync(rutaCompleta)) {
                return res.status(404).send('Archivo no encontrado en el servidor');
            }

            res.download(rutaCompleta, documento[0].nombre_archivo || 'documento.pdf');

        } catch (error) {
            console.error('Error al descargar archivo:', error);
            res.status(500).send('Error al descargar el archivo');
        }
    },

    
    async verArchivo(req, res) {
        try {
            const { id } = req.params;

            const [documento] = await db.execute(
                'SELECT ruta_archivo FROM documentos_persona WHERE id_documento = ?',
                [id]
            );

            if (documento.length === 0 || !documento[0].ruta_archivo) {
                return res.status(404).send('Archivo no encontrado');
            }

            const rutaCompleta = path.join(__dirname, '../..', documento[0].ruta_archivo);

            if (!fs.existsSync(rutaCompleta)) {
                return res.status(404).send('Archivo no encontrado en el servidor');
            }

            res.sendFile(rutaCompleta);

        } catch (error) {
            console.error('Error al ver archivo:', error);
            res.status(500).send('Error al cargar el archivo');
        }
    },

    
    async eliminar(req, res) {
        let conn;
        try {
            const { id } = req.params;

            conn = await db.pool.promise().getConnection();
            await conn.beginTransaction();

            
            const [documento] = await conn.execute(
                'SELECT ruta_archivo FROM documentos_persona WHERE id_documento = ?',
                [id]
            );

            if (documento.length === 0) {
                throw new Error('Documento no encontrado');
            }

            
            if (documento[0].ruta_archivo) {
                const rutaCompleta = path.join(__dirname, '../..', documento[0].ruta_archivo);
                if (fs.existsSync(rutaCompleta)) {
                    fs.unlinkSync(rutaCompleta);
                    console.log(`Archivo eliminado: ${rutaCompleta}`);
                }
            }

            // Eliminar registro
            await conn.execute('DELETE FROM documentos_persona WHERE id_documento = ?', [id]);

            await conn.commit();

            res.json({ success: true, message: 'Documento eliminado correctamente' });

        } catch (error) {
            if (conn) await conn.rollback();
            console.error('Error en eliminar:', error);
            res.json({ success: false, error: error.message || 'No se pudo eliminar' });
        } finally {
            if (conn) conn.release();
        }
    },

    
    async exportarExcel(req, res) {
        try {
            const [documentos] = await db.query(`
                SELECT 
                    CONCAT(p.nombres, ' ', p.apellido_paterno, ' ', IFNULL(p.apellido_materno,'')) AS persona,
                    CONCAT(p.run, '-', p.dv) AS run,
                    p.cargo,
                    tdp.nombre_documento AS tipo_documento,
                    dp.numero_documento,
                    dp.fecha_emision,
                    dp.fecha_vencimiento,
                    CASE 
                        WHEN dp.fecha_vencimiento < CURDATE() THEN 'VENCIDO'
                        WHEN dp.fecha_vencimiento <= DATE_ADD(CURDATE(), INTERVAL 30 DAY) THEN 'POR VENCER'
                        ELSE 'VIGENTE'
                    END AS estado,
                    dp.observaciones,
                    CASE WHEN dp.ruta_archivo IS NOT NULL THEN 'SÍ' ELSE 'NO' END AS tiene_archivo
                FROM documentos_persona dp
                INNER JOIN personas p ON dp.id_persona = p.id_persona
                INNER JOIN tipo_documentos_persona tdp ON dp.id_tipo_documento = tdp.id_tipo_documento
                WHERE p.activo = 1
                ORDER BY dp.fecha_vencimiento ASC
            `);

            
            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('Documentos Personas');

           
            worksheet.columns = [
                { header: 'Persona', key: 'persona', width: 40 },
                { header: 'RUN', key: 'run', width: 15 },
                { header: 'Cargo', key: 'cargo', width: 25 },
                { header: 'Tipo Documento', key: 'tipo_documento', width: 25 },
                { header: 'Número', key: 'numero_documento', width: 20 },
                { header: 'Fecha Emisión', key: 'fecha_emision', width: 15 },
                { header: 'Fecha Vencimiento', key: 'fecha_vencimiento', width: 15 },
                { header: 'Estado', key: 'estado', width: 15 },
                { header: 'Observaciones', key: 'observaciones', width: 30 },
                { header: 'Tiene Archivo', key: 'tiene_archivo', width: 12 }
            ];

            
            documentos.forEach(doc => {
                worksheet.addRow({
                    persona: doc.persona,
                    run: doc.run,
                    cargo: doc.cargo || '',
                    tipo_documento: doc.tipo_documento,
                    numero_documento: doc.numero_documento,
                    fecha_emision: doc.fecha_emision ? new Date(doc.fecha_emision).toLocaleDateString('es-CL') : '',
                    fecha_vencimiento: doc.fecha_vencimiento ? new Date(doc.fecha_vencimiento).toLocaleDateString('es-CL') : '',
                    estado: doc.estado,
                    observaciones: doc.observaciones || '',
                    tiene_archivo: doc.tiene_archivo
                });
            });

            
            worksheet.getRow(1).font = { bold: true };
            worksheet.getRow(1).fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FF4472C4' }
            };
            worksheet.getRow(1).font = { color: { argb: 'FFFFFFFF' }, bold: true };

            
            const fecha = new Date().toISOString().slice(0, 10).replace(/-/g, '');
            const nombreArchivo = `documentos_personas_${fecha}.xlsx`;

            
            const excelPath = path.join(DESCARGAS_PATH, 'excel', nombreArchivo);

            
            const excelDir = path.join(DESCARGAS_PATH, 'excel');
            if (!fs.existsSync(excelDir)) {
                fs.mkdirSync(excelDir, { recursive: true });
            }

            await workbook.xlsx.writeFile(excelPath);

            
            res.download(excelPath, nombreArchivo);

        } catch (error) {
            console.error('Error al exportar Excel:', error);
            res.status(500).send('Error al exportar a Excel');
        }
    },

    
    async exportarResumen(req, res) {
        try {
            const [documentos] = await db.query(`
                SELECT 
                    tdp.nombre_documento AS tipo_documento,
                    COUNT(*) AS total,
                    SUM(CASE WHEN dp.fecha_vencimiento < CURDATE() THEN 1 ELSE 0 END) AS vencidos,
                    SUM(CASE WHEN dp.fecha_vencimiento BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 30 DAY) THEN 1 ELSE 0 END) AS por_vencer,
                    SUM(CASE WHEN dp.fecha_vencimiento > DATE_ADD(CURDATE(), INTERVAL 30 DAY) THEN 1 ELSE 0 END) AS vigentes
                FROM documentos_persona dp
                INNER JOIN tipo_documentos_persona tdp ON dp.id_tipo_documento = tdp.id_tipo_documento
                INNER JOIN personas p ON dp.id_persona = p.id_persona
                WHERE p.activo = 1
                GROUP BY tdp.nombre_documento
                ORDER BY total DESC
            `);

            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('Resumen Documentos');

            worksheet.columns = [
                { header: 'Tipo de Documento', key: 'tipo_documento', width: 30 },
                { header: 'Total', key: 'total', width: 15 },
                { header: 'Vigentes', key: 'vigentes', width: 15 },
                { header: 'Por Vencer', key: 'por_vencer', width: 15 },
                { header: 'Vencidos', key: 'vencidos', width: 15 }
            ];

            documentos.forEach(doc => {
                worksheet.addRow({
                    tipo_documento: doc.tipo_documento,
                    total: doc.total,
                    vigentes: doc.vigentes,
                    por_vencer: doc.por_vencer,
                    vencidos: doc.vencidos
                });
            });

            
            const totalGeneral = documentos.reduce((sum, doc) => sum + doc.total, 0);
            const totalVigentes = documentos.reduce((sum, doc) => sum + doc.vigentes, 0);
            const totalPorVencer = documentos.reduce((sum, doc) => sum + doc.por_vencer, 0);
            const totalVencidos = documentos.reduce((sum, doc) => sum + doc.vencidos, 0);

            worksheet.addRow({
                tipo_documento: 'TOTAL GENERAL',
                total: totalGeneral,
                vigentes: totalVigentes,
                por_vencer: totalPorVencer,
                vencidos: totalVencidos
            }).font = { bold: true };

            worksheet.getRow(1).font = { bold: true };

            const fecha = new Date().toISOString().slice(0, 10).replace(/-/g, '');
            const nombreArchivo = `resumen_documentos_personas_${fecha}.xlsx`;

            const excelPath = path.join(DESCARGAS_PATH, 'excel', nombreArchivo);

            await workbook.xlsx.writeFile(excelPath);
            res.download(excelPath, nombreArchivo);

        } catch (error) {
            console.error('Error al exportar resumen:', error);
            res.status(500).send('Error al exportar resumen');
        }
    }
};

module.exports = documentosPersonaController;