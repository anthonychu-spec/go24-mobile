@echo off
echo.
echo   GO24 Expo Dev Server
echo   ====================
echo   1) Office  (192.168.15.123)
echo   2) Home    (192.168.1.228)
echo.
set /p choice="Pick (1/2): "

if "%choice%"=="1" (
    set REACT_NATIVE_PACKAGER_HOSTNAME=192.168.15.123
    echo Starting on OFFICE network...
) else if "%choice%"=="2" (
    set REACT_NATIVE_PACKAGER_HOSTNAME=192.168.1.228
    echo Starting on HOME network...
) else (
    echo Invalid choice
    pause
    exit /b 1
)

npx expo start --clear --port 8081
