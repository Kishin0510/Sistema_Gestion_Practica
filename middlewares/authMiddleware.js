
module.exports = {
    isAuthenticated: (req, res, next) => {
        if (req.session && req.session.usuarioId) return next();
        req.session.error = "Sesión expirada. Inicia sesión nuevamente.";
        return res.redirect('/auth/login');
    },
    permitirSolo: (...roles) => {
        return (req, res, next) => {
            if (req.session && roles.includes(req.session.rol)) return next();
            return res.redirect('/home?error=No tienes permiso para esta sección');
        };
    }
};