const express = require('express');
const router = express.Router();
const vehiculosController = require('../db/controllers/vehiculosController');

// Verificar que el controlador se cargó correctamente
if (!vehiculosController) {
    console.error(' ERROR: No se pudo cargar el controlador de vehículos');
    // Rutas de emergencia
    router.get('/', (req, res) => {
        res.send('Error: Controlador de vehículos no disponible');
    });
} else {
    console.log(' Controlador de vehículos cargado correctamente');
    // Ruta principal para listar vehículos
    router.get('/', vehiculosController.listarVehiculos);
    router.get('/agregar', vehiculosController.mostrarFormularioAgregar);
    router.post('/agregar', vehiculosController.agregarVehiculo);
    router.get('/eliminar/:id', vehiculosController.eliminarVehiculo);
    router.get('/editar/:id', vehiculosController.mostrarFormularioEditar);
    router.post('/editar/:id', vehiculosController.actualizarVehiculo);
}

module.exports = router;