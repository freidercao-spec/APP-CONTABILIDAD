$path = 'src\pages\GestionPuestos.tsx'
$content = Get-Content $path
$newContent = @()
foreach ($line in $content) {
    # Fix corrupted lines by finding the garbage patterns and trimming them
    # Pattern 1: d);Id || v.dbId === vigilanteId
    if ($line -like "*d);Id || v.dbId === vigilanteId*") {
        $fixed = $line -replace 'd\);Id \|\| v\.dbId === vigilanteId', 'd);'
        $newContent += $fixed
    }
    # Pattern 2: ludes(v.dbId))).map(v => {d.includes(v.dbId)
    elseif ($line -like "*ludes(v.dbId))).map(v => {d.includes(v.dbId)*") {
        $fixed = $line -replace 'ludes\(v\.dbId\)\)\)\.map\(v => \{d\.includes\(v\.dbId\)', 'ludes(v.dbId))).map(v => {'
        $newContent += $fixed
    }
    # Pattern 3: anteId);Id || v.dbId === vigila
    elseif ($line -like "*anteId);Id || v.dbId === vigila*") {
        $fixed = $line -replace 'anteId\);Id \|\| v\.dbId === vigila', 'anteId);'
        $newContent += $fixed
    }
    else {
        $newContent += $line
    }
}
$newContent | Set-Content $path
