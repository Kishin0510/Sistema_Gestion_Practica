const permisoPara = (rolesPermitidos) => {
    return (req, res, next) => {
        
        if (!req.session.usuario || !req.session.usuario.id) {
            return res.redirect('/login');
        }
        
        // --- SE AGREGAN ESTOS DOS CONSOLE.LOG PARA QUE MUESTRE MENSAJES EN CASO DE NO SER EL TIPO DE USUARIO QUE ESTA INGRESANDO A LA PAGINA ---
        console.log("=== VERIFICACIÓN DE PERMISOS ===");
        console.log("Rol del usuario en sesión:", req.session.usuario.rol);
        console.log("Roles que permite esta ruta:", rolesPermitidos);

        
        if (rolesPermitidos.map(r => r.toLowerCase()).includes(req.session.usuario.rol.toLowerCase())) {
            return next();
        } else {
            return res.status(403).send(`
                <script>
                    alert("No tienes permiso para acceder a esta sección.");
                    window.history.back();
                </script>
            `);
        }
    };
};
module.exports = { permisoPara };