@echo off
chcp 65001 >nul
:: 开启延迟变量扩展以处理循环中的变量
SETLOCAL EnableDelayedExpansion

:: 设置目标平台为 Linux x64
set GOOS=linux
set GOARCH=amd64

echo [1/3] 正在同步依赖 (go mod tidy)...
go mod tidy

echo [2/3] 正在清理旧的编译产物...
if exist ..\build\app\server\podnote del ..\build\app\server\podnote

echo [3/3] 正在编译后端 (Linux x64)...
go build -ldflags="-s -w" -o ..\build\app\server\podnote main.go

if %errorlevel% equ 0 (
    echo.
    echo ========================================
    echo [SUCCESS] 编译成功!
    
    :: 计算大小 (MB)
    for %%I in (..\build\app\server\podnote) do (
        set "size_bytes=%%~zI"
        set /a "size_kb=!size_bytes! / 1024"
        set /a "size_mb_int=!size_kb! / 1024"
        set /a "size_mb_frac=(!size_kb! * 100 / 1024) %% 100"
        if !size_mb_frac! LSS 10 set "size_mb_frac=0!size_mb_frac!"
        echo [SIZE]    !size_mb_int!.!size_mb_frac! MB
    )
    echo ========================================
) else (
    echo.
    echo [ERROR]   编译失败，请检查网络连接或 Go 环境。
)

ENDLOCAL
pause
