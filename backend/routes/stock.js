/**
 * 股票数据API路由模块 - 增强版
 * 
 * 主要功能：
 * 1. 支持股票和指数数据混合查询
 * 2. 集成Python数据服务获取真实数据
 * 3. 智能识别代码类型（股票/指数）
 * 4. 统一数据格式输出
 * 5. 错误处理和重试机制
 */

const express = require('express');
const router = express.Router();
const { spawn } = require('child_process');
const path = require('path');

/**
 * 常用股票和指数代码配置
 * 为前端提供快速选择选项
 */
const POPULAR_SYMBOLS = {
  stocks: [
    { code: '000001', name: '平安银行', type: 'stock' },
    { code: '000002', name: '万科A', type: 'stock' },
    { code: '600036', name: '招商银行', type: 'stock' },
    { code: '600519', name: '贵州茅台', type: 'stock' },
    { code: '000858', name: '五粮液', type: 'stock' }
  ],
  indices: [
    { code: '000001.SH', name: '上证指数', type: 'index' },
    { code: '399001.SZ', name: '深证成指', type: 'index' },
    { code: '399006.SZ', name: '创业板指', type: 'index' },
    { code: '399005.SZ', name: '中小板指', type: 'index' },
    { code: '000300.SH', name: '沪深300', type: 'index' },
    { code: '000905.SH', name: '中证500', type: 'index' }
  ]
};

/**
 * 识别股票/指数代码类型
 * 
 * @param {string} code - 输入的代码
 * @returns {string} 代码类型：'stock', 'index', 'unknown'
 */
function identifySymbolType(code) {
    // 指数代码模式：以.SH或.SZ结尾
    if (code.endsWith('.SH') || code.endsWith('.SZ')) {
        return 'index';
    }
    
    // A股股票代码模式：6位数字
    if (/^[0-9]{6}$/.test(code)) {
        return 'stock';
    }
    
    return 'unknown';
}

/**
 * 调用Python数据服务获取真实数据
 * 
 * @param {string} symbol - 股票/指数代码
 * @param {string} startDate - 开始日期
 * @param {string} endDate - 结束日期
 * @param {number} timeout - 超时时间（毫秒）
 * @returns {Promise<Object>} 数据获取结果
 */
function callPythonDataService(symbol, startDate, endDate, timeout = 30000) {
    return new Promise((resolve, reject) => {
        console.log(`调用Python数据服务: ${symbol}, ${startDate} - ${endDate}`);
        
        // Python脚本路径
        const pythonScript = path.join(__dirname, '..', 'data_service.py');
        
        // 创建Python子进程
        const pythonProcess = spawn('python', [pythonScript, symbol, startDate, endDate]);
        
        let stdout = '';
        let stderr = '';
        
        // 收集标准输出
        pythonProcess.stdout.on('data', (data) => {
            stdout += data.toString();
        });
        
        // 收集错误输出
        pythonProcess.stderr.on('data', (data) => {
            stderr += data.toString();
        });
        
        // 处理进程结束
        pythonProcess.on('close', (code) => {
            if (code === 0) {
                try {
                    const result = JSON.parse(stdout);
                    resolve(result);
                } catch (parseError) {
                    console.error('JSON解析错误:', parseError);
                    reject(new Error(`数据解析失败: ${parseError.message}`));
                }
            } else {
                console.error('Python进程错误:', stderr);
                reject(new Error(`数据获取失败 (退出码: ${code}): ${stderr}`));
            }
        });
        
        // 处理进程错误
        pythonProcess.on('error', (error) => {
            console.error('Python进程启动错误:', error);
            reject(new Error(`无法启动Python数据服务: ${error.message}`));
        });
        
        // 设置超时
        const timer = setTimeout(() => {
            pythonProcess.kill('SIGTERM');
            reject(new Error('数据获取超时'));
        }, timeout);
        
        pythonProcess.on('close', () => {
            clearTimeout(timer);
        });
    });
}

/**
 * 验证日期格式
 * 
 * @param {string} dateString - 日期字符串
 * @returns {boolean} 是否为有效日期格式
 */
function isValidDateFormat(dateString) {
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(dateString)) {
        return false;
    }
    
    const date = new Date(dateString);
    return date instanceof Date && !isNaN(date) && date.toISOString().startsWith(dateString);
}

/**
 * 获取股票/指数历史数据API - 增强版
 * 
 * GET /api/stock/:code/:startDate/:endDate
 * 
 * 功能增强：
 * 1. 支持股票代码和指数代码混合查询
 * 2. 自动识别代码类型
 * 3. 调用Python数据服务获取真实数据
 * 4. 统一数据格式返回
 * 5. 完善错误处理和用户提示
 */
router.get('/:code/:startDate/:endDate', async (req, res) => {
    try {
        const { code, startDate, endDate } = req.params;
        
        console.log(`接收到数据请求: 代码=${code}, 日期范围=${startDate} 到 ${endDate}`);
        
        // 验证输入参数
        if (!code || !startDate || !endDate) {
            return res.status(400).json({
                success: false,
                error: '缺少必要参数',
                message: '请提供股票代码和日期范围',
                timestamp: new Date().toISOString()
            });
        }
        
        // 验证日期格式
        if (!isValidDateFormat(startDate) || !isValidDateFormat(endDate)) {
            return res.status(400).json({
                success: false,
                error: '日期格式错误',
                message: '请使用 YYYY-MM-DD 格式',
                example: '2024-01-01',
                timestamp: new Date().toISOString()
            });
        }
        
        // 识别代码类型
        const symbolType = identifySymbolType(code);
        
        if (symbolType === 'unknown') {
            return res.status(400).json({
                success: false,
                error: '不支持的代码格式',
                message: `代码 ${code} 不符合股票或指数格式`,
                supportedFormats: {
                    stocks: '股票代码：6位数字（如：000001）',
                    indices: '指数代码：以.SH或.SZ结尾（如：000001.SH）'
                },
                timestamp: new Date().toISOString()
            });
        }
        
        console.log(`代码类型识别结果: ${symbolType}`);
        
        // 调用Python数据服务获取真实数据
        try {
            const result = await callPythonDataService(code, startDate, endDate);
            
            // 添加额外的响应信息
            const response = {
                ...result,
                requestInfo: {
                    requestTime: new Date().toISOString(),
                    symbolType: symbolType,
                    period: {
                        start: startDate,
                        end: endDate
                    }
                }
            };
            
            // 设置正确的响应状态码
            const statusCode = result.success ? 200 : 422;
            res.status(statusCode).json(response);
            
        } catch (pythonError) {
            console.error('Python数据服务错误:', pythonError.message);
            
            // 返回友好的错误信息
            const errorResponse = {
                success: false,
                code: code,
                name: `${symbolType === 'index' ? '指数' : '股票'}_${code}`,
                type: symbolType,
                error: '数据获取失败',
                message: pythonError.message,
                suggestion: '请检查代码是否正确，或稍后重试',
                data: [],
                summary: {
                    changePercent: 0,
                    maxPrice: 0,
                    minPrice: 0,
                    avgVolume: 0
                },
                requestInfo: {
                    requestTime: new Date().toISOString(),
                    symbolType: symbolType,
                    period: {
                        start: startDate,
                        end: endDate
                    }
                },
                timestamp: new Date().toISOString()
            };
            
            res.status(500).json(errorResponse);
        }
        
    } catch (error) {
        console.error('股票数据API处理错误:', error);
        res.status(500).json({
            success: false,
            error: '服务器内部错误',
            message: '获取数据时发生错误，请稍后重试',
            timestamp: new Date().toISOString()
        });
    }
});

/**
 * 获取支持的股票和指数列表API - 增强版
 * 
 * GET /api/stock/list
 * 返回所有可用的股票代码和指数代码及其基本信息
 */
router.get('/list', (req, res) => {
    try {
        const responseData = {
            success: true,
            data: {
                popular: POPULAR_SYMBOLS,
                total: POPULAR_SYMBOLS.stocks.length + POPULAR_SYMBOLS.indices.length
            },
            message: '获取支持的股票和指数列表成功',
            timestamp: new Date().toISOString()
        };
        
        res.json(responseData);
    } catch (error) {
        console.error('获取股票列表时发生错误:', error);
        res.status(500).json({
            success: false,
            error: '获取股票列表失败',
            timestamp: new Date().toISOString()
        });
    }
});

/**
 * 搜索股票/指数API - 增强版
 * 
 * GET /api/stock/search?keyword=关键词&type=all|stock|index
 * 根据股票代码或名称搜索股票和指数
 */
router.get('/search', (req, res) => {
    try {
        const { keyword, type = 'all' } = req.query;
        
        if (!keyword) {
            return res.status(400).json({
                success: false,
                error: '请提供搜索关键词',
                example: '/api/stock/search?keyword=平安&type=all',
                timestamp: new Date().toISOString()
            });
        }
        
        let searchSources = [];
        
        // 根据类型筛选搜索范围
        if (type === 'all' || type === 'stock') {
            searchSources = searchSources.concat(POPULAR_SYMBOLS.stocks);
        }
        if (type === 'all' || type === 'index') {
            searchSources = searchSources.concat(POPULAR_SYMBOLS.indices);
        }
        
        // 执行搜索
        const results = searchSources.filter(item => 
            item.code.toLowerCase().includes(keyword.toLowerCase()) || 
            item.name.includes(keyword)
        );
        
        res.json({
            success: true,
            keyword,
            type,
            results,
            total: results.length,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('搜索股票时发生错误:', error);
        res.status(500).json({
            success: false,
            error: '搜索失败',
            timestamp: new Date().toISOString()
        });
    }
});

/**
 * 数据服务状态检查API
 * 
 * GET /api/stock/status
 * 检查Python数据服务是否正常工作
 */
router.get('/status', async (req, res) => {
    try {
        // 试图获取一个简单的数据来检查服务状态
        const testResult = await callPythonDataService('000001', '2024-01-01', '2024-01-02', 5000);
        
        const status = {
            success: true,
            dataService: {
                status: 'online',
                pythonService: 'available',
                lastCheck: new Date().toISOString(),
                testResult: testResult.success ? 'passed' : 'failed'
            },
            supportedFeatures: {
                stockData: true,
                indexData: true,
                realTimeData: false, // MVP阶段暂时不支持
                dataCache: true
            },
            timestamp: new Date().toISOString()
        };
        
        res.json(status);
    } catch (error) {
        console.error('数据服务状态检查失败:', error);
        res.status(503).json({
            success: false,
            dataService: {
                status: 'offline',
                pythonService: 'unavailable',
                lastCheck: new Date().toISOString(),
                error: error.message
            },
            timestamp: new Date().toISOString()
        });
    }
});

module.exports = router;