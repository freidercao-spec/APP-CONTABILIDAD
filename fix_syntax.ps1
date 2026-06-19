$p = "src/pages/GestionPuestos.tsx"
$content = Get-Content $p
$newContent = @()
foreach ($line in $content) {
    if ($line -like '*title="Click para asignar este turno"*') {
        $newContent += '        title="Click para asignar este turno"'
        $newContent += '    />'
        $newContent += ');' # Close CeldaVacia
    } else {
        $newContent += $line
    }
}
$newContent | Set-Content $p
