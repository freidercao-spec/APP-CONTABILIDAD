$p = "src/pages/GestionPuestos.tsx"
$content = Get-Content $p
$newContent = @(
"import EditCeldaModal from '../components/EditCeldaModal';",
"import { useState, useMemo, useEffect, useRef } from 'react';",
"import { createPortal } from 'react-dom';",
"import { usePuestoStore } from '../store/puestoStore';",
"import { useVigilanteStore, ROL_LABELS } from '../store/vigilanteStore';",
"import { useProgramacionStore, MONTH_NAMES, DefaultJornadas, TurnoverRules } from '../store/programacionStore';",
"import { useAuthStore } from '../store/authStore';",
"import { useAuditStore } from '../store/auditStore';",
"import { useAIStore } from '../store/aiStore';",
"import { jsPDF } from 'jspdf';",
"import { showTacticalToast } from '../components/Toast';",
"import MilitaryTimeInput from '../components/MilitaryTimeInput';",
"import { AsignacionPuesto, RolPuesto, Vigilante, TurnoConfig, JornadaConfig } from '../types';"
)
# Skip current messed up imports (approx first 10-15 lines)
# I'll find where the first component starts to be sure.
$startIndex = 0
for ($i = 0; $i -lt $content.Length; $i++) {
    if ($content[$i] -match 'const CeldaCalendario') {
         $startIndex = $i
         break
    }
}
$newContent += $content[$startIndex..($content.Length-1)]
$newContent | Set-Content $p
