
-- BATCH DATA STRESS TEST - CORAZA CTA V3.5
-- PURPOSE: Verify scalability and data persistence across the fleet.

DO $$
DECLARE
    v_empresa_id UUID := 'a0000000-0000-0000-0000-000000000001';
    v_zona_id UUID := 'fdd22bf6-402c-4436-a4d8-2a4577ad29af';
    v_user_id UUID := '317ac963-1627-44a6-ad67-fc1d2809774b';
    v_vig_id UUID;
    v_p_id UUID;
    v_prog_id UUID;
    v_counter INTEGER;
    v_vigname TEXT;
    v_puestoname TEXT;
    v_dia INTEGER;
    v_rol TEXT;
    v_vig_list UUID[] := '{}';
    v_idx INTEGER;
BEGIN
    RAISE NOTICE '🚀 Inciando Stress Test de Datos Masivos para Coraza CTA...';

    -- 1. CREAR 50 VIGILANTES ADICIONALES
    FOR v_counter IN 1..50 LOOP
        v_vigname := 'Vigilante Test ' || v_counter;
        INSERT INTO public.vigilantes (empresa_id, cedula, nombres, apellidos, rango, estado, fecha_ingreso)
        VALUES (v_empresa_id, '70' || LPAD(v_counter::text, 6, '0'), 'TEST DRIVER', LPAD(v_counter::text, 3, '0'), 'Vigilante', 'disponible', CURRENT_DATE)
        RETURNING id INTO v_vig_id;
        
        v_vig_list := array_append(v_vig_list, v_vig_id);
    END LOOP;
    RAISE NOTICE '✅ 50 Vigilantes creados.';

    -- 2. CREAR 12 PUESTOS NUEVOS
    FOR v_counter IN 1..12 LOOP
        v_puestoname := (ARRAY['TORRE ALTURA ', 'HOSPITAL CLINICA ', 'EDIFICIO CENTRAL ', 'COMANDO LOGISTICO ', 'RETAIL MALL ', 'BANCO B-'])[mod(v_counter, 6) + 1] || v_counter;
        
        INSERT INTO public.puestos (empresa_id, zona_id, codigo, nombre, tipo, prioridad, estado)
        VALUES (v_empresa_id, v_zona_id, 'ST-' || LPAD(v_counter::text, 4, '0'), v_puestoname, 'edificio', 'alta', 'Activo')
        RETURNING id INTO v_p_id;

        -- 3. CREAR PROGRAMACIÓN MENSUAL (Marzo 2026) PARA CADA PUESTO
        INSERT INTO public.programacion_mensual (empresa_id, puesto_id, anio, mes, estado, creado_por)
        VALUES (v_empresa_id, v_p_id, 2026, 2, 'borrador', v_user_id) -- Mes 2 is March (0-indexed)
        RETURNING id INTO v_prog_id;

        -- 4. ASIGNAR PERSONAL AL PUESTO (Roles titulares)
        v_idx := mod(v_counter, 40) + 1;
        INSERT INTO public.personal_puesto (programacion_id, rol, vigilante_id) VALUES (v_prog_id, 'titular_a', v_vig_list[v_idx]);
        INSERT INTO public.personal_puesto (programacion_id, rol, vigilante_id) VALUES (v_prog_id, 'titular_b', v_vig_list[v_idx+1]);
        INSERT INTO public.personal_puesto (programacion_id, rol, vigilante_id) VALUES (v_prog_id, 'relevante', v_vig_list[mod(v_idx+5, 50)+1]);

        -- 5. GENERAR ASIGNACIONES DIARIAS (31 Días * 3 Roles = 93 Registros por Puesto)
        FOR v_dia IN 1..31 LOOP
            -- Titular A (Mañana)
            INSERT INTO public.asignaciones_dia (programacion_id, dia, vigilante_id, turno, jornada, rol)
            VALUES (v_prog_id, v_dia, v_vig_list[v_idx], 'AM', 'normal', 'titular_a');
            
            -- Titular B (Tarde)
            INSERT INTO public.asignaciones_dia (programacion_id, dia, vigilante_id, turno, jornada, rol)
            VALUES (v_prog_id, v_dia, v_vig_list[v_idx+1], 'PM', 'normal', 'titular_b');
            
            -- Relevante (Descanso/Apoyo)
            IF v_dia % 4 = 0 THEN
               INSERT INTO public.asignaciones_dia (programacion_id, dia, vigilante_id, turno, jornada, rol)
               VALUES (v_prog_id, v_dia, v_vig_list[mod(v_idx+5, 50)+1], '24H', 'normal', 'relevante');
            END IF;
        END LOOP;
    END LOOP;

    -- 6. AUDITORIA FINAL DEL STRESS TEST
    INSERT INTO public.auditoria (empresa_id, modulo, accion, detalles, usuario, severidad)
    VALUES (v_empresa_id, 'SISTEMA', 'STRESS_TEST_DATA', 'Carga masiva completada: 50 vigilantes, 12 puestos, 12 matrices mensuales, ~1100 asignaciones.', 'Antigravity AI Agent', 'success');

    RAISE NOTICE '🔥 Stress Test completado con éxito.';
END $$;
