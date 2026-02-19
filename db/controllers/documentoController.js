require('dotenv').config();
const db = require('../conexion');
const fs = require('fs');
const path = require('path');

const logError = (tag, err) => console.error(` ${tag}`, err.message || err);

const documentoVehiculoController = {
    

    mostrarDocumentos: async (req, res) => {
        try {
            
            const [vehiculos] = await db.execute(`
                SELECT 
                    v.id_vehiculo,
                    v.patente,
                    v.marca,
                    v.modelo,
                    v.anio,
                    v.color,
                    v.capacidad,
                    c.nombre_cliente,
                    c.id_cliente
                FROM vehiculos v
                LEFT JOIN clientes c ON v.id_cliente = c.id_cliente
                WHERE v.activo = 1
                ORDER BY v.patente ASC
            `);

            // 2. Obtener tipos de documentos activos
            const [tiposDocumentos] = await db.execute(`
                SELECT 
                    id_tipo_documento_veh,
                    nombre_documento,
                    descripcion,
                    dias_alerta,
                    obligatorio,
                    activo
                FROM tipos_documento_veh 
                WHERE activo = 1
                ORDER BY nombre_documento ASC
            `);

            
            const [documentos] = await db.execute(`
                SELECT 
                    dv.id_documento_veh,
                    dv.id_vehiculo,
                    dv.id_tipo_documento_veh,
                    dv.numero_documento,
                    dv.fecha_emision,
                    dv.fecha_vencimiento,
                    dv.nombre_archivo,
                    dv.ruta_archivo,
                    dv.observaciones,
                    dv.fecha_subida,
                    dv.estado,
                    v.patente,
                    v.marca,
                    v.modelo,
                    COALESCE(td.nombre_documento, 'Sin tipo') as tipo_documento_nombre,
                    u.nombre_completo as usuario_subida_nombre
                FROM documentos_vehiculo dv
                LEFT JOIN vehiculos v ON dv.id_vehiculo = v.id_vehiculo
                LEFT JOIN tipos_documento_veh td ON dv.id_tipo_documento_veh = td.id_tipo_documento_veh
                LEFT JOIN usuarios u ON dv.usuario_subida = u.id_usuario
                ORDER BY dv.fecha_vencimiento ASC, dv.fecha_subida DESC
            `);

            
            const hoy = new Date();
            const documentosConEstado = documentos.map(doc => {
                const vencimiento = new Date(doc.fecha_vencimiento);
                const diffTime = vencimiento - hoy;
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                let estado = 'vigente';
                let estadoClass = 'success';
                let estadoBadge = 'bg-success';
                let estadoTexto = 'Vigente';

                if (diffDays <= 0) {
                    estado = 'vencido';
                    estadoClass = 'danger';
                    estadoBadge = 'bg-danger';
                    estadoTexto = 'Vencido';
                } else if (diffDays <= 7) {
                    estado = 'urgente';
                    estadoClass = 'danger';
                    estadoBadge = 'bg-danger';
                    estadoTexto = 'Urgente (≤7 días)';
                } else if (diffDays <= 30) {
                    estado = 'por_vencer';
                    estadoClass = 'warning';
                    estadoBadge = 'bg-warning text-dark';
                    estadoTexto = 'Por vencer';
                }

                return {
                    ...doc,
                    dias_restantes: diffDays,
                    estado_original: doc.estado,
                    estado_calculado: estado,
                    estado_class: estadoClass,
                    estado_badge: estadoBadge,
                    estado_texto: estadoTexto
                };
            });

            // Separar documentos próximos a vencer (30 días o menos)
            const documentosProximos = documentosConEstado.filter(doc =>
                doc.dias_restantes > 0 && doc.dias_restantes <= 30
            ).sort((a, b) => a.dias_restantes - b.dias_restantes);

            // Estadísticas
            const totalDocumentos = documentos.length;
            const documentosVigentes = documentosConEstado.filter(d => d.dias_restantes > 30).length;
            const documentosPorVencer = documentosConEstado.filter(d => d.dias_restantes > 0 && d.dias_restantes <= 30).length;
            const documentosVencidos = documentosConEstado.filter(d => d.dias_restantes <= 0).length;

            res.render('documentos', {
                title: 'Gestión Documental - Vehículos',
                layout: 'layouts/main',
                vehiculos: vehiculos,
                tiposDocumentos: tiposDocumentos,
                documentos: documentosConEstado,
                documentosProximos: documentosProximos,
                totalDocumentos: totalDocumentos,
                documentosVigentes: documentosVigentes,
                documentosPorVencer: documentosPorVencer,
                documentosVencidos: documentosVencidos,
                fecha: new Date(),
                success_msg: req.query.success || null,
                error_msg: req.query.error || null,
                // Para debugging
                debug: process.env.NODE_ENV === 'development'
            });

        } catch (err) {
            logError('MOSTRAR DOCUMENTOS', err);
            console.error('Error detallado:', err);

            res.render('documentos', {
                title: 'Gestión Documental',
                layout: 'layouts/main',
                vehiculos: [],
                tiposDocumentos: [],
                documentos: [],
                documentosProximos: [],
                totalDocumentos: 0,
                documentosVigentes: 0,
                documentosPorVencer: 0,
                documentosVencidos: 0,
                fecha: new Date(),
                error_msg: 'Error al cargar los documentos: ' + err.message,
                debug: process.env.NODE_ENV === 'development'
            });
        }
    },

    
    agregarDocumento: async (req, res) => {
        let conn;
        try {
            conn = await db.pool.promise().getConnection();
            await conn.beginTransaction();

            const {
                id_vehiculo,
                tipo_documento_nombre,
                numero_documento,
                fecha_emision,
                fecha_vencimiento,
                observaciones,
                enviar_alerta
            } = req.body;

            // Validaciones básicas
            if (!id_vehiculo || !tipo_documento_nombre || !numero_documento || !fecha_vencimiento) {
                throw new Error('Faltan campos obligatorios');
            }

            // Verificar que el vehículo existe
            const [vehiculo] = await conn.execute(
                'SELECT id_vehiculo, id_cliente FROM vehiculos WHERE id_vehiculo = ? AND activo = 1',
                [id_vehiculo]
            );

            if (vehiculo.length === 0) {
                throw new Error('El vehículo seleccionado no existe o está inactivo');
            }

            const id_cliente = vehiculo[0].id_cliente;

            // PROCESAR TIPO DE DOCUMENTO
            let id_tipo_documento_veh = null;

            // 1. Buscar si ya existe el tipo de documento por nombre
            const [tipoExistente] = await conn.execute(
                'SELECT id_tipo_documento_veh FROM tipos_documento_veh WHERE nombre_documento = ? AND activo = 1',
                [tipo_documento_nombre.trim()]
            );

            if (tipoExistente.length > 0) {
                // Usar el tipo existente
                id_tipo_documento_veh = tipoExistente[0].id_tipo_documento_veh;
            } else {
                // 2. Crear nuevo tipo de documento
                const [nuevoTipo] = await conn.execute(
                    `INSERT INTO tipos_documento_veh 
                     (id_cliente, nombre_documento, descripcion, dias_alerta, obligatorio, activo) 
                     VALUES (?, ?, ?, ?, ?, 1)`,
                    [
                        id_cliente,
                        tipo_documento_nombre.trim(),
                        'Creado automáticamente al registrar documento',
                        30, // días de alerta por defecto
                        false // no obligatorio por defecto
                    ]
                );
                id_tipo_documento_veh = nuevoTipo.insertId;

                console.log(` Nuevo tipo de documento creado: ${tipo_documento_nombre} (ID: ${id_tipo_documento_veh})`);
            }

            // Procesar archivo si existe
            let nombre_archivo = null;
            let ruta_archivo = null;

            if (req.file) {
                nombre_archivo = req.file.filename;
                ruta_archivo = `/uploads/documentos/${req.file.filename}`;
            }

            // Insertar documento (AHORA CON ID VÁLIDO)
            const [result] = await conn.execute(`
                INSERT INTO documentos_vehiculo (
                    id_vehiculo,
                    id_tipo_documento_veh,
                    numero_documento,
                    fecha_emision,
                    fecha_vencimiento,
                    nombre_archivo,
                    ruta_archivo,
                    observaciones,
                    fecha_subida,
                    usuario_subida,
                    estado
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?, 'vigente')
            `, [
                id_vehiculo,
                id_tipo_documento_veh, 
                numero_documento.trim(),
                fecha_emision || null,
                fecha_vencimiento,
                nombre_archivo,
                ruta_archivo,
                observaciones || null,
                req.session?.usuario?.id_usuario || null
            ]);

            // Si se marcó enviar alerta, crear registro en tabla alertas
            if (enviar_alerta === 'on' || enviar_alerta === 'true') {
                const diasParaVencer = Math.ceil((new Date(fecha_vencimiento) - new Date()) / (1000 * 60 * 60 * 24));

                if (diasParaVencer <= 30 && diasParaVencer > 0) {
                    await conn.execute(`
                        INSERT INTO alertas (
                            tipo_entidad,
                            id_entidad,
                            id_documento,
                            tipo_alerta,
                            mensaje,
                            fecha_generacion
                        ) VALUES (?, ?, ?, ?, ?, NOW())
                    `, [
                        'vehiculo',
                        id_vehiculo,
                        result.insertId,
                        'documento_por_vencer',
                        `Documento ${tipo_documento_nombre} N°${numero_documento} vence en ${diasParaVencer} días`
                    ]);
                }
            }

            await conn.commit();

            console.log(`Documento registrado exitosamente. ID: ${result.insertId}, Tipo: ${tipo_documento_nombre}`);

            res.redirect(`/documentos?success=Documento registrado exitosamente`);

        } catch (err) {
            if (conn) await conn.rollback();
            logError('AGREGAR DOCUMENTO', err);

            let errorMsg = 'Error al guardar el documento';
            if (err.code === 'ER_DUP_ENTRY') {
                errorMsg = 'El número de documento ya existe para este tipo';
            } else if (err.message) {
                errorMsg = err.message;
            }

            res.redirect(`/documentos?error=${encodeURIComponent(errorMsg)}`);
        } finally {
            if (conn) conn.release();
        }
    },

    // Buscar vehículo por patente (API)
    buscarVehiculoPorPatente: async (req, res) => {
        try {
            const { patente } = req.params;

            const [vehiculos] = await db.execute(`
                SELECT 
                    v.id_vehiculo,
                    v.patente,
                    v.marca,
                    v.modelo,
                    v.anio,
                    v.color,
                    v.capacidad,
                    v.activo,
                    c.nombre_cliente,
                    c.id_cliente
                FROM vehiculos v
                LEFT JOIN clientes c ON v.id_cliente = c.id_cliente
                WHERE v.patente = ? AND v.activo = 1
            `, [patente.toUpperCase()]);

            if (vehiculos.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Vehículo no encontrado'
                });
            }

            res.json({
                success: true,
                vehiculo: vehiculos[0]
            });

        } catch (err) {
            logError('BUSCAR VEHICULO POR PATENTE', err);
            res.status(500).json({
                success: false,
                error: 'Error al buscar vehículo'
            });
        }
    },

    // Obtener todos los vehículos (API)
    apiVehiculos: async (req, res) => {
        try {
            const [vehiculos] = await db.execute(`
                SELECT 
                    v.id_vehiculo,
                    v.patente,
                    v.marca,
                    v.modelo,
                    v.anio,
                    v.color,
                    v.capacidad,
                    c.nombre_cliente
                FROM vehiculos v
                LEFT JOIN clientes c ON v.id_cliente = c.id_cliente
                WHERE v.activo = 1
                ORDER BY v.patente ASC
            `);

            res.json({
                success: true,
                vehiculos: vehiculos
            });

        } catch (err) {
            logError('API VEHICULOS', err);
            res.status(500).json({
                success: false,
                error: 'Error al cargar vehículos'
            });
        }
    },

    // Obtener tipos de documento (API)
    apiTiposDocumentos: async (req, res) => {
        try {
            const [tipos] = await db.execute(`
                SELECT 
                    id_tipo_documento_veh,
                    nombre_documento,
                    descripcion
                FROM tipos_documento_veh 
                WHERE activo = 1
                ORDER BY nombre_documento ASC
            `);

            res.json({
                success: true,
                tipos: tipos
            });

        } catch (err) {
            logError('API TIPOS', err);
            res.status(500).json({
                success: false,
                error: 'Error al cargar tipos de documentos'
            });
        }
    },

    // Eliminar documento
    eliminarDocumento: async (req, res) => {
        let conn;
        try {
            const { id } = req.params;

            conn = await db.pool.promise().getConnection();
            await conn.beginTransaction();

            // Obtener información del documento
            const [documento] = await conn.execute(
                'SELECT id_vehiculo, ruta_archivo FROM documentos_vehiculo WHERE id_documento_veh = ?',
                [id]
            );

            if (documento.length === 0) {
                throw new Error('Documento no encontrado');
            }

            // Eliminar archivo físico si existe
            if (documento[0].ruta_archivo) {
                const filePath = path.join(__dirname, '../public', documento[0].ruta_archivo);
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                }
            }

            // Eliminar alertas relacionadas
            await conn.execute(
                'DELETE FROM alertas WHERE id_documento = ?',
                [id]
            );

            // Eliminar documento
            await conn.execute(
                'DELETE FROM documentos_vehiculo WHERE id_documento_veh = ?',
                [id]
            );

            await conn.commit();

            res.json({
                success: true,
                message: 'Documento eliminado exitosamente'
            });

        } catch (err) {
            if (conn) await conn.rollback();
            logError('ELIMINAR DOCUMENTO', err);
            res.status(500).json({
                success: false,
                error: err.message || 'Error al eliminar documento'
            });
        } finally {
            if (conn) conn.release();
        }
    },

    // Actualizar estado de documentos (tarea programada)
    actualizarEstadosDocumentos: async () => {
        let conn;
        try {
            conn = await db.pool.promise().getConnection();

            const hoy = new Date().toISOString().split('T')[0];

            // Actualizar documentos vencidos
            await conn.execute(`
                UPDATE documentos_vehiculo 
                SET estado = 'vencido' 
                WHERE fecha_vencimiento < ? AND estado != 'vencido'
            `, [hoy]);

            // Actualizar documentos por vencer
            await conn.execute(`
                UPDATE documentos_vehiculo 
                SET estado = 'por_vencer' 
                WHERE fecha_vencimiento BETWEEN ? AND DATE_ADD(?, INTERVAL 30 DAY)
                AND estado NOT IN ('vencido', 'por_vencer')
            `, [hoy, hoy]);

            console.log(' Estados de documentos actualizados automáticamente');

        } catch (err) {
            logError('ACTUALIZAR ESTADOS', err);
        } finally {
            if (conn) conn.release();
        }
    }
};
module.exports = documentoVehiculoController;