#!/bin/bash
# 数据库初始化脚本 - 在服务器上运行

echo "===== 金玉广告材料 - 数据库初始化 ====="
echo ""

# 检查是否已有数据库
if [ -f "data/jinyu.db" ]; then
  echo "⚠️  数据库已存在: data/jinyu.db"
  read -p "是否覆盖？(y/N) " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ 取消操作"
    exit 1
  fi
  rm data/jinyu.db
  echo "✅ 已删除旧数据库"
fi

# 方案1：自动创建空数据库（推荐）
echo ""
echo "选择初始化方案："
echo "  1) 自动创建空数据库（启动后手动添加数据）"
echo "  2) 从 seed.sql 导入初始数据（需要先上传 seed.sql 到服务器）"
read -p "请选择 (1/2): " -n 1 -r
echo

if [[ $REPLY == "1" ]]; then
  echo "✅ 将使用自动创建模式"
  echo "   启动命令: node server.js"
  echo "   数据库会在首次启动时自动创建"
elif [[ $REPLY == "2" ]]; then
  if [ ! -f "data/seed.sql" ]; then
    echo "❌ 错误: data/seed.sql 不存在"
    echo "   请先上传 data/seed.sql 到服务器"
    exit 1
  fi
  echo "正在从 seed.sql 导入数据..."
  sqlite3 data/jinyu.db < data/seed.sql
  echo "✅ 数据库初始化完成: data/jinyu.db"
else
  echo "❌ 无效选择"
  exit 1
fi

echo ""
echo "===== 下一步 ====="
echo "1. 安装依赖: npm install"
echo "2. 启动应用: pm2 start server.js --name jinyu-admin"
echo "3. 保存 pm2 配置: pm2 save"
echo ""
echo "✅ 完成！"
