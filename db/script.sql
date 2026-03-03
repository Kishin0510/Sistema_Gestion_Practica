-- Base de datos para Gestión de Personas y Vehículos con Sistema de Alertas
CREATE DATABASE IF NOT EXISTS sistema_gpv;
USE sistema_gpv;

CREATE TABLE clientes (
    id_cliente INT AUTO_INCREMENT PRIMARY KEY,
    nombre_cliente VARCHAR(100) NOT NULL,
    rut_cliente VARCHAR(12) UNIQUE NOT NULL,
    correo_contacto VARCHAR(100),
    telefono VARCHAR(20),
    fecha_registro DATETIME DEFAULT CURRENT_TIMESTAMP,
    activo BOOLEAN DEFAULT TRUE
);

CREATE TABLE usuarios (
    id_usuario INT AUTO_INCREMENT PRIMARY KEY,
    id_cliente INT NOT NULL,
    username VARCHAR(50) UNIQUE NOT NULL,
    contrasena VARCHAR(255) NOT NULL,
    correo VARCHAR(100) NOT NULL,
    nombre_completo VARCHAR(100) NOT NULL,
    tipo_usuario ENUM('admin', 'usuario') DEFAULT 'usuario',
    activo BOOLEAN DEFAULT TRUE,
    fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP,
    ultimo_login DATETIME,
    FOREIGN KEY (id_cliente) REFERENCES clientes(id_cliente)
);

CREATE TABLE personas (
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

CREATE TABLE logs_registro_cambios (
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

CREATE TABLE grupos (
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

CREATE TABLE tipo_documentos_persona (
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


CREATE TABLE documentos_persona (
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

CREATE TABLE tipos_vehiculo (
    id_tipo_vehiculo INT AUTO_INCREMENT PRIMARY KEY,
    nombre_tipo VARCHAR(50) NOT NULL,
    descripcion TEXT
);

CREATE TABLE vehiculos (
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

CREATE TABLE tipos_documento_veh (
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

CREATE TABLE documentos_vehiculo (
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

CREATE TABLE alertas (
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

CREATE TABLE config_alertas_cliente (
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

CREATE TABLE persona_vehiculo (
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