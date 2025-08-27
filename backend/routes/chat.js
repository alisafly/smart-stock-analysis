/**
 * AI聊天API路由模块
 * 
 * 主要功能：
 * 1. 处理用户与AI的对话请求
 * 2. 整合股票数据上下文进行智能分析
 * 3. 支持多种AI服务提供商 (OpenAI, LMStudio)
 * 4. 对话历史管理和上下文维护
 * 5. 专业的金融分析和投资建议
 */

const express = require('express');
const router = express.Router();
const aiService = require('../services/aiService');

/**
 * 对话历史存储
 * 在生产环境中应该使用数据库或Redis等持久化存储
 */
let conversationHistory = [];

/**
 * 将股票数据转换为AI分析的文本描述
 * (保留原有功能，作为备用)
 * 
 * @param {Object} stockData - 股票数据对象
 * @returns {string} 格式化的股票数据描述
 */
function formatStockDataForAI(stockData) {
    if (!stockData || !stockData.data || stockData.data.length === 0) {
        return '暂无股票数据可供分析。';
    }
    
    const { code, name, currentPrice, data, summary } = stockData;
    const recentData = data.slice(-5); // 最近5天数据
    
    let description = `股票分析数据：\n`;
    description += `股票代码：${code} (${name})\n`;
    description += `当前价格：${currentPrice}元\n`;
    description += `分析周期：${stockData.period.start} 至 ${stockData.period.end} (${stockData.period.totalDays}个交易日)\n\n`;
    
    if (summary) {
        description += `统计摘要：\n`;
        description += `- 期间涨跌幅：${summary.changePercent}%\n`;
        description += `- 最高价：${summary.maxPrice}元\n`;
        description += `- 最低价：${summary.minPrice}元\n`;
        description += `- 平均成交量：${summary.avgVolume}万手\n\n`;
    }
    
    description += `最近交易数据：\n`;
    recentData.forEach((day, index) => {
        const change = index > 0 ? 
            ((day.close - recentData[index-1].close) / recentData[index-1].close * 100).toFixed(2) : 
            0;
        description += `${day.date}: 开盘${day.open}元, 收盘${day.close}元, 涨跌${change}%, 成交量${day.volume}万手\n`;
    });
    
    return description;
}

/**
 * 使用AI服务生成智能分析响应
 * 
 * @param {string} userMessage - 用户消息
 * @param {Object} stockContext - 股票数据上下文
 * @returns {Promise<string>} AI分析响应
 */
async function generateAIResponse(userMessage, stockContext) {
    try {
        // 调用AI服务进行智能分析
        const response = await aiService.analyzeWithAI(userMessage, stockContext);
        return response;
    } catch (error) {
        console.error('AI分析错误:', error);
        // 返回错误提示
        return '抱歉，当前AI服务不可用。请稍后再试或检查AI服务配置。\n\n您可以在后端日志中查看详细错误信息。';
    }
}

/**
 * AI聊天API
 * 
 * POST /api/chat
 * 
 * 请求体：
 * {
 *   message: "用户消息",
 *   stockContext: { 当前显示的股票数据 },
 *   conversationId: "会话ID"
 * }
 */
router.post('/', async (req, res) => {
    try {
        const { message, stockContext, conversationId } = req.body;
        
        if (!message || message.trim() === '') {
            return res.status(400).json({
                error: '消息内容不能为空'
            });
        }
        
        console.log(`🤖 收到AI聊天请求: ${message}`);
        if (stockContext && stockContext.code) {
            console.log(`📊 股票上下文: ${stockContext.code} (${stockContext.name})`);
        }
        
        // 生成AI响应
        const aiResponse = await generateAIResponse(message, stockContext);
        
        // 记录对话历史
        const conversation = {
            id: conversationId || Date.now().toString(),
            timestamp: new Date().toISOString(),
            userMessage: message,
            aiResponse: aiResponse,
            stockContext: stockContext ? {
                code: stockContext.code,
                name: stockContext.name,
                currentPrice: stockContext.currentPrice
            } : null,
            aiProvider: aiService.getServiceStatus().provider
        };
        
        conversationHistory.push(conversation);
        
        // 保持历史记录不超过100条
        if (conversationHistory.length > 100) {
            conversationHistory = conversationHistory.slice(-100);
        }
        
        console.log(`✅ AI分析完成，使用提供商: ${conversation.aiProvider}`);
        
        // 返回响应
        res.json({
            response: aiResponse,
            conversationId: conversation.id,
            timestamp: conversation.timestamp,
            hasStockContext: !!stockContext,
            aiProvider: conversation.aiProvider,
            aiServiceStatus: aiService.getServiceStatus()
        });
        
    } catch (error) {
        console.error('❌ AI聊天处理错误:', error);
        res.status(500).json({
            error: '处理聊天请求时发生错误',
            message: '请稍后重试',
            timestamp: new Date().toISOString(),
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

/**
 * 获取对话历史API
 * 
 * GET /api/chat/history?limit=20
 */
router.get('/history', (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 20;
        const history = conversationHistory.slice(-limit).reverse();
        
        res.json({
            history,
            total: conversationHistory.length,
            limit,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('获取对话历史错误:', error);
        res.status(500).json({
            error: '获取对话历史失败',
            timestamp: new Date().toISOString()
        });
    }
});

/**
 * 清除对话历史API
 * 
 * DELETE /api/chat/history
 */
router.delete('/history', (req, res) => {
    try {
        conversationHistory = [];
        
        res.json({
            message: '对话历史已清除',
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('清除对话历史错误:', error);
        res.status(500).json({
            error: '清除对话历史失败',
            timestamp: new Date().toISOString()
        });
    }
});

/**
 * AI服务状态检查API
 * 
 * GET /api/chat/status
 */
router.get('/status', (req, res) => {
    try {
        const status = aiService.getServiceStatus();
        
        res.json({
            aiService: status,
            timestamp: new Date().toISOString(),
            environment: {
                nodeEnv: process.env.NODE_ENV,
                aiProvider: process.env.AI_PROVIDER,
                hasOpenAIKey: !!process.env.OPENAI_API_KEY,
                openaiBaseUrl: process.env.OPENAI_BASE_URL,
                lmstudioBaseUrl: process.env.LMSTUDIO_BASE_URL
            }
        });
        
    } catch (error) {
        console.error('获取AI服务状态错误:', error);
        res.status(500).json({
            error: '获取AI服务状态失败',
            timestamp: new Date().toISOString()
        });
    }
});

/**
 * 模型切换API
 * 
 * POST /api/chat/switch
 * 
 * 请求体：
 * {
 *   provider: "zhipu" | "openai" | "moonshot" | "deepseek" | "claude" | "lmstudio" | "disabled"
 * }
 */
router.post('/switch', async (req, res) => {
    try {
        const { provider } = req.body;
        
        if (!provider) {
            return res.status(400).json({
                error: '缺少provider参数'
            });
        }
        
        console.log(`🔄 接收到模型切换请求: ${provider}`);
        
        const result = await aiService.switchProvider(provider);
        
        console.log(`✅ 模型切换成功: ${result.oldProvider} -> ${result.newProvider}`);
        
        res.json({
            ...result,
            status: aiService.getServiceStatus(),
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ 模型切换失败:', error.message);
        res.status(500).json({
            error: '模型切换失败',
            message: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

/**
 * 获取所有支持的AI提供商
 * 
 * GET /api/chat/providers
 */
router.get('/providers', (req, res) => {
    try {
        const providers = aiService.getAllProviders();
        
        res.json({
            ...providers,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('获取提供商列表错误:', error);
        res.status(500).json({
            error: '获取提供商列表失败',
            timestamp: new Date().toISOString()
        });
    }
});

module.exports = router;