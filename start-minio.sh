@echo off
echo ==========================================
echo   启动 MinIO 图片存储服务
echo ==========================================

REM 检查 Docker 是否安装
docker --version >nul 2>&1
if errorlevel 1 (
    echo [错误] 未检测到 Docker，请先安装 Docker Desktop
    echo 下载地址: https://www.docker.com/products/docker-desktop/
    pause
    exit /b 1
)

REM 检查 Docker 是否运行
docker info >nul 2>&1
if errorlevel 1 (
    echo [错误] Docker 未运行，请先启动 Docker Desktop
    pause
    exit /b 1
)

echo [1/3] 检查 MinIO 容器状态...
docker ps -a --filter "name=jinyu-minio" --format "{{.Names}}" | findstr /i "jinyu-minio" >nul
if %errorlevel% equ 0 (
    echo       MinIO 容器已存在，尝试启动...
    docker start jinyu-minio
) else (
    echo [2/3] 创建并启动 MinIO 容器...
    docker run -d ^
        --name jinyu-minio ^
        -p 9000:9000 ^
        -p 9001:9001 ^
        -e MINIO_ROOT_USER=minioadmin ^
        -e MINIO_ROOT_PASSWORD=minioadmin ^
        -v jinyu-minio-data:/data ^
        minio/minio server /data --console-address ":9001"

    if errorlevel 1 (
        echo [错误] MinIO 容器启动失败
        pause
        exit /b 1
    )
)

echo [3/3] 等待 MinIO 服务就绪...
timeout /t 3 /nobreak >nul

echo.
echo ==========================================
echo   MinIO 服务已启动
echo ==========================================
echo.
echo   MinIO Console:  http://localhost:9001
echo   MinIO API:     http://localhost:9000
echo.
echo   用户名: minioadmin
echo   密码:  minioadmin
echo.
echo   按任意键打开 MinIO Console...
pause >nul
start http://localhost:9001
