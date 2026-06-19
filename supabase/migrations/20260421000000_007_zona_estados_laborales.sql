-- Migration 007: Add zona column to puestos + expand jornada constraint in asignaciones_dia
-- This migration adds support for the new labour states (LC, SP, IN, AC, VAC) 
-- and the Zona field for organizational filtering

-- 1. Add zona column to puestos
ALTER TABLE puestos 
  ADD COLUMN IF NOT EXISTS zona TEXT;

-- 2. Drop the existing jornada check constraint on asignaciones_dia
ALTER TABLE asignaciones_dia 
  DROP CONSTRAINT IF EXISTS asignaciones_dia_jornada_check;

-- 3. Add expanded jornada constraint with all new labour states
ALTER TABLE asignaciones_dia 
  ADD CONSTRAINT asignaciones_dia_jornada_check 
  CHECK (jornada IN (
    'normal',
    'descanso_remunerado',
    'descanso_no_remunerado',
    'vacacion',
    'licencia',
    'suspension',
    'incapacidad',
    'accidente',
    'sin_asignar'
  ));

-- 4. Add codigo_personalizado column to asignaciones_dia for custom state overrides
ALTER TABLE asignaciones_dia 
  ADD COLUMN IF NOT EXISTS codigo_personalizado TEXT;

-- 5. Add constraint for codigo_personalizado
ALTER TABLE asignaciones_dia 
  ADD CONSTRAINT asignaciones_dia_codigo_personalizado_check
  CHECK (codigo_personalizado IS NULL OR codigo_personalizado IN (
    'D', 'N', 'DR', 'NR', 'VAC', 'LC', 'SP', 'IN', 'AC', '-'
  ));

-- 6. Create index on zona for quick filtering
CREATE INDEX IF NOT EXISTS idx_puestos_zona ON puestos(zona);
CREATE INDEX IF NOT EXISTS idx_puestos_empresa_zona ON puestos(empresa_id, zona);

-- 7. Update existing asignaciones with vacacion to use valid state
-- (backward compatibility: some may have been saved wrong)
UPDATE asignaciones_dia SET jornada = 'vacacion' 
WHERE jornada = 'VAC';

COMMENT ON COLUMN puestos.zona IS 'Zona operativa / sector de despliegue del puesto (ej: Zona Norte, Zona Centro)';
COMMENT ON COLUMN asignaciones_dia.codigo_personalizado IS 'Código de estado laboral personalizado por el operador: D, N, DR, NR, VAC, LC, SP, IN, AC';
