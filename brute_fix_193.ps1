$p = "src/pages/GestionPuestos.tsx"
$c = Get-Content $p
$c[192] = '    const selectedVig = vigilantes.find(v => v.id === vigilanteId || v.dbId === vigilanteId);'
$c | Set-Content $p -Encoding UTF8
