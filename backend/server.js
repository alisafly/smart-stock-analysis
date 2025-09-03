/**
 * 金融数据分析应用 - Express 服务器主文件
 * 
 * 主要功能：
 * 1. 配置Express服务器和中间件
 * 2. 设置CORS跨域支持
 * 3. 配置路由处理
 * 4. 错误处理和日志记录
 * 5. 静态文件服务
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

// 导入路由模块
const stockRoutes = require('./routes/stock');
const chatRoutes = require('./routes/chat');

const app = express();
const PORT = process.env.PORT || 5000;

/**
 * 中间件配置
 * - cors: 允许前端跨域访问
 * - express.json: 解析JSON请求体
 * - express.static: 服务静态文件
 */
// 添加更完善的CORS配置以解决跨域问题
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

// 保留原有的cors中间件作为备用
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

/**
 * 请求日志中间件
 * 记录所有API请求的方法、路径和时间戳
 */
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
});

/**
 * 路由配置
 * /api/stock - 股票数据相关API
 * /api/chat - AI聊天相关API
 */
app.use('/api/stock', stockRoutes);
app.use('/api/chat', chatRoutes);

/**
 * 根路径健康检查
 * 用于验证服务器是否正常运行
 */
app.get('/', (req, res) => {
    res.json({
        message: '智能金融分析平台 API 服务器',
        version: '1.0.0',
        status: 'running',
        timestamp: new Date().toISOString()
    });
});

/**
 * 404错误处理
 * 处理未找到的路由请求
 */
app.use('*', (req, res) => {
    res.status(404).json({
        error: 'API 路径未找到',
        path: req.originalUrl,
        method: req.method
    });
});

/**
 * 全局错误处理中间件
 * 统一处理所有未捕获的错误
 */
app.use((err, req, res, next) => {
    console.error('服务器错误:', err.stack);
    
    res.status(err.status || 500).json({
        error: '服务器内部错误',
        message: process.env.NODE_ENV === 'development' ? err.message : '请稍后重试',
        timestamp: new Date().toISOString()
    });
});

/**
 * 启动服务器
 * 监听指定端口并输出启动信息
 */
app.listen(PORT, '0.0.0.0', () => {
    console.log(`
===========================================
🚀 金融数据分析平台 API 服务器已启动
===========================================
端口: ${PORT}
环境: ${process.env.NODE_ENV || 'development'}
前端地址: ${process.env.FRONTEND_URL || 'http://localhost:3000'}
启动时间: ${new Date().toISOString()}
===========================================
    `);
});

module.exports = app;