-- Migración: Políticas Row Level Security (RLS)

-- Habilitar RLS en todas las tablas
ALTER TABLE public.empresas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.configuracion_empresa ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tipos_turno ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.zonas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.puestos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vigilantes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.turnos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eventos_personal ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.novedades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.historial_estados_vigilante ENABLE ROW LEVEL SECURITY;

-- Función de ayuda: Leer la empresa_id del JWT o consultar la tabla usuarios basado en auth.uid()
CREATE OR REPLACE FUNCTION requesting_user_empresa_id() 
RETURNS UUID AS $$
    SELECT empresa_id FROM public.usuarios WHERE id = auth.uid() LIMIT 1;
$$ LANGUAGE SQL SECURITY DEFINER;

---------------------------------------------------------------------------
-- POLÍTICAS
---------------------------------------------------------------------------
-- Las políticas aseguran que un usuario solo pueda leer/escribir datos de su propia `empresa_id`.

-- Zonas
CREATE POLICY "Zonas aisladas por empresa" ON public.zonas
    FOR ALL
    USING (empresa_id = requesting_user_empresa_id());

-- Puestos
CREATE POLICY "Puestos aislados por empresa" ON public.puestos
    FOR ALL
    USING (empresa_id = requesting_user_empresa_id());

-- Tipos de Turno
CREATE POLICY "Tipos de turno aislados por empresa" ON public.tipos_turno
    FOR ALL
    USING (empresa_id = requesting_user_empresa_id());

-- Vigilantes
CREATE POLICY "Vigilantes aislados por empresa" ON public.vigilantes
    FOR ALL
    USING (empresa_id = requesting_user_empresa_id());

-- Turnos
CREATE POLICY "Turnos aislados por empresa" ON public.turnos
    FOR ALL
    USING (empresa_id = requesting_user_empresa_id());

-- Eventos de Personal
CREATE POLICY "Eventos de personal aislados por empresa" ON public.eventos_personal
    FOR ALL
    USING (empresa_id = requesting_user_empresa_id());

-- Novedades
CREATE POLICY "Novedades aisladas por empresa" ON public.novedades
    FOR ALL
    USING (empresa_id = requesting_user_empresa_id());

-- Usuarios (Solo pueden verse a si mismos o a compañeros de la misma empresa si son admin)
CREATE POLICY "Usuarios ver companneros" ON public.usuarios
    FOR SELECT
    USING (empresa_id = requesting_user_empresa_id());

-- Configuración
CREATE POLICY "Configuración aislada por empresa" ON public.configuracion_empresa
    FOR ALL
    USING (empresa_id = requesting_user_empresa_id());
