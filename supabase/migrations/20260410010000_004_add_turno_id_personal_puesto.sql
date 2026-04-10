-- Migración 004: Añadir turno_id a personal_puesto y actualizar RPC atómico
-- Este campo es necesario para preservar la asignación de turnos personalizados
-- por rol, de modo que al cargar la programación desde la DB el tablero
-- muestre correctamente los colores y nombres de turno de cada rol.

-- 1. Añadir columna turno_id a personal_puesto (si no existe)
ALTER TABLE public.personal_puesto
    ADD COLUMN IF NOT EXISTS turno_id TEXT DEFAULT NULL;

-- 2. Actualizar el RPC guardar_programacion_atomica para manejar turno_id en p_personal JSONB
-- El payload de personal ahora puede incluir: { rol, vigilante_id, turno_id }
CREATE OR REPLACE FUNCTION public.guardar_programacion_atomica(
    p_prog_id UUID,
    p_empresa_id UUID,
    p_puesto_id UUID,
    p_anio INTEGER,
    p_mes INTEGER,
    p_estado TEXT,
    p_asignaciones JSONB,
    p_personal JSONB
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- UPSERT en programacion_mensual
    INSERT INTO public.programacion_mensual (
        id, empresa_id, puesto_id, anio, mes, estado, version, updated_at
    )
    VALUES (
        p_prog_id, p_empresa_id, p_puesto_id, p_anio, p_mes, p_estado, 1, NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
        estado = EXCLUDED.estado,
        version = public.programacion_mensual.version + 1,
        updated_at = NOW();

    -- LIMPIAR asignaciones del mes para re-insertar (estrategia replace-all)
    DELETE FROM public.asignaciones_dia
    WHERE programacion_id = p_prog_id;

    -- INSERTAR nuevas asignaciones (solo las que tienen vigilante asignado)
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

    -- LIMPIAR personal previo del puesto para re-insertar
    DELETE FROM public.personal_puesto
    WHERE programacion_id = p_prog_id;

    -- INSERTAR personal (todos los roles, con o sin vigilante, preservando turno_id)
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

-- Permisos de ejecución para usuarios autenticados
GRANT EXECUTE ON FUNCTION public.guardar_programacion_atomica(UUID, UUID, UUID, INTEGER, INTEGER, TEXT, JSONB, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.guardar_programacion_atomica(UUID, UUID, UUID, INTEGER, INTEGER, TEXT, JSONB, JSONB) TO service_role;
