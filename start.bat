@echo off
echo ===================================
echo 智能金融分析平台 - 快速启动脚本
echo ===================================
echo.

echo 正在启动后端服务器...
cd /d "%~dp0backend"
start "后端服务器" cmd /k "npm run dev"

echo 等待后端服务器启动...
timeout /t 3 /nobreak >nul

echo 正在启动前端开发服务器...
cd /d "%~dp0frontend"
start "前端服务器" cmd /k "npm run dev"

echo.
echo ===================================
echo 启动完成！
echo ===================================
echo 后端API: http://localhost:5000
echo 前端应用: http://localhost:3000 (或其他可用端口)
echo.
echo 请等待前端编译完成后访问应用
echo 按任意键退出...
pause >nul