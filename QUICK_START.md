# 快速启动指南 - MinIO 图片存储

## 一键启动 MinIO

双击运行 `start-minio.bat` 脚本即可自动启动 MinIO 服务。

## 手动启动（使用 Docker）

```bash
cd c:\Users\hzf\Documents\GitHub\jinyu1.0admin
docker-compose up -d
```

## 验证 MinIO 是否运行

访问 http://localhost:9001 使用 minioadmin/minioadmin 登录。

## 启动后台服务

```bash
cd c:\Users\hzf\Documents\GitHub\jinyu1.0admin
npm run server
```

## 测试图片上传

1. 访问后台管理界面 (http://localhost:3000)
2. 进入产品管理或其他有图片上传的页面
3. 上传一张图片
4. 图片应该上传到 MinIO，并返回完整 URL
5. URL 将保存在数据库中

## 查看上传的图片

所有通过管理后台上传的图片都会存储在 MinIO 中：
- 桶名称: `jinyu-images`
- 访问方式: 直接通过返回的完整 URL 访问

## 常见问题

### 1. MinIO 连接失败
- 确保 MinIO 服务正在运行（检查 Docker Desktop）
- 确认端口 9000 和 9001 未被占用

### 2. 上传失败
- 检查 `.env` 文件中的 MinIO 配置是否正确
- 确认 `jinyu-images` 桶已创建且策略为公开读取

### 3. 图片无法显示
- 检查浏览器控制台是否有跨域错误
- 确认 MinIO 服务可以从外部访问

## 停止 MinIO

运行 `stop-minio.bat` 或执行:
```bash
docker stop jinyu-minio
```

## 完全移除 MinIO

运行 `remove-minio.bat` 将删除所有数据。
