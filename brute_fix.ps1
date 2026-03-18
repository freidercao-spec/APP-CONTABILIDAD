$p = "src/pages/GestionPuestos.tsx"
$content = [System.IO.File]::ReadAllLines($p)
# Check for selectedVig and replace matching lines
for ($i = 0; $i -lt $content.Length; $i++) {
    if ($content[$i] -match "selectedVig") {
         $content[$i] = '    const selectedVig = vigilantes.find(v => v.id === vigilanteId || v.dbId === vigilanteId);'
    }
}
[System.IO.File]::WriteAllLines($p, $content)
