
CREATE DATABASE IF NOT EXISTS sistema_gpv;
USE sistema_gpv;

CREATE TABLE IF NOT EXISTS clientes (
    id_cliente INT AUTO_INCREMENT PRIMARY KEY,
    nombre_cliente VARCHAR(100) NOT NULL,
    rut_cliente VARCHAR(12) UNIQUE NOT NULL,
    correo_contacto VARCHAR(100),
    telefono VARCHAR(20),
    fecha_registro DATETIME DEFAULT CURRENT_TIMESTAMP,
    activo BOOLEAN DEFAULT TRUE
);
CREATE TABLE IF NOT EXISTS usuarios (
    id_usuario INT(11) NOT NULL AUTO_INCREMENT,
    id_cliente INT(11) NOT NULL,
    nombre_completo VARCHAR(100) NOT NULL,
    correo VARCHAR(100) NOT NULL,
    contrasena VARCHAR(255) NOT NULL,
    tipo_usuario ENUM('super_admin', 'admin_cliente', 'actualizador', 'visualizador') NOT NULL DEFAULT 'visualizador',
    activo TINYINT(1) DEFAULT 1,
    fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP(),
    ultimo_login DATETIME DEFAULT NULL,
    PRIMARY KEY (id_usuario),
    UNIQUE KEY (correo),
    FOREIGN KEY (id_cliente) REFERENCES clientes(id_cliente)
);
CREATE TABLE IF NOT EXISTS personas (
    id_persona INT AUTO_INCREMENT PRIMARY KEY,
    id_cliente INT NOT NULL,
    run VARCHAR(12) NOT NULL,
    dv CHAR(1) NOT NULL,
    nombres VARCHAR(100) NOT NULL,
    apellido_paterno VARCHAR(100) NOT NULL,
    apellido_materno VARCHAR(100),
    email VARCHAR(100),
    telefono VARCHAR(20),
    fecha_nacimiento DATE,
    cargo VARCHAR(100),
    activo BOOLEAN DEFAULT TRUE,
    fecha_registro DATETIME DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (id_cliente) REFERENCES clientes(id_cliente),
    UNIQUE KEY idx_run_cliente (id_cliente, run, dv)
);
CREATE TABLE IF NOT EXISTS logs_registro_cambios (
    id_log BIGINT AUTO_INCREMENT PRIMARY KEY,
    id_persona INT NOT NULL,
    id_cliente INT NOT NULL,
    operacion ENUM('INSERT', 'UPDATE', 'DELETE', 'LOGIN') NOT NULL,
    tabla_afectada VARCHAR(50) NOT NULL,
    id_registro_afectado INT NOT NULL,
    actividad TEXT NOT NULL,
    datos_anteriores JSON DEFAULT NULL,
    datos_nuevos JSON DEFAULT NULL,
    fecha_hora DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3),
    ip_origen VARCHAR(45),
    FOREIGN KEY (id_persona) REFERENCES personas(id_persona),
    FOREIGN KEY (id_cliente) REFERENCES clientes(id_cliente)
);
CREATE TABLE IF NOT EXISTS grupos (
  id_grupo INT AUTO_INCREMENT PRIMARY KEY,
  id_cliente INT NOT NULL,
  nombre_grupo VARCHAR(100) NOT NULL,
  nombre_compania VARCHAR(150),
  nombre_contacto VARCHAR(100),
  email_contacto VARCHAR(100),
  direccion VARCHAR(200),
  ciudad VARCHAR(100),
  activo BOOLEAN DEFAULT TRUE,
  fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (id_cliente) REFERENCES clientes(id_cliente)
);
CREATE TABLE IF NOT EXISTS tipos_vehiculo (
    id_tipo_vehiculo INT AUTO_INCREMENT PRIMARY KEY,
    nombre_tipo VARCHAR(50) NOT NULL,
    descripcion TEXT
);
CREATE TABLE IF NOT EXISTS vehiculos (
    id_vehiculo INT AUTO_INCREMENT PRIMARY KEY,
    id_cliente INT NOT NULL,
    patente VARCHAR(20) NOT NULL,
    marca VARCHAR(50),
    modelo VARCHAR(50),
    anio INT,
    numero_chasis VARCHAR(100),
    numero_motor VARCHAR(100),
    tipo_vehiculo INT,
    capacidad VARCHAR(50),
    color VARCHAR(30),
    activo BOOLEAN DEFAULT TRUE,
    fecha_registro DATETIME DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (id_cliente) REFERENCES clientes(id_cliente),
    FOREIGN KEY (tipo_vehiculo) REFERENCES tipos_vehiculo(id_tipo_vehiculo),
    UNIQUE KEY idx_patente_cliente (id_cliente, patente)
);
CREATE TABLE IF NOT EXISTS vehiculo_grupos (
    id_vehiculo INT NOT NULL,
    id_grupo INT NOT NULL,
    PRIMARY KEY (id_vehiculo, id_grupo),
    FOREIGN KEY (id_vehiculo) REFERENCES vehiculos(id_vehiculo),
    FOREIGN KEY (id_grupo) REFERENCES grupos(id_grupo)
);
CREATE TABLE IF NOT EXISTS tipo_documentos_persona (
    id_tipo_documento INT AUTO_INCREMENT PRIMARY KEY,
    id_cliente INT NOT NULL,
    nombre_documento VARCHAR(100) NOT NULL,
    descripcion TEXT,
    dias_alerta INT DEFAULT 30,
    obligatorio BOOLEAN DEFAULT FALSE,
    activo BOOLEAN DEFAULT TRUE,
    FOREIGN KEY (id_cliente) REFERENCES clientes(id_cliente),
    UNIQUE KEY idx_tipo_doc_cliente (id_cliente, nombre_documento)
);
CREATE TABLE IF NOT EXISTS documentos_persona (
    id_documento INT AUTO_INCREMENT PRIMARY KEY,
    id_persona INT NOT NULL,
    id_tipo_documento INT NOT NULL,
    nombre_archivo VARCHAR(255),
    ruta_archivo LONGBLOB,
    numero_documento VARCHAR(100),
    fecha_emision DATE,
    fecha_vencimiento DATE NOT NULL,
    estado ENUM('vigente', 'por_vencer', 'vencido') DEFAULT 'vigente',
    observaciones TEXT,
    fecha_subida DATETIME DEFAULT CURRENT_TIMESTAMP,
    usuario_subida INT,
    fecha_actualizacion DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (id_persona) REFERENCES personas(id_persona),
    FOREIGN KEY (id_tipo_documento) REFERENCES tipo_documentos_persona(id_tipo_documento),
    FOREIGN KEY (usuario_subida) REFERENCES usuarios(id_usuario)
);
CREATE TABLE IF NOT EXISTS mantenciones_vehiculo (
    id_mantencion INT AUTO_INCREMENT PRIMARY KEY,
    id_vehiculo INT NOT NULL,               
    tipo_mantencion VARCHAR(150) NOT NULL,   
    kilometraje INT NOT NULL,   
    horas INT NULL,             
    fecha_mantencion DATE NOT NULL,         
    costo_total DECIMAL(12, 2) DEFAULT 0.00, 
    taller_proveedor VARCHAR(255),          
    nombre_archivo VARCHAR(255),            
    ruta_archivo LONGBLOB,                  
    observaciones TEXT,                     
    fecha_registro DATETIME DEFAULT CURRENT_TIMESTAMP,
    usuario_id INT,                         
    
    CONSTRAINT fk_vehiculo_mantencion 
        FOREIGN KEY (id_vehiculo) 
        REFERENCES vehiculos(id_vehiculo) 
        ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS tipos_documento_veh (
    id_tipo_documento_veh INT AUTO_INCREMENT PRIMARY KEY,
    id_cliente INT NOT NULL,
    nombre_documento VARCHAR(100) NOT NULL,
    descripcion TEXT,
    aplica_tipo_vehiculo VARCHAR(100),
    dias_alerta INT DEFAULT 30,
    obligatorio BOOLEAN DEFAULT FALSE,
    activo BOOLEAN DEFAULT TRUE,
    FOREIGN KEY (id_cliente) REFERENCES clientes(id_cliente),
    UNIQUE KEY idx_tipo_doc_veh_cliente (id_cliente, nombre_documento)
);
CREATE TABLE IF NOT EXISTS documentos_vehiculo (
    id_documento_veh INT AUTO_INCREMENT PRIMARY KEY,
    id_vehiculo INT NOT NULL,
    id_tipo_documento_veh INT NOT NULL,
    nombre_archivo VARCHAR(255),
    ruta_archivo LONGBLOB,
    numero_documento VARCHAR(100),
    fecha_emision DATE,
    fecha_vencimiento DATE NOT NULL,
    estado ENUM('vigente', 'por_vencer', 'vencido') DEFAULT 'vigente',
    observaciones TEXT,
    fecha_subida DATETIME DEFAULT CURRENT_TIMESTAMP,
    usuario_subida INT,
    fecha_actualizacion DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (id_vehiculo) REFERENCES vehiculos(id_vehiculo),
    FOREIGN KEY (id_tipo_documento_veh) REFERENCES tipos_documento_veh(id_tipo_documento_veh),
    FOREIGN KEY (usuario_subida) REFERENCES usuarios(id_usuario)
);
CREATE TABLE IF NOT EXISTS alertas (
    id_alerta INT AUTO_INCREMENT PRIMARY KEY,
    tipo_entidad ENUM('persona', 'vehiculo') NOT NULL,
    id_entidad INT NOT NULL,
    id_documento INT,
    tipo_alerta VARCHAR(50),
    mensaje TEXT NOT NULL,
    fecha_generacion DATETIME DEFAULT CURRENT_TIMESTAMP,
    fecha_envio DATETIME,
    enviado BOOLEAN DEFAULT FALSE,
    metodo_envio ENUM('email', 'sistema', 'ambos') DEFAULT 'sistema',
    leido BOOLEAN DEFAULT FALSE
);
CREATE TABLE IF NOT EXISTS config_alertas_cliente (
    id_config INT AUTO_INCREMENT PRIMARY KEY,
    id_cliente INT NOT NULL,
    tipo_entidad ENUM('persona', 'vehiculo') NOT NULL,
    dias_preaviso INT DEFAULT 30,
    enviar_email BOOLEAN DEFAULT TRUE,
    mostrar_sistema BOOLEAN DEFAULT TRUE,
    email_notificacion VARCHAR(100),
    frecuencia_recordatorio INT DEFAULT 7,
    FOREIGN KEY (id_cliente) REFERENCES clientes(id_cliente),
    UNIQUE KEY idx_cliente_entidad (id_cliente, tipo_entidad)
);
CREATE TABLE IF NOT EXISTS persona_vehiculo (
    id_relacion INT AUTO_INCREMENT PRIMARY KEY,
    id_persona INT NOT NULL,
    id_vehiculo INT NOT NULL,
    tipo_relacion ENUM('conductor', 'propietario', 'responsable') DEFAULT 'conductor',
    fecha_asignacion DATE DEFAULT (CURRENT_DATE),
    fecha_termino DATE,
    activo BOOLEAN DEFAULT TRUE,
    FOREIGN KEY (id_persona) REFERENCES personas(id_persona),
    FOREIGN KEY (id_vehiculo) REFERENCES vehiculos(id_vehiculo),
    UNIQUE KEY idx_persona_vehiculo (id_persona, id_vehiculo, tipo_relacion)
);