const permisoPara = (rolesPermitidos) => {
    return (req, res, next) => {
        if (!req.session.usuarioId) {
            return res.redirect('/login');
        }
        
        if (rolesPermitidos.includes(req.session.rol)) {
            return next();
        } else {
            return res.status(403).render('error', { 
                mensaje: 'No tienes permiso para acceder a esta sección.' 
            });
        }
    };
};

module.exports = { permisoPara };