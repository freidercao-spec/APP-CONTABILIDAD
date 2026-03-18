$p = "src/pages/GestionPuestos.tsx"
$bytes = [System.IO.File]::ReadAllBytes($p)
$text = [System.Text.Encoding]::UTF8.GetString($bytes)
$text = $text -replace 'vigilanteId\);Id \|\| v\.dbId === vigilanteId\);', 'vigilantes.find(v => v.id === vigilanteId || v.dbId === vigilanteId);'
$text = $text -replace 'v\.id === titularesId\[idx\]', '(v.id === titularesId[idx] || v.dbId === titularesId[idx])'
$newBytes = [System.Text.Encoding]::UTF8.GetBytes($text)
[System.IO.File]::WriteAllBytes($p, $newBytes)
