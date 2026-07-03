@echo off
echo 1. Building Vite app...
call npm run build
if %ERRORLEVEL% neq 0 (
  echo Build failed!
  exit /b 1
)

echo 2. Checking out gh-pages...
git checkout gh-pages -f
if %ERRORLEVEL% neq 0 (
  echo Checkout failed!
  exit /b 1
)

echo 3. Cleaning old assets...
if exist assets rmdir /s /q assets
if exist index.html del /f /q index.html

echo 4. Copying built files...
xcopy /s /e /y dist\* .

git add assets index.html logo.png logo_premium.png logo.mp4 models vite.svg

echo 6. Committing...
git commit -m "deploy: update production build with latest data and assets"

echo 7. Pushing to GitHub Pages...
git push origin gh-pages

echo 8. Returning to main...
git checkout main -f

echo Done!
