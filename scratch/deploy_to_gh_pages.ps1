$NODE = "C:\Users\gdocumental\Pictures\Screenshots\YAP\YAP-APP-DON-FRANCISCO-main\.node_portable\node-v20.20.2-win-x64"
$env:PATH = "$NODE;$env:PATH"

Write-Host "1. Building application..."
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Error "Build failed"
    exit 1
}

Write-Host "2. Switching to gh-pages branch..."
git checkout gh-pages -f
if ($LASTEXITCODE -ne 0) {
    Write-Error "Failed to checkout gh-pages"
    exit 1
}

Write-Host "3. Cleaning up old built files..."
if (Test-Path assets) { Remove-Item -Path assets -Recurse -Force }
if (Test-Path index.html) { Remove-Item -Path index.html -Force }
Get-ChildItem -Path dist | ForEach-Object {
    $target = $_.Name
    if (Test-Path $target) {
        Remove-Item -Path $target -Recurse -Force
    }
}

Write-Host "4. Copying new build from dist to root..."
Copy-Item -Path dist\* -Destination . -Recurse -Force

Write-Host "5. Staging ONLY the built files..."
# Explicitly add only the copied files/folders to avoid staging chrome-profile or scratch
Get-ChildItem -Path dist | ForEach-Object {
    $targetName = $_.Name
    Write-Host "Staging $targetName..."
    git add $targetName
}

Write-Host "6. Committing and pushing deploy..."
git commit -m "deploy: update production build with infinite loop fix, topbar dark theme, and logo style"
git push origin gh-pages

Write-Host "7. Returning to main branch..."
git checkout main -f

Write-Host "Deployment completed successfully!"
