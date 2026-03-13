-- Migración Inicial V2 - PROGRAMACION CORAZA CTA

-- Habilitar extensión para UUIDs automáticos
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enum para estados de vigilante
CREATE TYPE estado_vigilante AS ENUM (
  'Disponible', 'En Turno', 'Próximo a Turno', 'Límite Horas', 'En Vacaciones', 'Incapacidad', 'Permiso', 'Inactivo'
);

-- Tabla de Empresas Cliente (Coraza, etc.)
CREATE TABLE public.empresas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nombre_comercial VARCHAR(255) NOT NULL,
    nit VARCHAR(50) UNIQUE NOT NULL,
    estado VARCHAR(20) DEFAULT 'Activo' CHECK (estado IN ('Activo', 'Inactivo', 'Suspendido')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Configuración específica de cada empresa
CREATE TABLE public.configuracion_empresa (
    empresa_id UUID PRIMARY KEY REFERENCES public.empresas(id) ON DELETE CASCADE,
    horas_mes_base INTEGER DEFAULT 240,
    alerta_roja_horas INTEGER DEFAULT 230,
    alerta_amarilla_horas INTEGER DEFAULT 200,
    dias_aviso_vacaciones INTEGER DEFAULT 30,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de Usuarios del Sistema (Coordinadores, Admins)
CREATE TABLE public.usuarios (
    id UUID PRIMARY KEY, -- Mapeado a auth.users de Supabase
    empresa_id UUID REFERENCES public.empresas(id) ON DELETE SET NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    nombre_completo VARCHAR(255) NOT NULL,
    rol VARCHAR(50) NOT NULL DEFAULT 'coordinador',
    estado VARCHAR(20) DEFAULT 'Activo' CHECK (estado IN ('Activo', 'Inactivo')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tipos de Turnos Configurables
CREATE TABLE public.tipos_turno (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    empresa_id UUID REFERENCES public.empresas(id) ON DELETE CASCADE,
    codigo VARCHAR(20) NOT NULL,
    descripcion VARCHAR(255) NOT NULL,
    hora_inicio TIME NOT NULL,
    hora_fin TIME NOT NULL,
    horas_totales DECIMAL(4,2) NOT NULL,
    es_nocturno BOOLEAN DEFAULT false,
    color_hex VARCHAR(7) DEFAULT '#137fec',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(empresa_id, codigo)
);

-- Zonas/Ciudades Operativas
CREATE TABLE public.zonas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    empresa_id UUID REFERENCES public.empresas(id) ON DELETE CASCADE,
    nombre VARCHAR(100) NOT NULL,
    codigo VARCHAR(20),
    descripcion TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de Puestos (Locaciones de los clientes)
CREATE TABLE public.puestos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    empresa_id UUID REFERENCES public.empresas(id) ON DELETE CASCADE,
    zona_id UUID REFERENCES public.zonas(id) ON DELETE RESTRICT,
    nombre VARCHAR(255) NOT NULL,
    direccion VARCHAR(255),
    latitud DECIMAL(10,8),
    longitud DECIMAL(11,8),
    cliente_contacto VARCHAR(255),
    telefono_contacto VARCHAR(50),
    estado VARCHAR(20) DEFAULT 'Activo' CHECK (estado IN ('Activo', 'Inactivo', 'Suspendido')),
    requerimiento_hombres INTEGER DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tabla Central de Vigilantes
CREATE TABLE public.vigilantes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    empresa_id UUID REFERENCES public.empresas(id) ON DELETE CASCADE,
    cedula VARCHAR(20) UNIQUE NOT NULL,
    nombres VARCHAR(100) NOT NULL,
    apellidos VARCHAR(100) NOT NULL,
    telefono VARCHAR(20),
    telefono_emergencia VARCHAR(20),
    direccion VARCHAR(255),
    fecha_nacimiento DATE,
    fecha_ingreso DATE NOT NULL,
    tipo_sangre VARCHAR(5),
    estado_actual estado_vigilante DEFAULT 'Disponible',
    puesto_actual_id UUID REFERENCES public.puestos(id) ON DELETE SET NULL,
    observaciones TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tabla Core Transaccional: Programación de Turnos
CREATE TABLE public.turnos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    empresa_id UUID REFERENCES public.empresas(id) ON DELETE CASCADE,
    vigilante_id UUID REFERENCES public.vigilantes(id) ON DELETE CASCADE,
    puesto_id UUID REFERENCES public.puestos(id) ON DELETE CASCADE,
    tipo_turno_id UUID REFERENCES public.tipos_turno(id) ON DELETE RESTRICT,
    fecha_fecha DATE NOT NULL,
    fecha_hora_inicio TIMESTAMP WITH TIME ZONE,
    fecha_hora_fin TIMESTAMP WITH TIME ZONE,
    estado VARCHAR(20) DEFAULT 'Programado' CHECK (estado IN ('Programado', 'En Curso', 'Completado', 'Cancelado', 'Falla')),
    creado_por UUID REFERENCES public.usuarios(id),
    observaciones TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Eventos de Personal (Afectan la disponibilidad y el motor de estados)
CREATE TABLE public.eventos_personal (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    empresa_id UUID REFERENCES public.empresas(id) ON DELETE CASCADE,
    vigilante_id UUID REFERENCES public.vigilantes(id) ON DELETE CASCADE,
    tipo_evento VARCHAR(50) NOT NULL CHECK (tipo_evento IN ('Vacaciones', 'Incapacidad', 'Permiso', 'Suspension', 'Retiro')),
    fecha_inicio DATE NOT NULL,
    fecha_fin DATE NOT NULL,
    estado VARCHAR(20) DEFAULT 'Aprobado' CHECK (estado IN ('Solicitado', 'Aprobado', 'Rechazado', 'Ejecutado', 'Cancelado')),
    documento_soporte_url VARCHAR(500),
    observaciones TEXT,
    creado_por UUID REFERENCES public.usuarios(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fecha_valida CHECK (fecha_fin >= fecha_inicio)
);

-- Registro Central de Alertas e Inteligencia Predictiva
CREATE TABLE public.novedades (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    empresa_id UUID REFERENCES public.empresas(id) ON DELETE CASCADE,
    vigilante_id UUID REFERENCES public.vigilantes(id) ON DELETE SET NULL,
    puesto_id UUID REFERENCES public.puestos(id) ON DELETE SET NULL,
    tipo VARCHAR(50) NOT NULL CHECK (tipo IN ('Alerta Predictiva', 'Incidente Operativo', 'Falla Asistencia', 'Auditoria')),
    gravedad VARCHAR(20) NOT NULL CHECK (gravedad IN ('Baja', 'Media', 'Alta', 'Critica')),
    titulo VARCHAR(255) NOT NULL,
    descripcion TEXT,
    estado VARCHAR(20) DEFAULT 'Abierta' CHECK (estado IN ('Abierta', 'En Revision', 'Cerrada')),
    datos_extra JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Historial de Motor de Estados
CREATE TABLE public.historial_estados_vigilante (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    vigilante_id UUID REFERENCES public.vigilantes(id) ON DELETE CASCADE,
    estado_anterior estado_vigilante,
    estado_nuevo estado_vigilante NOT NULL,
    motivo_cambio VARCHAR(255) NOT NULL,
    origen VARCHAR(50) DEFAULT 'motor-estados',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

---------------------------------------------------------------------------
-- TRIGGERS PARA ACTUALIZAR updated_at
---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_timestamp_empresas BEFORE UPDATE ON public.empresas FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();
CREATE TRIGGER set_timestamp_configuracion_empresa BEFORE UPDATE ON public.configuracion_empresa FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();
CREATE TRIGGER set_timestamp_usuarios BEFORE UPDATE ON public.usuarios FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();
CREATE TRIGGER set_timestamp_puestos BEFORE UPDATE ON public.puestos FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();
CREATE TRIGGER set_timestamp_vigilantes BEFORE UPDATE ON public.vigilantes FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();
CREATE TRIGGER set_timestamp_turnos BEFORE UPDATE ON public.turnos FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();
CREATE TRIGGER set_timestamp_eventos BEFORE UPDATE ON public.eventos_personal FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();
CREATE TRIGGER set_timestamp_novedades BEFORE UPDATE ON public.novedades FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();

---------------------------------------------------------------------------
-- VISTAS
---------------------------------------------------------------------------
-- Vista para el reporte consolidado de horas mensuales
CREATE OR REPLACE VIEW vista_horas_mensuales AS
SELECT 
    v.id AS vigilante_id,
    v.cedula,
    v.nombres || ' ' || v.apellidos AS nombre_completo,
    v.empresa_id,
    EXTRACT(YEAR FROM t.fecha_fecha) AS anio,
    EXTRACT(MONTH FROM t.fecha_fecha) AS mes,
    SUM(tt.horas_totales) AS total_horas_programadas
FROM 
    public.vigilantes v
JOIN 
    public.turnos t ON v.id = t.vigilante_id
JOIN 
    public.tipos_turno tt ON t.tipo_turno_id = tt.id
WHERE 
    t.estado IN ('Programado', 'En Curso', 'Completado')
GROUP BY 
    v.id, v.cedula, v.nombres, v.apellidos, v.empresa_id, EXTRACT(YEAR FROM t.fecha_fecha), EXTRACT(MONTH FROM t.fecha_fecha);
