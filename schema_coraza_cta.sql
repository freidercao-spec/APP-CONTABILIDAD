-- ============================================
-- SCHEMA COMPLETO CORAZA CTA
-- Pegar en: supabase.com → SQL Editor → Run
-- ============================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- EMPRESAS
CREATE TABLE IF NOT EXISTS public.empresas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nombre_comercial VARCHAR(255) NOT NULL,
    nit VARCHAR(50) UNIQUE NOT NULL,
    estado VARCHAR(20) DEFAULT 'Activo',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- PUESTOS
CREATE TABLE IF NOT EXISTS public.puestos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    empresa_id UUID REFERENCES public.empresas(id) ON DELETE CASCADE,
    nombre VARCHAR(255) NOT NULL,
    tipo VARCHAR(50) DEFAULT 'edificio',
    codigo TEXT,
    direccion VARCHAR(255),
    latitud DECIMAL(10,8),
    longitud DECIMAL(11,8),
    contacto VARCHAR(255),
    telefono VARCHAR(50),
    estado VARCHAR(20) DEFAULT 'activo',
    prioridad VARCHAR(20) DEFAULT 'media',
    zona TEXT,
    numero_contrato TEXT,
    cliente TEXT,
    tipo_servicio TEXT,
    con_armamento BOOLEAN DEFAULT false,
    requisitos TEXT,
    instrucciones TEXT,
    turnos_config JSONB DEFAULT '[]',
    jornadas_custom JSONB DEFAULT '[]',
    plantilla_recurrente JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- AUTO-CÓDIGO para puestos
CREATE OR REPLACE FUNCTION set_puesto_codigo()
RETURNS TRIGGER AS $$
DECLARE v_num INT;
BEGIN
  SELECT COUNT(*) + 1 INTO v_num FROM public.puestos WHERE empresa_id = NEW.empresa_id;
  NEW.codigo := 'MED-' || LPAD(v_num::TEXT, 4, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_puesto_codigo ON public.puestos;
CREATE TRIGGER trg_puesto_codigo BEFORE INSERT ON public.puestos
  FOR EACH ROW WHEN (NEW.codigo IS NULL) EXECUTE FUNCTION set_puesto_codigo();

-- VIGILANTES
CREATE TABLE IF NOT EXISTS public.vigilantes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    empresa_id UUID REFERENCES public.empresas(id) ON DELETE CASCADE,
    codigo TEXT,
    nombre TEXT,
    nombres TEXT,
    apellidos TEXT,
    cedula TEXT,
    documento TEXT,
    telefono TEXT,
    estado TEXT DEFAULT 'Disponible',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- TURNOS PUESTO
CREATE TABLE IF NOT EXISTS public.turnos_puesto (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    empresa_id UUID REFERENCES public.empresas(id),
    puesto_id UUID REFERENCES public.puestos(id) ON DELETE CASCADE,
    vigilante_id UUID REFERENCES public.vigilantes(id) ON DELETE CASCADE,
    hora_inicio TEXT,
    hora_fin TEXT,
    dia TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- HISTORIAL PUESTO
CREATE TABLE IF NOT EXISTS public.historial_puesto (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    puesto_id UUID REFERENCES public.puestos(id) ON DELETE CASCADE,
    accion TEXT,
    vigilante_id UUID,
    detalles TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- PROGRAMACIONES MENSUALES
CREATE TABLE IF NOT EXISTS public.programaciones_mensuales (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    empresa_id UUID REFERENCES public.empresas(id) ON DELETE CASCADE,
    puesto_id UUID REFERENCES public.puestos(id) ON DELETE CASCADE,
    anio INTEGER NOT NULL,
    mes INTEGER NOT NULL CHECK (mes >= 0 AND mes <= 11),
    estado VARCHAR(20) DEFAULT 'borrador',
    personal JSONB DEFAULT '[]',
    version INTEGER DEFAULT 1,
    historial_cambios JSONB DEFAULT '[]',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(empresa_id, puesto_id, anio, mes)
);

-- ASIGNACIONES
CREATE TABLE IF NOT EXISTS public.asignaciones_programacion (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    programacion_id UUID REFERENCES public.programaciones_mensuales(id) ON DELETE CASCADE,
    empresa_id UUID REFERENCES public.empresas(id),
    dia INTEGER NOT NULL CHECK (dia >= 1 AND dia <= 31),
    vigilante_id UUID REFERENCES public.vigilantes(id) ON DELETE SET NULL,
    rol VARCHAR(100) NOT NULL,
    turno VARCHAR(20) DEFAULT 'AM',
    jornada VARCHAR(50) DEFAULT 'sin_asignar',
    codigo_personalizado TEXT,
    inicio TEXT,
    fin TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(programacion_id, dia, rol)
);

-- AUDIT LOGS
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    empresa_id UUID,
    modulo TEXT,
    accion TEXT,
    descripcion TEXT,
    nivel TEXT DEFAULT 'info',
    usuario TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE public.empresas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.puestos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vigilantes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.turnos_puesto ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.historial_puesto ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.programaciones_mensuales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asignaciones_programacion ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow_all" ON public.empresas FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON public.puestos FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON public.vigilantes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON public.turnos_puesto FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON public.historial_puesto FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON public.programaciones_mensuales FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON public.asignaciones_programacion FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON public.audit_logs FOR ALL USING (true) WITH CHECK (true);

GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;

-- EMPRESA INICIAL CORAZA CTA
INSERT INTO public.empresas (id, nombre_comercial, nit, estado)
VALUES (
    'a0000000-0000-0000-0000-000000000001',
    'CORAZA COOPERATIVA DE VIGILANCIA Y SEGURIDAD PRIVADA CTA',
    '901509121',
    'Activo'
) ON CONFLICT (id) DO NOTHING;

-- PUESTOS DE PRUEBA
INSERT INTO public.puestos (empresa_id, nombre, tipo, latitud, longitud, direccion, contacto, telefono, prioridad, zona, codigo, turnos_config)
VALUES
(
    'a0000000-0000-0000-0000-000000000001',
    'CORAZA CONTROL', 'comando',
    6.255958, -75.596207,
    'Cra. 81 #49-24, Calasanz, Medellín',
    'Control Central', '311 3836939',
    'critica', 'ZONA NORTE', 'MED-0001',
    '[{"id":"AM","nombre":"Turno Diurno","inicio":"06:00","fin":"18:00","color":"#0ea5e9"},{"id":"PM","nombre":"Turno Nocturno","inicio":"18:00","fin":"06:00","color":"#6366f1"}]'
),
(
    'a0000000-0000-0000-0000-000000000001',
    'ALTOS DEL PINO', 'edificio',
    6.2442, -75.5700,
    'Altos del Pino, Medellín, Antioquia',
    'Administración', '311 0000001',
    'alta', 'ZONA SUR', 'MED-0002',
    '[{"id":"AM","nombre":"Turno Diurno","inicio":"06:00","fin":"18:00","color":"#0ea5e9"},{"id":"PM","nombre":"Turno Nocturno","inicio":"18:00","fin":"06:00","color":"#6366f1"}]'
)
ON CONFLICT DO NOTHING;

SELECT 'Schema aplicado correctamente ✅ - ' || COUNT(*) || ' tablas creadas' AS resultado
FROM information_schema.tables
WHERE table_schema = 'public' AND table_type = 'BASE TABLE';
