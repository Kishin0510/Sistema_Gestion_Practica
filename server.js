require('dotenv').config();
const express = require('express');
const path = require('path');
const session = require('express-session');
const db = require('./db/conexion');
const authController = require('./db/controllers/authController');
const app = express();
const PORT = process.env.PORT || 3000; //PUERTO DE EJECUCIÓN DEL SERVER

app.use((req, res, next) => {
    res.setHeader("Content-Security-Policy", "frame-ancestors 'self' https://pegasus73.peginstances.com");
    res.removeHeader("X-Frame-Options");
    next();
});    

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.set('trust proxy', 1);
app.use(session({
    secret: process.env.SESSION_SECRET || 'mi_secreto_vehicular',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: true,
            sameSite: 'none'
            },
    proxy: true
}));
app.use((req, res, next) => {
    res.locals.usuario = req.session.usuario || null;
    next();
});

app.use((req, res, next) => {
    req.flash = (tipo, mensaje) => {
        if (!req.session.flashData) req.session.flashData = {};
        req.session.flashData[tipo] = mensaje;
    };

    const flashMessages = req.session.flashData || {};

    res.locals.success_msg = flashMessages.success || null;
    res.locals.error_msg = flashMessages.error || null;
    res.locals.error = flashMessages.error || null;
    res.locals.success = flashMessages.success || null;
    res.locals.formData = flashMessages.formData || {};
    res.locals.usuario = req.session.usuario || null;
    delete req.session.flashData;
    next();
});
const authMiddleware = (req, res, next) => {
    if (!req.session.usuario) {
        return res.redirect('/login');
    }
    next();
};
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
// ACÁ SE CARGAN TODAS LAS RUTAS DE LA PÁGINA WEB CON SUS LISTAS, TODO!!!!
cargarRutas('Autenticación', '/auth', './routes/auth.routes');
cargarRutas('Personas', '/personas', './routes/personas.routes');
cargarRutas('Vehículos', '/vehiculos', './routes/vehiculos.routes');
cargarRutas('Documentos', '/documentos', './routes/documentos.routes');
cargarRutas('Logs', '/registro-cambios', './routes/logs.routes');
cargarRutas('Mantenciones', '/mantenciones', './routes/mantencion.routes');
cargarRutas('Alertas', '/alertas', './routes/alertas.routes');
cargarRutas('Grupos', '/grupos', './routes/grupos.routes');


app.get('/', authMiddleware, async (req, res) => {
    try {
        const [rows] = await db.query('SELECT NOW() AS fecha');

        let alertas = [];
        let totalAlertas = 0;
        let alertasNoLeidas = 0;
        let alertasLeidas = 0;

        if (req.session.usuario && req.session.usuario.rol === 'admin_cliente') {
            const [alertasRows] = await db.query(`
                SELECT 
                    id_alerta,
                    tipo_entidad,
                    id_entidad,
                    id_documento,
                    tipo_alerta,
                    mensaje,
                    fecha_generacion,
                    fecha_envio,
                    enviado,
                    metodo_envio,
                    leido
                FROM alertas
                ORDER BY leido ASC, fecha_generacion DESC
                LIMIT 10
            `);

            alertas = alertasRows;
            totalAlertas = alertasRows.length;
            alertasNoLeidas = alertasRows.filter(a => !a.leido).length;
            alertasLeidas = alertasRows.filter(a => !!a.leido).length;
        }

        res.render('Home', {
            title: 'Inicio',
            fecha: rows[0].fecha,
            usuario: req.session.usuario,
            alertas,
            totalAlertas,
            alertasNoLeidas,
            alertasLeidas
        });
    } catch (error) {
        console.error('Error al cargar Home:', error);

        res.render('Home', {
            title: 'Inicio',
            fecha: new Date(),
            usuario: req.session.usuario,
            alertas: [],
            totalAlertas: 0,
            alertasNoLeidas: 0,
            alertasLeidas: 0
        });
    }
});
app.get('/login', (req, res) => {
    if (req.session.usuario) return res.redirect('/');
    res.render('Login', {
        title: 'Iniciar Sesión | Registrarse',
        error: null,
        success: null
    });
});
app.get('/documentos-personas', authMiddleware, async (req, res) => {
    res.render('DocumentosPersonas', {
        title: 'Gestión Documental - Personas',
        currentRoute: '/documentos-personas',
        usuario: req.session.usuario
    });
});
app.get('/grupos/crear', authMiddleware, async (req, res) => {
    try {
        const [clientes] = await db.query('SELECT id_cliente, nombre_cliente as nombre FROM clientes WHERE activo = 1');
        const [personas] = await db.query('SELECT id_persona, run, nombres FROM personas WHERE activo = 1');

        res.render('AgregarGrupo', {
            title: 'Registrar Grupo',
            clientes: clientes,
            personas: personas,
            hayClientes: clientes.length > 0,
            usuario: req.session.usuario
        });
    } catch (error) {
        console.error(error);
        res.status(500).send('Error al cargar el formulario de grupos');
    }
});
app.post('/grupos/crear', authMiddleware, async (req, res) => {
    let { id_cliente, nombre_grupo, nombre_compania, nombre_contacto, email_contacto, direccion, ciudad, activo } = req.body;

    try {
        if (!id_cliente || id_cliente === "0") {
            const [nuevoCliente] = await db.query(
                'INSERT INTO clientes (nombre_cliente, activo) VALUES (?, 1)',
                ['Cliente General Automático']
            );
            id_cliente = nuevoCliente.insertId;
        }
        //QUERY QUE PERMITE AGREGAR GRUPOS ALA BASE DE DATOS TOMANDO TODOS LOS DATOS ANTES DE PROCESAR
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
app.get('/grupos', authMiddleware, async (req, res) => {
    try {
        const [grupos] = await db.query(`
            SELECT g.*, c.nombre_cliente 
            FROM grupos g
            LEFT JOIN clientes c ON g.id_cliente = c.id_cliente
            ORDER BY g.fecha_creacion DESC
        `);

        const cliente_nombre = {};
        grupos.forEach(grupo => {
            if (grupo.nombre_cliente) {
                cliente_nombre[grupo.id_cliente] = grupo.nombre_cliente;
            }
        });

        res.render('listaGrupos', {
            title: 'Mis Grupos',
            grupos: grupos,
            cliente_nombre: cliente_nombre,
            usuario: req.session.usuario
        });

    } catch (error) {
        console.error('Error al obtener grupos:', error);
        req.flash('error', 'Error al cargar los grupos');
        res.redirect('/');
    }
});
const documentosPersonaRoutes = require('./routes/documentos_personas.routes');
app.use('/documentos-persona', documentosPersonaRoutes);
app.use((req, res) => {
    res.status(404).render('Home', {
        title: 'Página no encontrada',
        error_msg: 'La ruta solicitada no existe.',
        fecha: new Date(),
        usuario: req.session.usuario
    });
});
//ACA TOMA EL PUERTO POR EL CUAL SE TIENE QUE SI O SI ACCEDER AL SISTEMA EL CUAL ARRIBA ESTA FIJADO PUERTO 3000
app.listen(PORT, () => {
    console.log('='.repeat(50));
    console.log(` Servidor corriendo en: http://localhost:${PORT}`);
    console.log('='.repeat(50));
});
