const db = require('../conexion');
const path = require('path');
const fs = require('fs').promises;
const multer = require('multer');

// Configuración de Multer
const storage = multer.diskStorage({
    destination: async function (req, file, cb) {
        const uploadDir = path.join(__dirname, '../public/uploads/documentos_persona');
        try {
            await fs.mkdir(uploadDir, { recursive: true });
            cb(null, uploadDir);
        } catch (error) {
            cb(error);
        }
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, `persona-${uniqueSuffix}${ext}`);
    }
});

const uploadMiddleware = multer({
    storage: storage,
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Solo se permiten archivos PDF, JPG y PNG'), false);
        }
    },
    limits: { fileSize: 10 * 1024 * 1024 }
}).single('archivo_documento');

const logError = (tag, err) => console.error(`Error en ${tag}:`, err.message || err);

const documentoPersonaController = {
    // ============================================
    // VISTA PRINCIPAL
    // ============================================
    index: async (req, res) => {
        try {
            const idCliente = req.session?.usuario?.id_cliente || 1;

            // 1. Actualizar estados de documentos
            await db.query(`
                UPDATE documentos_persona dp
                SET dp.estado = CASE
                    WHEN dp.fecha_vencimiento < CURDATE() THEN 'vencido'
                    WHEN dp.fecha_vencimiento <= DATE_ADD(CURDATE(), INTERVAL 30 DAY) THEN 'por_vencer'
                    ELSE 'vigente'
                END
            `);

            // 2. Obtener todos los documentos con información completa
            const [documentos] = await db.query(`
                SELECT 
                    dp.id_documento,
                    dp.id_persona,
                    dp.id_tipo_documento,
                    dp.numero_documento,
                    dp.fecha_emision,
                    dp.fecha_vencimiento,
                    dp.nombre_archivo,
                    dp.ruta_archivo,
                    dp.observaciones,
                    dp.fecha_subida,
                    dp.estado,
                    CONCAT(p.nombres, ' ', p.apellido_paterno) as persona_nombre_completo,
                    CONCAT(p.run, '-', p.dv) as persona_dni,
                    td.nombre_documento as tipo_documento_nombre,
                    u.nombre_completo as usuario_subida_nombre,
                    DATEDIFF(dp.fecha_vencimiento, CURDATE()) as dias_restantes
                FROM documentos_persona dp
                INNER JOIN personas p ON dp.id_persona = p.id_persona
                LEFT JOIN tipo_documentos_persona td ON dp.id_tipo_documento = td.id_tipo_documento
                LEFT JOIN usuarios u ON dp.usuario_subida = u.id_usuario
                WHERE p.id_cliente = ? AND p.activo = 1
                ORDER BY dp.fecha_vencimiento ASC, dp.fecha_subida DESC
            `, [idCliente]);

            // 3. Documentos próximos a vencer (30 días o menos)
            const [documentosProximos] = await db.query(`
                SELECT 
                    dp.id_documento,
                    dp.id_persona,
                    dp.id_tipo_documento,
                    dp.numero_documento,
                    dp.fecha_emision,
                    dp.fecha_vencimiento,
                    dp.nombre_archivo,
                    dp.ruta_archivo,
                    dp.observaciones,
                    dp.fecha_subida,
                    dp.estado,
                    CONCAT(p.nombres, ' ', p.apellido_paterno) as persona_nombre_completo,
                    CONCAT(p.run, '-', p.dv) as persona_dni,
                    td.nombre_documento as tipo_documento_nombre,
                    DATEDIFF(dp.fecha_vencimiento, CURDATE()) as dias_restantes
                FROM documentos_persona dp
                INNER JOIN personas p ON dp.id_persona = p.id_persona
                LEFT JOIN tipo_documentos_persona td ON dp.id_tipo_documento = td.id_tipo_documento
                WHERE p.id_cliente = ? 
                    AND p.activo = 1
                    AND dp.fecha_vencimiento BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 30 DAY)
                    AND dp.estado != 'vencido'
                ORDER BY dp.fecha_vencimiento ASC
            `, [idCliente]);

            // 4. Calcular estadísticas
            let totalDocumentos = 0;
            let documentosVigentes = 0;
            let documentosPorVencer = 0;
            let documentosVencidos = 0;

            documentos.forEach(doc => {
                totalDocumentos++;
                if (doc.dias_restantes > 30) {
                    documentosVigentes++;
                } else if (doc.dias_restantes > 0 && doc.dias_restantes <= 30) {
                    documentosPorVencer++;
                } else if (doc.dias_restantes <= 0) {
                    documentosVencidos++;
                }
            });

            // 5. Obtener personas activas
            const [personas] = await db.query(`
                SELECT 
                    id_persona,
                    run,
                    dv,
                    nombres,
                    apellido_paterno,
                    apellido_materno,
                    CONCAT(run, '-', dv) as dni_completo,
                    email,
                    telefono,
                    cargo
                FROM personas 
                WHERE id_cliente = ? AND activo = 1
                ORDER BY apellido_paterno, nombres
            `, [idCliente]);

            // 6. Obtener tipos de documentos activos
            let [tiposDocumentos] = await db.query(`
                SELECT 
                    id_tipo_documento,
                    nombre_documento,
                    descripcion,
                    dias_alerta,
                    obligatorio,
                    activo
                FROM tipo_documentos_persona
                WHERE id_cliente = ? AND activo = 1
                ORDER BY nombre_documento
            `, [idCliente]);

            // 7. Si no hay tipos, usar array por defecto
            if (!tiposDocumentos || tiposDocumentos.length === 0) {
                console.log('No hay tipos de documento en BD, usando array por defecto');
                tiposDocumentos = [
                    { id_tipo_documento: 1, nombre_documento: 'Cédula de Identidad', descripcion: 'Documento nacional de identidad', dias_alerta: 60, obligatorio: true },
                    { id_tipo_documento: 2, nombre_documento: 'Pasaporte', descripcion: 'Documento de viaje internacional', dias_alerta: 90, obligatorio: false },
                    { id_tipo_documento: 3, nombre_documento: 'Licencia de Conducir', descripcion: 'Permiso para conducir', dias_alerta: 30, obligatorio: false },
                    { id_tipo_documento: 4, nombre_documento: 'Certificado de Antecedentes', descripcion: 'Antecedentes penales', dias_alerta: 30, obligatorio: true },
                    { id_tipo_documento: 5, nombre_documento: 'Título Profesional', descripcion: 'Título universitario', dias_alerta: 365, obligatorio: false },
                    { id_tipo_documento: 6, nombre_documento: 'Certificado de Matrimonio', descripcion: 'Estado civil', dias_alerta: 365, obligatorio: false },
                    { id_tipo_documento: 7, nombre_documento: 'Otros', descripcion: 'Otros tipos', dias_alerta: 30, obligatorio: false }
                ];
            }

            console.log('Datos cargados:');
            console.log('- Documentos:', documentos.length);
            console.log('- Personas:', personas.length);
            console.log('- Tipos:', tiposDocumentos.length);

            // Renderizar vista con TODAS las variables necesarias
            res.render('DocumentosPersonas', {
                title: 'Gestion Documental - Personas',
                documentos: documentos,
                documentosProximos: documentosProximos,
                totalDocumentos: totalDocumentos,
                documentosVigentes: documentosVigentes,
                documentosPorVencer: documentosPorVencer,
                documentosVencidos: documentosVencidos,
                personas: personas,
                tiposDocumentos: tiposDocumentos,
                success_msg: req.query.success || null,
                error_msg: req.query.error || null,
                fecha: new Date()
            });

        } catch (error) {
            logError('INDEX', error);
            console.error('Error detallado:', error);
            
            // En caso de error, renderizar con arrays vacíos
            res.render('DocumentosPersonas', {
                title: 'Gestion Documental - Personas',
                documentos: [],
                documentosProximos: [],
                totalDocumentos: 0,
                documentosVigentes: 0,
                documentosPorVencer: 0,
                documentosVencidos: 0,
                personas: [],
                tiposDocumentos: [],
                success_msg: null,
                error_msg: 'Error al cargar los documentos: ' + error.message,
                fecha: new Date()
            });
        }
    },

    
    registrar: async (req, res) => {
        try {
            uploadMiddleware(req, res, async function (err) {
                if (err) {
                    console.error('Error en upload:', err);
                    return res.redirect('/documentos-persona?error=' + encodeURIComponent(err.message || 'Error al subir el archivo'));
                }

                const idCliente = req.session?.usuario?.id_cliente || 1;
                const usuarioId = req.session?.usuario?.id_usuario || null;

                const {
                    id_persona,
                    id_tipo_documento,
                    numero_documento,
                    fecha_emision,
                    fecha_vencimiento,
                    observaciones
                } = req.body;

                // Validaciones básicas
                if (!id_persona || !id_tipo_documento || !fecha_vencimiento) {
                    return res.redirect('/documentos-persona?error=Los campos obligatorios deben ser completados');
                }

                // Verificar que la persona existe
                const [persona] = await db.query(
                    'SELECT id_persona FROM personas WHERE id_persona = ? AND id_cliente = ? AND activo = 1',
                    [id_persona, idCliente]
                );

                if (persona.length === 0) {
                    return res.redirect('/documentos-persona?error=La persona seleccionada no existe');
                }

                // Calcular estado inicial
                const hoy = new Date();
                const vencimiento = new Date(fecha_vencimiento);
                const diffTime = vencimiento - hoy;
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                let estado = 'vigente';
                if (diffDays <= 0) {
                    estado = 'vencido';
                } else if (diffDays <= 30) {
                    estado = 'por_vencer';
                }

                // Procesar archivo
                let nombre_archivo = null;
                let ruta_archivo = null;

                if (req.file) {
                    nombre_archivo = req.file.filename;
                    ruta_archivo = '/uploads/documentos_persona/' + req.file.filename;
                }

                // Insertar documento
                await db.query(`
                    INSERT INTO documentos_persona (
                        id_persona, 
                        id_tipo_documento, 
                        nombre_archivo, 
                        ruta_archivo,
                        numero_documento, 
                        fecha_emision, 
                        fecha_vencimiento, 
                        estado,
                        observaciones, 
                        usuario_subida
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `, [
                    id_persona,
                    id_tipo_documento,
                    nombre_archivo,
                    ruta_archivo,
                    numero_documento || null,
                    fecha_emision || null,
                    fecha_vencimiento,
                    estado,
                    observaciones || null,
                    usuarioId
                ]);

                res.redirect('/documentos-persona?success=Documento registrado exitosamente');
            });
        } catch (error) {
            logError('REGISTRAR', error);
            res.redirect('/documentos-persona?error=Error al registrar el documento');
        }
    },

    
    eliminar: async (req, res) => {
        try {
            const { id } = req.params;
            const idCliente = req.session?.usuario?.id_cliente || 1;

            // Obtener información del documento
            const [documento] = await db.query(`
                SELECT dp.*, p.id_cliente 
                FROM documentos_persona dp
                INNER JOIN personas p ON dp.id_persona = p.id_persona
                WHERE dp.id_documento = ? AND p.id_cliente = ?
            `, [id, idCliente]);

            if (documento.length === 0) {
                return res.redirect('/documentos-persona?error=Documento no encontrado');
            }

            // Eliminar archivo físico si existe
            if (documento[0].ruta_archivo) {
                const filePath = path.join(__dirname, '../public', documento[0].ruta_archivo);
                try {
                    await fs.unlink(filePath);
                } catch (e) {
                    console.log('Archivo no encontrado para eliminar:', filePath);
                }
            }

            // Eliminar documento de la BD
            await db.query('DELETE FROM documentos_persona WHERE id_documento = ?', [id]);

            if (req.xhr || req.headers.accept?.includes('application/json')) {
                return res.json({ success: true, message: 'Documento eliminado exitosamente' });
            }

            res.redirect('/documentos-persona?success=Documento eliminado exitosamente');
        } catch (error) {
            logError('ELIMINAR', error);
            
            if (req.xhr || req.headers.accept?.includes('application/json')) {
                return res.status(500).json({ success: false, error: 'Error al eliminar el documento' });
            }
            
            res.redirect('/documentos-persona?error=Error al eliminar el documento');
        }
    },

    
    buscarPersonaPorRun: async (req, res) => {
        try {
            const idCliente = req.session?.usuario?.id_cliente || 1;
            const { run } = req.params;

            const [personas] = await db.query(`
                SELECT 
                    id_persona,
                    run,
                    dv,
                    nombres,
                    apellido_paterno,
                    apellido_materno,
                    CONCAT(run, '-', dv) as identificacion,
                    email,
                    telefono,
                    cargo,
                    activo
                FROM personas 
                WHERE id_cliente = ? AND activo = 1 AND run = ?
                LIMIT 1
            `, [idCliente, run]);

            if (personas.length > 0) {
                res.json({ success: true, persona: personas[0] });
            } else {
                res.json({ success: false, message: 'Persona no encontrada' });
            }
        } catch (error) {
            logError('BUSCAR_PERSONA', error);
            res.status(500).json({ success: false, message: 'Error al buscar persona' });
        }
    },

    
    apiTiposDocumentos: async (req, res) => {
        try {
            const idCliente = req.session?.usuario?.id_cliente || 1;

            const [tipos] = await db.query(`
                SELECT 
                    id_tipo_documento,
                    nombre_documento,
                    descripcion,
                    dias_alerta,
                    obligatorio
                FROM tipo_documentos_persona
                WHERE id_cliente = ? AND activo = 1
                ORDER BY nombre_documento
            `, [idCliente]);

            res.json({ success: true, tipos: tipos });
        } catch (error) {
            logError('API_TIPOS', error);
            res.status(500).json({ success: false, error: 'Error al cargar tipos de documentos' });
        }
    },

    apiDocumentosPorPersona: async (req, res) => {
        try {
            const { id_persona } = req.params;
            const idCliente = req.session?.usuario?.id_cliente || 1;

            const [documentos] = await db.query(`
                SELECT 
                    dp.id_documento,
                    dp.id_tipo_documento,
                    td.nombre_documento as tipo_documento_nombre,
                    dp.numero_documento,
                    dp.fecha_emision,
                    dp.fecha_vencimiento,
                    dp.nombre_archivo,
                    dp.ruta_archivo,
                    dp.observaciones,
                    dp.fecha_subida,
                    dp.estado,
                    DATEDIFF(dp.fecha_vencimiento, CURDATE()) as dias_restantes
                FROM documentos_persona dp
                LEFT JOIN tipo_documentos_persona td ON dp.id_tipo_documento = td.id_tipo_documento
                INNER JOIN personas p ON dp.id_persona = p.id_persona
                WHERE dp.id_persona = ? AND p.id_cliente = ?
                ORDER BY dp.fecha_vencimiento ASC
            `, [id_persona, idCliente]);

            res.json({ success: true, documentos: documentos });
        } catch (error) {
            logError('API_DOCUMENTOS_PERSONA', error);
            res.status(500).json({ success: false, error: 'Error al cargar documentos de la persona' });
        }
    },


    crearTipoDocumento: async (req, res) => {
        try {
            const idCliente = req.session?.usuario?.id_cliente || 1;
            const { nombre_tipo, descripcion, dias_alerta, obligatorio } = req.body;

            if (!nombre_tipo) {
                return res.redirect('/documentos-persona?error=El nombre del tipo de documento es obligatorio');
            }

            await db.query(`
                INSERT INTO tipo_documentos_persona 
                (id_cliente, nombre_documento, descripcion, dias_alerta, obligatorio, activo) 
                VALUES (?, ?, ?, ?, ?, 1)
            `, [idCliente, nombre_tipo, descripcion || null, dias_alerta || 30, obligatorio === 'on']);

            res.redirect('/documentos-persona?success=Tipo de documento creado exitosamente');
        } catch (error) {
            logError('CREAR_TIPO', error);
            
            if (error.code === 'ER_DUP_ENTRY') {
                res.redirect('/documentos-persona?error=Ya existe un tipo de documento con ese nombre');
            } else {
                res.redirect('/documentos-persona?error=Error al crear el tipo de documento');
            }
        }
    },

    
    descargar: async (req, res) => {
        try {
            const { id } = req.params;
            const idCliente = req.session?.usuario?.id_cliente || 1;

            const [documento] = await db.query(`
                SELECT dp.*, p.id_cliente 
                FROM documentos_persona dp
                INNER JOIN personas p ON dp.id_persona = p.id_persona
                WHERE dp.id_documento = ? AND p.id_cliente = ?
            `, [id, idCliente]);

            if (documento.length === 0 || !documento[0].ruta_archivo) {
                return res.redirect('/documentos-persona?error=Documento no encontrado');
            }

            const filePath = path.join(__dirname, '../public', documento[0].ruta_archivo);
            
            try {
                await fs.access(filePath);
                res.download(filePath, documento[0].nombre_archivo || 'documento.pdf');
            } catch {
                res.redirect('/documentos-persona?error=El archivo no existe en el servidor');
            }
        } catch (error) {
            logError('DESCARGAR', error);
            res.redirect('/documentos-persona?error=Error al descargar el documento');
        }
    }
};

module.exports = documentoPersonaController;