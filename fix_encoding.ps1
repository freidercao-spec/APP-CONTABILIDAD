$path = "src/pages/GestionPuestos.tsx"
$content = Get-Content $path -Raw -Encoding UTF8

# Replace the whole block of AI validation strings
$oldBlock = '"✖ Un vigilante no puede estar en dos puestos al mismo tiempo en el mismo turno",\s+"ðŸš« Máximo 3 días de descanso por quincena por vigilante",\s+"ðŸš« Los 3 descansos deben ser: 2 remunerados \+ 1 no remunerado exactamente",\s+"ðŸš« No se aprueban vacaciones en diciembre, enero ni Semana Santa",\s+"ðŸš« Si el vigilante tiene descanso, no puede ser asignado a otro puesto ese día",\s+"âš ï¸  El relevante con días vacíos recibirá sugerencia de asignación alterna",\s+"âš ï¸  Días sin cobertura generan alerta de puesto desprotegido"'

$newBlock = '"Un vigilante no puede estar en dos puestos al mismo tiempo en el mismo turno",
                  "Máximo 3 días de descanso por quincena por vigilante",
                  "Los 3 descansos deben ser: 2 remunerados + 1 no remunerado exactamente",
                  "No se aprueban vacaciones en diciembre, enero ni Semana Santa",
                  "Si el vigilante tiene descanso, no puede ser asignado a otro puesto ese día",
                  "El relevante con días vacíos recibirá sugerencia de asignación alterna",
                  "Días sin cobertura generan alerta de puesto desprotegido"'

# Also replace the arrow mojibake if any
# $content = $content -replace "â†’", "●"

$content = $content -replace [regex]::Escape($oldBlock), $newBlock

Set-Content $path $content -Encoding UTF8
