require('dotenv').config();
const express = require('express');
const path = require('path');
const session = require('express-session');
const flash = require('connect-flash');
const db = require('./db/conexion');

const app = express();
const PORT = process.env.PORT || 3000;



// --- Middlewares Base ---
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Configuración de sesión
app.use(session({
    secret: process.env.SESSION_SECRET || 'mi_secreto_vehicular',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }
}));

app.use(flash());

// --- 1. CONFIGURACIÓN DE VARIABLES GLOBALES (CRUCIAL) ---
// Debe ir antes de cualquier ruta
app.use((req, res, next) => {
    res.locals.success_msg = req.flash('success');
    res.locals.error_msg = req.flash('error');

    // Persistencia de formulario y alertas
    res.locals.formData = req.flash('formData')[0] || {};
    res.locals.error = req.flash('error');
    res.locals.success = req.flash('success');

    res.locals.usuario = req.session.usuario || null;
    next();
});

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));


const cargarRutas = (nombre, ruta, pathArchivo) => {
    try {
        const router = require(pathArchivo);
        app.use(ruta, router);
        console.log(` Rutas de ${nombre} cargadas en ${ruta}`);
    } catch (error) {
        console.error(` Error al cargar rutas de ${nombre}:`, error.message);
    }
};

// Carga las rutas de personas (aquí se define /personas)
cargarRutas('Personas', '/personas', './routes/personas.routes');
cargarRutas('Vehículos', '/vehiculos', './routes/vehiculos.routes');
cargarRutas('Documentos', '/documentos', './routes/documentos.routes');

// --- 3. RUTAS DE VISTA DIRECTAS ---

// Home
app.get('/', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT NOW() AS fecha');
        res.render('Home', { title: 'Inicio', fecha: rows[0].fecha });
    } catch (error) {
        res.render('Home', { title: 'Inicio', fecha: new Date() });
    }
});
// Ruta para mostrar la página de login/registro
app.get('/login', async (req, res) => {
    try {

        res.render('Login', {
            title: 'Iniciar Sesión | Registrarse',
            messages: req.flash ? req.flash() : {} // Si usas connect-flash
        });
    } catch (error) {
        console.error('Error al cargar la página de login:', error);
        res.render('LoginRegister', {
            title: 'Iniciar Sesión | Registrarse',
            messages: { error: 'Error al cargar la página' }
        });
    }
});

app.get('/documentos-personas', async (req, res) => {
    // ... tu lógica existente
    res.render('DocumentosPersonas', {
        title: 'Gestión Documental - Personas',
        currentRoute: '/documentos-personas', // ← Agrega esto
        // ... tus otras variables
    });
});

// GET: Formulario Agregar Grupo para agregar a la bd
app.get('/grupos/crear', async (req, res) => {
    try {
        const [clientes] = await db.query('SELECT id_cliente, nombre_cliente as nombre FROM clientes WHERE activo = 1');
        const [personas] = await db.query('SELECT id_persona, run, nombres FROM personas WHERE activo = 1');

        res.render('AgregarGrupo', {
            title: 'Registrar Grupo',
            clientes: clientes,
            personas: personas,
            hayClientes: clientes.length > 0
        });
    } catch (error) {
        console.error(error);
        res.status(500).send('Error al cargar el formulario de grupos');
    }
});

// POST: Procesar el guardado de Grupo y Redirigir al Home de la aplicación una vez creado el grupo en la base de datos
app.post('/grupos/crear', async (req, res) => {
    let { id_cliente, nombre_grupo, nombre_compania, nombre_contacto, email_contacto, direccion, ciudad, activo } = req.body;

    try {
        // Lógica de Cliente Automático
        if (!id_cliente || id_cliente === "0") {
            const [nuevoCliente] = await db.query(
                'INSERT INTO clientes (nombre_cliente, activo) VALUES (?, 1)',
                ['Cliente General Automático']
            );
            id_cliente = nuevoCliente.insertId;
        }

        await db.query(`
            INSERT INTO grupos 
            (id_cliente, nombre_grupo, nombre_compania, nombre_contacto, email_contacto, direccion, ciudad, activo)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [id_cliente, nombre_grupo, nombre_compania, nombre_contacto, email_contacto, direccion, ciudad, activo === '1' ? 1 : 0]);

        req.flash('success', '¡Grupo y Cliente registrados correctamente!');
        res.redirect('/');

    } catch (error) {
        console.error(error);
        req.flash('error', 'Error al guardar el grupo: ' + error.message);
        req.flash('formData', req.body);
        res.redirect('/grupos/crear');
    }
});

try {
    const documentosPersonaRoutes = require('./routes/documentos_personas.routes');
    app.use('/documentos-persona', documentosPersonaRoutes);
    console.log('Rutas de Documentos de Personas cargadas en /documentos-persona');
} catch (error) {
    console.error(' Error al cargar rutas de Documentos de Personas:', error.message);
}

// RUTA MANEJRA ERRORES (SIEMPRE AL FINAL)
app.use((req, res) => {
    res.status(404).render('Home', {
        title: 'Página no encontrada',
        error_msg: 'La ruta solicitada no existe.',
        fecha: new Date()
    });
});

// RUTA MANEJRA ERRORES
app.use((req, res) => {
    res.status(404).render('Home', {
        title: 'Página no encontrada',
        error_msg: 'La ruta solicitada no existe.',
        fecha: new Date()
    });
});


// Iniciar servidor
app.listen(PORT, () => {
    console.log('='.repeat(50));
    console.log(` Servidor: http://localhost:${PORT}`);
    console.log('='.repeat(50));
});