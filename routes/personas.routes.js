const express = require('express');
const router = express.Router();
const personasController = require('../db/controllers/personasController');
const ExcelJS = require('exceljs');
const conexion = require('../db/conexion');

// Ruta para listar personas
router.get('/', personasController.listarPersonas);
router.get('/agregar', personasController.mostrarFormularioAgregar);
router.post('/agregar', personasController.agregarPersona);
router.get('/editar/:id', personasController.mostrarFormularioEditar);
router.post('/editar/:id', personasController.actualizarPersona);
router.get('/eliminar/:id', personasController.eliminarPersona);
router.get('/exportar-excel', async (req, res) => {
    try {
        // Obtener personas - SIN la referencia a grupos
        const [personas] = await conexion.query(`
            SELECT 
                p.*
            FROM personas p
            ORDER BY p.id_persona DESC
        `);

        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'Sistema GPV';
        workbook.created = new Date();
        workbook.modified = new Date();

        const worksheet = workbook.addWorksheet('Personas', {
            properties: { tabColor: { argb: '0D6EFD' } },
            pageSetup: { paperSize: 9, orientation: 'landscape' }
        });

        // Título
        worksheet.mergeCells('A1:J1');
        const titleRow = worksheet.getCell('A1');
        titleRow.value = 'REPORTE DE PERSONAS';
        titleRow.font = { size: 16, bold: true, color: { argb: '0D6EFD' } };
        titleRow.alignment = { horizontal: 'center', vertical: 'middle' };

        // Fecha de generación
        worksheet.mergeCells('A2:J2');
        const dateRow = worksheet.getCell('A2');
        dateRow.value = 'Fecha de generación: ' + new Date().toLocaleString('es-CL');
        dateRow.font = { italic: true, size: 11 };
        dateRow.alignment = { horizontal: 'center' };

        // Definir columnas - SIN la columna de GRUPO
        worksheet.columns = [
            { header: 'ID', key: 'id_persona', width: 8 },
            { header: 'NOMBRES', key: 'nombres', width: 20 },
            { header: 'APELLIDO PATERNO', key: 'apellido_paterno', width: 20 },
            { header: 'APELLIDO MATERNO', key: 'apellido_materno', width: 20 },
            { header: 'RUN', key: 'run', width: 15 },
            { header: 'TELÉFONO', key: 'telefono', width: 15 },
            { header: 'EMAIL', key: 'email', width: 25 },
            { header: 'DIRECCIÓN', key: 'direccion', width: 25 },
            { header: 'ESTADO', key: 'estado', width: 10 }
        ];

        // Estilo del encabezado
        const headerRow = worksheet.getRow(3);
        headerRow.font = { bold: true, color: { argb: 'FFFFFF' }, size: 12 };
        headerRow.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: '0D6EFD' }
        };
        headerRow.alignment = { horizontal: 'center', vertical: 'middle' };
        headerRow.height = 25;

        if (personas && personas.length > 0) {
            personas.forEach(persona => {
                const row = worksheet.addRow({
                    id_persona: persona.id_persona,
                    nombres: persona.nombres || 'N/A',
                    apellido_paterno: persona.apellido_paterno || 'N/A',
                    apellido_materno: persona.apellido_materno || 'N/A',
                    run: persona.run || 'N/A',
                    telefono: persona.telefono || 'N/A',
                    email: persona.email || 'N/A',
                    direccion: persona.direccion || 'N/A',
                    estado: persona.activo ? 'Activo' : 'Inactivo'
                });

                // Centrar algunas columnas
                row.getCell(1).alignment = { horizontal: 'center' };
                row.getCell(5).alignment = { horizontal: 'center' };
                row.getCell(6).alignment = { horizontal: 'center' };
                row.getCell(9).alignment = { horizontal: 'center' };
            });

            // Aplicar estilos a las filas de datos
            worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
                if (rowNumber > 3) {
                    // Zebra striping
                    if (rowNumber % 2 === 0) {
                        row.fill = {
                            type: 'pattern',
                            pattern: 'solid',
                            fgColor: { argb: 'F8F9FA' }
                        };
                    }

                    // Estilo para el estado
                    const estadoCell = row.getCell(9);
                    if (estadoCell.value === 'Activo') {
                        estadoCell.font = { color: { argb: '198754' }, bold: true };
                    } else if (estadoCell.value === 'Inactivo') {
                        estadoCell.font = { color: { argb: 'DC3545' }, bold: true };
                    }
                }
            });

            // Fila de total
            worksheet.addRow([]);
            const totalRow = worksheet.addRow(['', '', '', '', '', '', '', '', 'TOTAL PERSONAS:', personas.length]);
            totalRow.getCell(8).font = { bold: true };
            totalRow.getCell(8).alignment = { horizontal: 'right' };
            totalRow.getCell(9).font = { bold: true, color: { argb: '0D6EFD' } };
            totalRow.getCell(9).alignment = { horizontal: 'center' };
        } else {
            worksheet.addRow(['', '', '', '', '', '', '', '', 'No hay personas registradas', '']);
        }

        // Agregar bordes a todas las celdas
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
            'attachment; filename=personas_' + new Date().toISOString().split('T')[0] + '.xlsx'
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

module.exports = router;