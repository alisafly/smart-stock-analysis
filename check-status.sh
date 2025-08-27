#!/bin/bash

echo "======================================"
echo "智能金融分析平台 - 项目状态检查"
echo "======================================"
echo

# 检查Node.js版本
echo "📋 检查运行环境..."
echo "Node.js版本: $(node --version)"
echo "npm版本: $(npm --version)"
echo

# 检查项目文件结构
echo "📁 检查项目结构..."
if [ -d "frontend" ] && [ -d "backend" ]; then
    echo "✅ 项目目录结构正确"
else
    echo "❌ 项目目录结构不完整"
    exit 1
fi

# 检查依赖安装
echo
echo "📦 检查依赖安装状态..."
cd backend
if [ -d "node_modules" ]; then
    echo "✅ 后端依赖已安装"
else
    echo "⚠️ 后端依赖未安装，正在安装..."
    npm install
fi

cd ../frontend
if [ -d "node_modules" ]; then
    echo "✅ 前端依赖已安装"
else
    echo "⚠️ 前端依赖未安装，正在安装..."
    npm install
fi

cd ..

# 检查关键文件
echo
echo "🔍 检查关键文件..."
files=(
    "backend/server.js"
    "backend/routes/stock.js"
    "backend/routes/chat.js"
    "frontend/src/App.tsx"
    "frontend/src/components/StockChart.tsx"
    "frontend/src/components/ChatPanel.tsx"
    "README.md"
)

for file in "${files[@]}"; do
    if [ -f "$file" ]; then
        echo "✅ $file"
    else
        echo "❌ $file 缺失"
    fi
done

echo
echo "🚀 项目就绪！可以运行以下命令启动："
echo "后端: cd backend && npm run dev"
echo "前端: cd frontend && npm run dev"
echo
echo "======================================"