#!/bin/bash
# 金玉广告材料 - 服务器一键部署脚本
# 使用方法：在服务器上执行 bash deploy.sh

set -e  # 遇到错误立即退出

echo "===== 金玉广告材料 - 后台管理系统部署 ====="
echo ""

# 1. 项目目录（请根据实际情况修改）
PROJECT_DIR="/path/to/jinyu-2026-new/admin"

# 如果提供了参数，使用参数作为项目目录
if [ $# -ge 1 ]; then
  PROJECT_DIR="$1"
fi

echo "📂 项目目录: $PROJECT_DIR"

if [ ! -d "$PROJECT_DIR" ]; then
  echo "❌ 错误: 目录不存在: $PROJECT_DIR"
  echo "   请修改脚本中的 PROJECT_DIR 或提供参数："
  echo "   bash deploy.sh /your/actual/path"
  exit 1
fi

cd "$PROJECT_DIR"
echo "✅ 已进入项目目录"
echo ""

# 2. 拉取最新代码
echo "===== 1/5 拉取最新代码 ====="
git pull origin main
echo "✅ 代码已更新"
echo ""

# 3. 安装依赖
echo "===== 2/5 安装依赖 ====="
npm install
echo "✅ 依赖已安装"
echo ""

# 4. 初始化数据库（如果不存在）
echo "===== 3/5 检查数据库 ====="
if [ -f "data/jinyu.db" ]; then
  echo "✅ 数据库已存在: data/jinyu.db"
  echo "   （如需重新初始化，请手动删除 data/jinyu.db 后再运行此脚本）"
else
  echo "⚠️  数据库不存在，正在初始化..."
  
  # 选择初始化方案
  echo "请选择初始化方案："
  echo "  1) 自动创建空数据库（推荐，启动后手动添加数据）"
  echo "  2) 从 seed.sql 导入初始数据"
  read -p "请选择 (1/2，默认1): " -n 1 -r
  echo ""
  
  if [[ $REPLY == "2" ]]; then
    if [ ! -f "data/seed.sql" ]; then
      echo "❌ 错误: data/seed.sql 不存在"
      echo "   请先确保 seed.sql 已提交到 git 并拉取到服务器"
      exit 1
    fi
    echo "正在从 seed.sql 导入数据..."
    sqlite3 data/jinyu.db < data/seed.sql
    echo "✅ 数据库已从 seed.sql 初始化"
  else
    echo "✅ 将使用自动创建模式"
    echo "   （数据库会在首次启动时自动创建）"
  fi
fi
echo ""

# 5. 重启应用
echo "===== 4/5 重启应用 ====="
if command -v pm2 &> /dev/null; then
  if pm2 list | grep -q "jinyu-admin"; then
    echo "正在重启 pm2 应用: jinyu-admin"
    pm2 restart jinyu-admin
    pm2 save
    echo "✅ 应用已重启"
  else
    echo "正在创建 pm2 应用: jinyu-admin"
    pm2 start server.js --name jinyu-admin
    pm2 save
    echo "✅ 应用已创建并启动"
  fi
else
  echo "⚠️  pm2 未安装，请手动启动应用："
  echo "   node server.js"
  echo "或者安装 pm2: npm install -g pm2"
fi
echo ""

# 6. 验证
echo "===== 5/5 验证部署 ====="
sleep 2
if curl -s http://localhost:3006/api/about > /dev/null; then
  echo "✅ 应用运行正常: http://localhost:3006"
  echo "   后台管理: http://your-server-ip:3006"
else
  echo "⚠️  应用可能未正常启动，请检查日志："
  echo "   pm2 logs jinyu-admin"
fi
echo ""

echo "===== 部署完成！====="
echo ""
echo "📋 下一步："
echo "  1. 访问后台管理页面: http://your-server-ip:3006"
echo "  2. 检查所有功能是否正常"
echo "  3. 如有问题，查看日志: pm2 logs jinyu-admin"
echo ""
