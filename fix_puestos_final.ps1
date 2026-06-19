$path = "src/pages/GestionPuestos.tsx"
$raw = [System.IO.File]::ReadAllText($path)
# Correct conflicts logic
$old1 = 'return \`${vigilantes.find\(v => v.id === vid\)\?.nombre\} ya tiene turno el día \${asig.dia} \(\${t}\)\`;'
$new1 = 'const v = vigilantes.find(gv => gv.id === vid || gv.dbId === vid); return `${v?.nombre || "Efectivo"} ya tiene turno el día ${asig.dia} (${t})`;'
$raw = $raw -replace $old1, $new1

# Correct selectedVig logic
$old2 = 'const selectedVig = vigilantes.find\(v => v.id === vigilanteId\);'
$new2 = 'const selectedVig = vigilantes.find(v => v.id === vigilanteId || v.dbId === vigilanteId);'
$raw = $raw -replace $old2, $new2

# Correct filtering in selects
$old3 = 'v.id === titularesId\[idx\]'
$new3 = '(v.id === titularesId[idx] || v.dbId === titularesId[idx])'
$raw = $raw -replace $old3, $new3

[System.IO.File]::WriteAllText($path, $raw)
