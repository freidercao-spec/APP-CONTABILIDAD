-- ============================================================
-- MIGRACIÓN 006: Función Atómica de Guardado de Programación
-- Coraza CTA - Sistema de Control Táctico
-- ============================================================
-- Esta función garantiza que toda la programación mensual
-- (cabecera + personal + asignaciones) se guarde en una sola
-- transacción de base de datos. Si algo falla, NADA se guarda.
-- ============================================================

-- Tablas necesarias para la app (si no existen ya)
CREATE TABLE IF NOT EXISTS public.programacion_mensual (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    empresa_id UUID REFERENCES public.empresas(id) ON DELETE CASCADE,
    puesto_id UUID REFERENCES public.puestos(id) ON DELETE CASCADE,
    anio INTEGER NOT NULL,
    mes INTEGER NOT NULL CHECK (mes >= 0 AND mes <= 11),
    estado VARCHAR(20) DEFAULT 'borrador' CHECK (estado IN ('borrador', 'publicado', 'anulado')),
    version INTEGER DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(empresa_id, puesto_id, anio, mes)
);

CREATE TABLE IF NOT EXISTS public.personal_puesto (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    programacion_id UUID REFERENCES public.programacion_mensual(id) ON DELETE CASCADE,
    rol VARCHAR(100) NOT NULL,
    vigilante_id UUID REFERENCES public.vigilantes(id) ON DELETE SET NULL,
    turno_id VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(programacion_id, rol)
);

CREATE TABLE IF NOT EXISTS public.asignaciones_dia (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    programacion_id UUID REFERENCES public.programacion_mensual(id) ON DELETE CASCADE,
    dia INTEGER NOT NULL CHECK (dia >= 1 AND dia <= 31),
    vigilante_id UUID REFERENCES public.vigilantes(id) ON DELETE SET NULL,
    turno VARCHAR(20) DEFAULT 'AM',
    jornada VARCHAR(50) DEFAULT 'sin_asignar',
    rol VARCHAR(100) NOT NULL,
    inicio VARCHAR(10),
    fin VARCHAR(10),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(programacion_id, dia, rol)
);

CREATE TABLE IF NOT EXISTS public.plantillas_programacion (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    empresa_id UUID REFERENCES public.empresas(id) ON DELETE CASCADE,
    puesto_id UUID REFERENCES public.puestos(id) ON DELETE SET NULL,
    nombre VARCHAR(255) NOT NULL,
    puesto_nombre VARCHAR(255),
    personal JSONB DEFAULT '[]',
    patron JSONB DEFAULT '[]',
    creado_por VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Trigger para updated_at en programacion_mensual
CREATE OR REPLACE FUNCTION trigger_set_timestamp_prog()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_timestamp_programacion ON public.programacion_mensual;
CREATE TRIGGER set_timestamp_programacion
    BEFORE UPDATE ON public.programacion_mensual
    FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp_prog();

DROP TRIGGER IF EXISTS set_timestamp_asignaciones ON public.asignaciones_dia;
CREATE TRIGGER set_timestamp_asignaciones
    BEFORE UPDATE ON public.asignaciones_dia
    FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp_prog();

-- ============================================================
-- FUNCIÓN PRINCIPAL: guardar_programacion_atomica
-- Parámetros que espera el frontend (programacionStore.ts):
--   p_prog_id    UUID   - ID de la programación
--   p_empresa_id UUID   - ID de la empresa
--   p_puesto_id  UUID   - ID del puesto
--   p_anio       INT    - Año
--   p_mes        INT    - Mes (0-indexed)
--   p_estado     TEXT   - 'borrador' | 'publicado' | 'anulado'
--   p_asignaciones JSONB - Array de asignaciones del mes
--   p_personal   JSONB  - Array de personal asignado al puesto
--   p_historial  JSONB  - Array de cambios (ignorado en DB directamente)
-- ============================================================
CREATE OR REPLACE FUNCTION public.guardar_programacion_atomica(
    p_prog_id    UUID,
    p_empresa_id UUID,
    p_puesto_id  UUID,
    p_anio       INTEGER,
    p_mes        INTEGER,
    p_estado     TEXT,
    p_asignaciones JSONB,
    p_personal   JSONB,
    p_historial  JSONB DEFAULT '[]'::JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_asig JSONB;
    v_pers JSONB;
    v_vig_id UUID;
BEGIN
    -- ── 1. UPSERT CABECERA PROGRAMACIÓN ───────────────────────────────────────
    INSERT INTO public.programacion_mensual (
        id, empresa_id, puesto_id, anio, mes, estado, version, updated_at
    ) VALUES (
        p_prog_id,
        p_empresa_id,
        p_puesto_id,
        p_anio,
        p_mes,
        p_estado,
        1,
        NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
        estado     = EXCLUDED.estado,
        version    = public.programacion_mensual.version + 1,
        updated_at = NOW();

    -- ── 2. UPSERT PERSONAL DEL PUESTO ─────────────────────────────────────────
    -- Primero eliminamos roles que ya no existen en el nuevo payload
    IF jsonb_array_length(p_personal) > 0 THEN
        DELETE FROM public.personal_puesto
        WHERE programacion_id = p_prog_id
          AND rol NOT IN (
              SELECT pp->>'rol' FROM jsonb_array_elements(p_personal) AS pp
              WHERE pp->>'rol' IS NOT NULL
          );
    END IF;

    -- Luego insertamos/actualizamos cada rol
    FOR v_pers IN SELECT * FROM jsonb_array_elements(p_personal)
    LOOP
        -- Convertir vigilante_id a UUID de forma segura
        v_vig_id := NULL;
        BEGIN
            IF (v_pers->>'vigilante_id') IS NOT NULL AND (v_pers->>'vigilante_id') != '' THEN
                v_vig_id := (v_pers->>'vigilante_id')::UUID;
            END IF;
        EXCEPTION WHEN OTHERS THEN
            v_vig_id := NULL;
        END;

        INSERT INTO public.personal_puesto (
            programacion_id, rol, vigilante_id, turno_id
        ) VALUES (
            p_prog_id,
            v_pers->>'rol',
            v_vig_id,
            NULLIF(v_pers->>'turno_id', '')
        )
        ON CONFLICT (programacion_id, rol) DO UPDATE SET
            vigilante_id = EXCLUDED.vigilante_id,
            turno_id     = EXCLUDED.turno_id;
    END LOOP;

    -- ── 3. UPSERT ASIGNACIONES DEL MES ────────────────────────────────────────
    -- Solo procesamos asignaciones que tienen vigilante asignado
    FOR v_asig IN SELECT * FROM jsonb_array_elements(p_asignaciones)
    LOOP
        -- Convertir vigilante_id a UUID de forma segura
        v_vig_id := NULL;
        BEGIN
            IF (v_asig->>'vigilante_id') IS NOT NULL AND (v_asig->>'vigilante_id') != '' THEN
                v_vig_id := (v_asig->>'vigilante_id')::UUID;
            END IF;
        EXCEPTION WHEN OTHERS THEN
            v_vig_id := NULL;
        END;

        -- Solo insertar si tiene vigilante válido
        IF v_vig_id IS NOT NULL THEN
            INSERT INTO public.asignaciones_dia (
                programacion_id,
                dia,
                vigilante_id,
                turno,
                jornada,
                rol,
                inicio,
                fin,
                updated_at
            ) VALUES (
                p_prog_id,
                (v_asig->>'dia')::INTEGER,
                v_vig_id,
                COALESCE(NULLIF(v_asig->>'turno', ''), 'AM'),
                COALESCE(NULLIF(v_asig->>'jornada', ''), 'sin_asignar'),
                COALESCE(NULLIF(v_asig->>'rol', ''), 'titular_a'),
                NULLIF(v_asig->>'inicio', ''),
                NULLIF(v_asig->>'fin', ''),
                NOW()
            )
            ON CONFLICT (programacion_id, dia, rol) DO UPDATE SET
                vigilante_id = EXCLUDED.vigilante_id,
                turno        = EXCLUDED.turno,
                jornada      = EXCLUDED.jornada,
                inicio       = EXCLUDED.inicio,
                fin          = EXCLUDED.fin,
                updated_at   = NOW();
        END IF;
    END LOOP;

END;
$$;

-- ============================================================
-- PERMISOS: Permitir que el rol anon y authenticated ejecuten la función
-- ============================================================
GRANT EXECUTE ON FUNCTION public.guardar_programacion_atomica(UUID, UUID, UUID, INTEGER, INTEGER, TEXT, JSONB, JSONB, JSONB) TO anon;
GRANT EXECUTE ON FUNCTION public.guardar_programacion_atomica(UUID, UUID, UUID, INTEGER, INTEGER, TEXT, JSONB, JSONB, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.guardar_programacion_atomica(UUID, UUID, UUID, INTEGER, INTEGER, TEXT, JSONB, JSONB, JSONB) TO service_role;

-- Permisos en tablas
GRANT ALL ON public.programacion_mensual TO anon, authenticated, service_role;
GRANT ALL ON public.personal_puesto TO anon, authenticated, service_role;
GRANT ALL ON public.asignaciones_dia TO anon, authenticated, service_role;
GRANT ALL ON public.plantillas_programacion TO anon, authenticated, service_role;

-- ============================================================
-- RLS: Políticas de seguridad por empresa
-- ============================================================
ALTER TABLE public.programacion_mensual ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.personal_puesto ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asignaciones_dia ENABLE ROW LEVEL SECURITY;

-- Permitir todo por ahora (la seguridad se maneja en el frontend con empresa_id)
DROP POLICY IF EXISTS "allow_all_programacion" ON public.programacion_mensual;
CREATE POLICY "allow_all_programacion" ON public.programacion_mensual FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "allow_all_personal" ON public.personal_puesto;
CREATE POLICY "allow_all_personal" ON public.personal_puesto FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "allow_all_asignaciones" ON public.asignaciones_dia;
CREATE POLICY "allow_all_asignaciones" ON public.asignaciones_dia FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "allow_all_plantillas" ON public.plantillas_programacion;
CREATE POLICY "allow_all_plantillas" ON public.plantillas_programacion FOR ALL USING (true) WITH CHECK (true);

-- Notificar que la función fue recargada al schema cache de Supabase
NOTIFY pgrst, 'reload schema';
