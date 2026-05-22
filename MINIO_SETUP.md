# MinIO 图片存储配置说明

## 启动 MinIO 服务器

### 方法1：使用 Docker（推荐）

```bash
cd c:\Users\hzf\Documents\GitHub\jinyu1.0admin
docker-compose up -d
```

访问 MinIO 控制台: http://localhost:9001
- 用户名: minioadmin
- 密码: minioadmin

### 方法2：直接安装 MinIO

1. 下载 MinIO: https://min.io/download#/windows
2. 运行:
```bash
minio.exe server data --console-address ":9001"
```

## 配置说明

环境变量配置在 `.env` 文件中:

```env
PORT=3006
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_USE_SSL=false
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_BUCKET=jinyu-images
```

## 图片上传流程

1. 前端选择图片文件
2. 前端通过 FormData 上传到 `/api/about/upload` 或 `/api/upload/video`
3. 后端接收文件，使用 MinIO SDK 上传到 MinIO 服务器
4. MinIO 返回完整的图片 URL
5. 后端将 URL 返回给前端
6. 前端将 URL 保存到数据库

## MinIO 控制台访问

- Console: http://localhost:9001
- API: http://localhost:9000

## 故障排除

如果上传失败，请检查：
1. MinIO 服务器是否正在运行
2. 端口 9000 和 9001 是否被占用
3. 桶 `jinyu-images` 是否已创建
4. 防火墙是否允许访问这些端口
