-- Migración 005: Sistema de Auditoría y Persistencia de Historial
-- Esta migración añade el soporte necesario para registrar cada cambio manual
-- en la programación, garantizando la trazabilidad exigida para la seguridad operativa.

-- 1. Añadir columna de historial a la tabla principal (si no existe)
ALTER TABLE public.programacion_mensual
    ADD COLUMN IF NOT EXISTS historial_cambios JSONB DEFAULT '[]'::JSONB;

-- 2. Actualizar el RPC guardar_programacion_atomica para incluir el historial
CREATE OR REPLACE FUNCTION public.guardar_programacion_atomica(
    p_prog_id UUID,
    p_empresa_id UUID,
    p_puesto_id UUID,
    p_anio INTEGER,
    p_mes INTEGER,
    p_estado TEXT,
    p_asignaciones JSONB,
    p_personal JSONB,
    p_historial JSONB DEFAULT '[]'::JSONB
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- UPSERT en programacion_mensual (incluyendo actualización de historial)
    INSERT INTO public.programacion_mensual (
        id, empresa_id, puesto_id, anio, mes, estado, version, updated_at, historial_cambios
    )
    VALUES (
        p_prog_id, p_empresa_id, p_puesto_id, p_anio, p_mes, p_estado, 1, NOW(), p_historial
    )
    ON CONFLICT (id) DO UPDATE SET
        estado = EXCLUDED.estado,
        version = public.programacion_mensual.version + 1,
        historial_cambios = EXCLUDED.historial_cambios,
        updated_at = NOW();

    -- LIMPIAR asignaciones del mes para re-insertar (estrategia replace-all)
    DELETE FROM public.asignaciones_dia
    WHERE programacion_id = p_prog_id;

    -- INSERTAR nuevas asignaciones
    INSERT INTO public.asignaciones_dia (
        id, programacion_id, dia, vigilante_id, turno, jornada, rol, inicio, fin
    )
    SELECT
        gen_random_uuid(),
        p_prog_id,
        (item->>'dia')::INTEGER,
        (item->>'vigilante_id')::UUID,
        item->>'turno',
        item->>'jornada',
        item->>'rol',
        item->>'inicio',
        item->>'fin'
    FROM jsonb_array_elements(p_asignaciones) AS item
    WHERE item->>'vigilante_id' IS NOT NULL;

    -- LIMPIAR personal previo del puesto
    DELETE FROM public.personal_puesto
    WHERE programacion_id = p_prog_id;

    -- INSERTAR personal
    INSERT INTO public.personal_puesto (
        id, programacion_id, rol, vigilante_id, turno_id
    )
    SELECT
        gen_random_uuid(),
        p_prog_id,
        item->>'rol',
        CASE WHEN item->>'vigilante_id' IS NOT NULL AND item->>'vigilante_id' != 'null'
             THEN (item->>'vigilante_id')::UUID
             ELSE NULL
        END,
        item->>'turno_id'
    FROM jsonb_array_elements(p_personal) AS item
    WHERE item->>'rol' IS NOT NULL;

END;
$$;

-- Actualizar permisos (incluyendo el nuevo parámetro)
GRANT EXECUTE ON FUNCTION public.guardar_programacion_atomica(UUID, UUID, UUID, INTEGER, INTEGER, TEXT, JSONB, JSONB, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.guardar_programacion_atomica(UUID, UUID, UUID, INTEGER, INTEGER, TEXT, JSONB, JSONB, JSONB) TO service_role;
