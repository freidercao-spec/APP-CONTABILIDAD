$p = "src/pages/GestionPuestos.tsx"
$content = Get-Content $p
$content[0] = "import EditCeldaModal from '../components/EditCeldaModal';"
$content | Set-Content $p
