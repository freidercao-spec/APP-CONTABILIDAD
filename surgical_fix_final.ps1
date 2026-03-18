$p = "src/pages/GestionPuestos.tsx"
$content = Get-Content $p
$newContent = @()
foreach ($line in $content) {
    if ($line -like "*const selectedVig = vigilanteId);Id || v.dbId === vigilanteId);*") {
         $newContent += '    const selectedVig = vigilantes.find(v => v.id === vigilanteId || v.dbId === vigilanteId);'
    } elseif ($line -like "*v.id === titularesId[idx]*") {
         $newContent += $line -replace 'v\.id === titularesId\[idx\]', '(v.id === titularesId[idx] || v.dbId === titularesId[idx])'
    } else {
         $newContent += $line
    }
}
$newContent | Set-Content $p -Encoding UTF8
