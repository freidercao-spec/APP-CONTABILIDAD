$p = "src/pages/GestionPuestos.tsx"
$content = Get-Content $p
# Remove the duplicated modal usage (redundant)
$newContent = @()
$skipRange = 140..380
for ($i = 0; $i -lt $content.Length; $i++) {
    $ln = $i + 1
    if ($skipRange -contains $ln) { continue }
    # Also skip suspected duplicate at 1809..1822 if they match modal
    if ($ln -ge 1809 -and $ln -le 1822) { continue }
    
    # Fix corrupted lines like line 193 if they are still there (might be re-indexed)
    # Actually, if I delete 140-380, the corruption in 193 is GONE!
    
    $newContent += $content[$i]
}
$newContent = @("import EditCeldaModal from '../components/EditCeldaModal';") + $newContent
$newContent | Set-Content $p
