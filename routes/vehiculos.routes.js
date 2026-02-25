const express = require('express');
const router = express.Router();
const vehiculosController = require('../db/controllers/vehiculosController');
const ExcelJS = require('exceljs');
const conexion = require('../db/conexion');

if (!vehiculosController) {
    console.error('ERROR: No se pudo cargar el controlador de vehículos');

    router.get('/', (req, res) => {
        res.send('Error: Controlador de vehículos no disponible');
    });

} else {
    console.log('Controlador de vehículos cargado correctamente');

    router.get('/', vehiculosController.listarVehiculos);
    router.get('/agregar', vehiculosController.mostrarFormularioAgregar);
    router.post('/agregar', vehiculosController.agregarVehiculo);
    router.get('/eliminar/:id', vehiculosController.eliminarVehiculo);
    router.get('/editar/:id', vehiculosController.mostrarFormularioEditar);
    router.post('/editar/:id', vehiculosController.actualizarVehiculo);
    router.get('/exportar-excel', async (req, res) => {
        try {
            
            const [vehiculos] = await conexion.query(`
                SELECT 
                    v.*,
                    tv.nombre_tipo,
                    tv.descripcion as descripcion_tipo,
                    c.nombre_cliente,
                    c.rut_cliente,
                    c.correo_contacto,
                    c.telefono
                FROM vehiculos v
                LEFT JOIN tipos_vehiculo tv ON v.tipo_vehiculo = tv.id_tipo_vehiculo
                LEFT JOIN clientes c ON v.id_cliente = c.id_cliente
                ORDER BY v.id_vehiculo DESC
            `);

            const workbook = new ExcelJS.Workbook();
            workbook.creator = 'Sistema GPV';
            workbook.created = new Date();
            workbook.modified = new Date();

            const worksheet = workbook.addWorksheet('Vehiculos', {
                properties: { tabColor: { argb: '198754' } },
                pageSetup: { paperSize: 9, orientation: 'landscape' }
            });

            worksheet.mergeCells('A1:L1');
            const titleRow = worksheet.getCell('A1');
            titleRow.value = 'REPORTE DE VEHICULOS';
            titleRow.font = { size: 16, bold: true, color: { argb: '198754' } };
            titleRow.alignment = { horizontal: 'center', vertical: 'middle' };

            worksheet.mergeCells('A2:L2');
            const dateRow = worksheet.getCell('A2');
            dateRow.value = 'Fecha de generacion: ' + new Date().toLocaleString('es-CL');
            dateRow.font = { italic: true, size: 11 };
            dateRow.alignment = { horizontal: 'center' };

            worksheet.columns = [
                { header: 'ID', key: 'id_vehiculo', width: 8 },
                { header: 'PATENTE', key: 'patente', width: 15 },
                { header: 'MARCA', key: 'marca', width: 15 },
                { header: 'MODELO', key: 'modelo', width: 15 },
                { header: 'ANO', key: 'anio', width: 8 },
                { header: 'TIPO', key: 'tipo', width: 15 },
                { header: 'CAPACIDAD', key: 'capacidad', width: 12 },
                { header: 'COLOR', key: 'color', width: 12 },
                { header: 'CHASIS', key: 'numero_chasis', width: 20 },
                { header: 'MOTOR', key: 'numero_motor', width: 20 },
                { header: 'CLIENTE', key: 'cliente', width: 25 },
                { header: 'ESTADO', key: 'estado', width: 10 }
            ];

            const headerRow = worksheet.getRow(3);
            headerRow.font = { bold: true, color: { argb: 'FFFFFF' }, size: 12 };
            headerRow.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: '198754' }
            };
            headerRow.alignment = { horizontal: 'center', vertical: 'middle' };
            headerRow.height = 25;

            if (vehiculos && vehiculos.length > 0) {
                vehiculos.forEach(vehiculo => {
                    const nombreCliente = vehiculo.nombre_cliente || 'Sin asignar';

                    const row = worksheet.addRow({
                        id_vehiculo: vehiculo.id_vehiculo,
                        patente: vehiculo.patente,
                        marca: vehiculo.marca || 'N/A',
                        modelo: vehiculo.modelo || 'N/A',
                        anio: vehiculo.anio || 'N/A',
                        tipo: vehiculo.nombre_tipo || 'N/A',
                        capacidad: vehiculo.capacidad || 'N/A',
                        color: vehiculo.color || 'N/A',
                        numero_chasis: vehiculo.numero_chasis || 'N/A',
                        numero_motor: vehiculo.numero_motor || 'N/A',
                        cliente: nombreCliente,
                        estado: vehiculo.activo ? 'Activo' : 'Inactivo'
                    });

                    row.getCell(1).alignment = { horizontal: 'center' };
                    row.getCell(5).alignment = { horizontal: 'center' };
                    row.getCell(7).alignment = { horizontal: 'center' };
                });

                worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
                    if (rowNumber > 3) {
                        if (rowNumber % 2 === 0) {
                            row.fill = {
                                type: 'pattern',
                                pattern: 'solid',
                                fgColor: { argb: 'F8F9FA' }
                            };
                        }

                        const patenteCell = row.getCell(2);
                        patenteCell.font = { bold: true };
                        patenteCell.alignment = { horizontal: 'center' };

                        const estadoCell = row.getCell(12);
                        estadoCell.alignment = { horizontal: 'center' };
                        if (estadoCell.value === 'Activo') {
                            estadoCell.font = { color: { argb: '198754' }, bold: true };
                        } else if (estadoCell.value === 'Inactivo') {
                            estadoCell.font = { color: { argb: 'DC3545' }, bold: true };
                        }
                    }
                });

                worksheet.addRow([]);
                const totalRow = worksheet.addRow(['', '', '', '', '', '', '', '', '', '', 'TOTAL VEHICULOS:', vehiculos.length]);

                totalRow.getCell(11).font = { bold: true };
                totalRow.getCell(11).alignment = { horizontal: 'right' };
                totalRow.getCell(12).font = { bold: true, color: { argb: '198754' } };
                totalRow.getCell(12).alignment = { horizontal: 'center' };
            } else {
                worksheet.addRow(['', '', '', '', '', '', '', '', '', '', 'No hay vehiculos registrados', '']);
            }

            for (let i = 3; i <= worksheet.rowCount; i++) {
                worksheet.getRow(i).eachCell({ includeEmpty: true }, (cell) => {
                    cell.border = {
                        top: { style: 'thin' },
                        left: { style: 'thin' },
                        bottom: { style: 'thin' },
                        right: { style: 'thin' }
                    };
                });
            }

            res.setHeader(
                'Content-Type',
                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            );
            res.setHeader(
                'Content-Disposition',
                'attachment; filename=vehiculos_' + new Date().toISOString().split('T')[0] + '.xlsx'
            );

            await workbook.xlsx.write(res);
            res.end();

        } catch (error) {
            console.error('Error al exportar a Excel:', error);
            res.status(500).json({
                success: false,
                error: 'Error al generar el archivo Excel',
                detalles: error.message
            });
        }
    });
}
module.exports = router;