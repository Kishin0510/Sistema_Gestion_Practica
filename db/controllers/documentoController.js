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

            const documentosProximos = documentosConEstado.filter(doc =>
                doc.dias_restantes > 0 && doc.dias_restantes <= 30
            ).sort((a, b) => a.dias_restantes - b.dias_restantes);

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
                debug: process.env.NODE_ENV === 'development',
                // SE AGREGA USER PARA EJS
                user: req.session.usuario || req.user || null 
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
                debug: process.env.NODE_ENV === 'development',
                // SE AGREGA USER PARA EJS EN CASO DE ERROR
                user: req.session.usuario || req.user || null
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

            if (!id_vehiculo || !tipo_documento_nombre || !numero_documento || !fecha_vencimiento) {
                throw new Error('Faltan campos obligatorios');
            }

            const [vehiculo] = await conn.execute(
                'SELECT id_vehiculo, id_cliente FROM vehiculos WHERE id_vehiculo = ? AND activo = 1',
                [id_vehiculo]
            );

            if (vehiculo.length === 0) {
                throw new Error('El vehículo seleccionado no existe o está inactivo');
            }

            const id_cliente = vehiculo[0].id_cliente;

            let id_tipo_documento_veh = null;

            const [tipoExistente] = await conn.execute(
                'SELECT id_tipo_documento_veh FROM tipos_documento_veh WHERE nombre_documento = ? AND activo = 1',
                [tipo_documento_nombre.trim()]
            );

            if (tipoExistente.length > 0) {
                id_tipo_documento_veh = tipoExistente[0].id_tipo_documento_veh;
            } else {
                const [nuevoTipo] = await conn.execute(
                    `INSERT INTO tipos_documento_veh 
                     (id_cliente, nombre_documento, descripcion, dias_alerta, obligatorio, activo) 
                     VALUES (?, ?, ?, ?, ?, 1)`,
                    [
                        id_cliente,
                        tipo_documento_nombre.trim(),
                        'Creado automáticamente al registrar documento',
                        30,
                        false
                    ]
                );
                id_tipo_documento_veh = nuevoTipo.insertId;

                console.log(` Nuevo tipo de documento creado: ${tipo_documento_nombre} (ID: ${id_tipo_documento_veh})`);
            }

            let nombre_archivo = null;
            let ruta_archivo = null;

            if (req.file) {
                nombre_archivo = req.file.filename;
                ruta_archivo = `/uploads/documentos/${req.file.filename}`;
            }

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

    obtenerDocumentoPorId: async (req, res) => {
        try {
            const { id } = req.params;

            const [documento] = await db.execute(`
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
                    td.id_tipo_documento_veh as tipo_documento_id
                FROM documentos_vehiculo dv
                LEFT JOIN vehiculos v ON dv.id_vehiculo = v.id_vehiculo
                LEFT JOIN tipos_documento_veh td ON dv.id_tipo_documento_veh = td.id_tipo_documento_veh
                WHERE dv.id_documento_veh = ?
            `, [id]);

            if (documento.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Documento no encontrado'
                });
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

            res.json({
                success: true,
                documento: doc
            });

        } catch (err) {
            logError('OBTENER DOCUMENTO POR ID', err);
            res.status(500).json({
                success: false,
                error: 'Error al obtener el documento'
            });
        }
    },

    actualizarDocumento: async (req, res) => {
        let conn;
        try {
            const { id } = req.params;
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

            // Obtener el documento actual
            const [documentoActual] = await conn.execute(
                'SELECT id_vehiculo, ruta_archivo, nombre_archivo FROM documentos_vehiculo WHERE id_documento_veh = ?',
                [id]
            );

            if (documentoActual.length === 0) {
                throw new Error('Documento no encontrado');
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

            // Buscar si ya existe el tipo de documento por nombre
            const [tipoExistente] = await conn.execute(
                'SELECT id_tipo_documento_veh FROM tipos_documento_veh WHERE nombre_documento = ? AND activo = 1',
                [tipo_documento_nombre.trim()]
            );

            if (tipoExistente.length > 0) {
                id_tipo_documento_veh = tipoExistente[0].id_tipo_documento_veh;
            } else {
                // Crear nuevo tipo de documento
                const [nuevoTipo] = await conn.execute(
                    `INSERT INTO tipos_documento_veh 
                     (id_cliente, nombre_documento, descripcion, dias_alerta, obligatorio, activo) 
                     VALUES (?, ?, ?, ?, ?, 1)`,
                    [
                        id_cliente,
                        tipo_documento_nombre.trim(),
                        'Creado automáticamente al actualizar documento',
                        30,
                        false
                    ]
                );
                id_tipo_documento_veh = nuevoTipo.insertId;
            }

            // Manejo de archivos - CORREGIDO
            let nombre_archivo = documentoActual[0].nombre_archivo;
            let ruta_archivo = documentoActual[0].ruta_archivo;

            // Si se subió un archivo nuevo
            if (req.file) {
                // Eliminar archivo anterior si existe
                if (documentoActual[0].ruta_archivo) {
                    try {
                        // Construir la ruta completa del archivo anterior
                        const oldFilePath = path.join(__dirname, '../public', documentoActual[0].ruta_archivo);

                        // Verificar si el archivo existe antes de intentar eliminarlo
                        if (fs.existsSync(oldFilePath)) {
                            fs.unlinkSync(oldFilePath);
                            console.log(`Archivo anterior eliminado: ${oldFilePath}`);
                        }
                    } catch (fileErr) {
                        // Solo loguear el error pero continuar con la actualización
                        console.error('Error al eliminar archivo anterior:', fileErr.message);
                    }
                }

                // Asignar nuevo archivo
                nombre_archivo = req.file.filename;
                ruta_archivo = `/uploads/documentos/${req.file.filename}`;
            }

            // Actualizar documento
            await conn.execute(`
                UPDATE documentos_vehiculo SET
                    id_vehiculo = ?,
                    id_tipo_documento_veh = ?,
                    numero_documento = ?,
                    fecha_emision = ?,
                    fecha_vencimiento = ?,
                    nombre_archivo = ?,
                    ruta_archivo = ?,
                    observaciones = ?,
                    estado = CASE 
                        WHEN fecha_vencimiento < CURDATE() THEN 'vencido'
                        WHEN fecha_vencimiento <= DATE_ADD(CURDATE(), INTERVAL 30 DAY) THEN 'por_vencer'
                        ELSE 'vigente'
                    END
                WHERE id_documento_veh = ?
            `, [
                id_vehiculo,
                id_tipo_documento_veh,
                numero_documento.trim(),
                fecha_emision || null,
                fecha_vencimiento,
                nombre_archivo,
                ruta_archivo,
                observaciones || null,
                id
            ]);

            // Manejar alertas
            if (enviar_alerta === 'on' || enviar_alerta === 'true') {
                const diasParaVencer = Math.ceil((new Date(fecha_vencimiento) - new Date()) / (1000 * 60 * 60 * 24));

                if (diasParaVencer <= 30 && diasParaVencer > 0) {
                    // Verificar si ya existe alerta para este documento
                    const [alertaExistente] = await conn.execute(
                        'SELECT id_alerta FROM alertas WHERE id_documento = ?',
                        [id]
                    );

                    if (alertaExistente.length === 0) {
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
                            id,
                            'documento_por_vencer',
                            `Documento ${tipo_documento_nombre} N°${numero_documento} vence en ${diasParaVencer} días`
                        ]);
                    }
                }
            }

            await conn.commit();

            res.redirect(`/documentos?success=Documento actualizado exitosamente`);

        } catch (err) {
            if (conn) await conn.rollback();
            logError('ACTUALIZAR DOCUMENTO', err);

            let errorMsg = 'Error al actualizar el documento';
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

    eliminarDocumento: async (req, res) => {
        let conn;
        try {
            const { id } = req.params;

            conn = await db.pool.promise().getConnection();
            await conn.beginTransaction();

            const [documento] = await conn.execute(
                'SELECT id_vehiculo, ruta_archivo FROM documentos_vehiculo WHERE id_documento_veh = ?',
                [id]
            );

            if (documento.length === 0) {
                throw new Error('Documento no encontrado');
            }

            if (documento[0].ruta_archivo) {
                const filePath = path.join(__dirname, '../public', documento[0].ruta_archivo);
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                }
            }

            await conn.execute(
                'DELETE FROM alertas WHERE id_documento = ?',
                [id]
            );

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

    actualizarEstadosDocumentos: async () => {
        let conn;
        try {
            conn = await db.pool.promise().getConnection();

            const hoy = new Date().toISOString().split('T')[0];

            await conn.execute(`
                UPDATE documentos_vehiculo 
                SET estado = 'vencido' 
                WHERE fecha_vencimiento < ? AND estado != 'vencido'
            `, [hoy]);

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