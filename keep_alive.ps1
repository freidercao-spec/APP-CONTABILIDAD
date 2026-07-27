# Script de Keep Alive para evitar que Supabase pause la base de datos de CORAZA CTA
$url = "https://ykchpbqkjvmnddndkvno.supabase.co/rest/v1/vigilantes?select=id&limit=1"
$headers = @{
    "apikey" = "sb_publishable_OlEXiywU13_j1FlB4QZWLQ_kYI41a-E"
    "Authorization" = "Bearer sb_publishable_OlEXiywU13_j1FlB4QZWLQ_kYI41a-E"
}

$logFile = Join-Path $PSScriptRoot "keep_alive_log.txt"
$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"

try {
    $response = Invoke-RestMethod -Uri $url -Headers $headers -Method Get
    $msg = "[$timestamp] Supabase Keep-Alive exitoso. Registros obtenidos: $($response.Count)"
    Write-Output $msg
    Add-Content -Path $logFile -Value $msg
} catch {
    $msg = "[$timestamp] Supabase Keep-Alive fallido. Error: $_"
    Write-Error $msg
    Add-Content -Path $logFile -Value $msg
}
