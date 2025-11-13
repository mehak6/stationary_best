@echo off
echo Killing Inventory Pro processes...
taskkill /F /IM "Inventory Pro.exe" /T >nul 2>&1
timeout /t 2 /nobreak >nul
echo Cleaning dist folder...
rd /s /q "dist" 2>nul
timeout /t 1 /nobreak >nul
echo Rebuilding app...
call npm run pack
echo Done!
