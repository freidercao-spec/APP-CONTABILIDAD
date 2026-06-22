-- =========================================================================
-- SCRIPT DE ADAPTACIÓN DE SCHEMA - CORAZA CTA
-- Ejecutar este script en el SQL Editor de Supabase para crear/adaptar las tablas
-- correctas requeridas por la aplicación de programación mensual.
-- =========================================================================

-- 1. Tabla de Programación Mensual (si no existe con este nombre singular)
CREATE TABLE IF NOT EXISTS public.programacion_mensual (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id UUID NOT NULL,
    puesto_id UUID NOT NULL,
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

-- 2. Tabla de Plantillas de Programación (si no existe)
CREATE TABLE IF NOT EXISTS public.plantillas_programacion (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id UUID NOT NULL,
    nombre TEXT NOT NULL,
    puesto_id UUID,
    puesto_nombre TEXT,
    personal JSONB DEFAULT '[]',
    patron JSONB DEFAULT '[]',
    creado_por TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Tabla de Asignaciones Diarias (si no existe con este nombre singular)
CREATE TABLE IF NOT EXISTS public.asignaciones_dia (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    programacion_id UUID REFERENCES public.programacion_mensual(id) ON DELETE CASCADE,
    dia INTEGER NOT NULL CHECK (dia >= 1 AND dia <= 31),
    vigilante_id UUID,
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

-- 4. Habilitar RLS (Row Level Security)
ALTER TABLE public.programacion_mensual ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plantillas_programacion ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asignaciones_dia ENABLE ROW LEVEL SECURITY;

-- 5. Crear políticas de acceso permisivas (delega el filtrado por empresa_id al frontend/código)
DROP POLICY IF EXISTS "allow_all_prog" ON public.programacion_mensual;
CREATE POLICY "allow_all_prog" ON public.programacion_mensual FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "allow_all_plantilla" ON public.plantillas_programacion;
CREATE POLICY "allow_all_plantilla" ON public.plantillas_programacion FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "allow_all_asig" ON public.asignaciones_dia;
CREATE POLICY "allow_all_asig" ON public.asignaciones_dia FOR ALL USING (true) WITH CHECK (true);

-- 6. Conceder permisos de acceso
GRANT ALL ON public.programacion_mensual TO anon, authenticated, service_role;
GRANT ALL ON public.plantillas_programacion TO anon, authenticated, service_role;
GRANT ALL ON public.asignaciones_dia TO anon, authenticated, service_role;

-- 7. Migrar datos si existieran tablas pluralizadas previas creadas por error
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'programaciones_mensuales') THEN
        INSERT INTO public.programacion_mensual (id, empresa_id, puesto_id, anio, mes, estado, personal, version, historial_cambios, created_at, updated_at)
        SELECT id, empresa_id, puesto_id, anio, mes, estado, personal, version, historial_cambios, created_at, updated_at
        FROM public.programaciones_mensuales
        ON CONFLICT (empresa_id, puesto_id, anio, mes) DO NOTHING;
    END IF;

    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'asignaciones_programacion') THEN
        INSERT INTO public.asignaciones_dia (id, programacion_id, dia, vigilante_id, rol, turno, jornada, codigo_personalizado, inicio, fin, created_at, updated_at)
        SELECT id, programacion_id, dia, vigilante_id, rol, turno, jornada, codigo_personalizado, inicio, fin, created_at, updated_at
        FROM public.asignaciones_programacion
        ON CONFLICT (programacion_id, dia, rol) DO NOTHING;
    END IF;
END $$;
