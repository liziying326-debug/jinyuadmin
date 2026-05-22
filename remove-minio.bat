@echo off
echo 移除 MinIO 容器和所有数据...
docker stop jinyu-minio >nul 2>&1
docker rm jinyu-minio
docker volume rm jinyu-minio-data >nul 2>&1
echo MinIO 已完全移除
pause
