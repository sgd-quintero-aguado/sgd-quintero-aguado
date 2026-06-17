@echo off
echo ===============================================
echo  SGD Quintero Aguado - Push a GitHub
echo ===============================================
cd /d "%~dp0"

echo [1/6] Limpiando git anterior...
rmdir /s /q .git 2>nul

echo [2/6] Configurando identidad Git...
git config --global user.email "ciralpe@yahoo.com"
git config --global user.name "Ciro"

echo [3/6] Iniciando repositorio...
git init -b main

echo [4/6] Agregando archivos...
git add .

echo [5/6] Haciendo commit...
git commit -m "SGD Quintero Aguado - primer commit"

echo [6/6] Subiendo a GitHub...
git remote add origin https://github.com/sgd-quintero-aguado/sgd-quintero-aguado.git
git push -u origin main

echo.
if %ERRORLEVEL% EQU 0 (
    echo ===  LISTO! Codigo subido a GitHub con exito ===
) else (
    echo === ERROR en el push - revisa el mensaje arriba ===
)
pause
