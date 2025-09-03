/**
 * AI服务模块
 * 
 * 统一管理多种大模型提供商，支持：
 * 1. OpenAI API (自定义URL)
 * 2. LMStudio 本地模型
 * 3. 降级到本地规则引擎
 * 
 * 主要功能：
 * - 多模型切换和配置
 * - 智能股票数据分析
 * - 专业金融分析提示词
 * - 错误处理和降级机制
 */

const { OpenAI } = require('openai');

class AIService {
    constructor() {
        this.provider = process.env.AI_PROVIDER || 'disabled';
        this.openaiClient = null;
        this.lmstudioClient = null;
        
        this.initializeClients();
    }

    /**
     * 初始化AI客户端
     */
    initializeClients() {
        try {
            // 根据配置初始化对应的AI客户端
            switch (this.provider) {
                case 'openai':
                    this.initializeOpenAI();
                    break;
                case 'zhipu':
                    this.initializeZhipu();
                    break;
                case 'moonshot':
                    this.initializeMoonshot();
                    break;
                case 'deepseek':
                    this.initializeDeepSeek();
                    break;
                case 'claude':
                    this.initializeClaude();
                    break;
                case 'lmstudio':
                    this.initializeLMStudio();
                    break;
                default:
                    console.log(`ℹ️ AI服务已禁用或不支持的提供商: ${this.provider}`);
            }
        } catch (error) {
            console.error('❌ AI客户端初始化失败:', error.message);
            this.provider = 'disabled';
        }
    }

    /**
     * 初始化OpenAI客户端
     */
    initializeOpenAI() {
        if (process.env.OPENAI_API_KEY) {
            this.openaiClient = new OpenAI({
                apiKey: process.env.OPENAI_API_KEY,
                baseURL: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1'
            });
            console.log(`✅ OpenAI客户端已初始化: ${process.env.OPENAI_BASE_URL}`);
        } else {
            throw new Error('OPENAI_API_KEY 未配置');
        }
    }

    /**
     * 初始化智谱AI客户端
     */
    initializeZhipu() {
        if (process.env.ZHIPU_API_KEY) {
            this.zhipuClient = new OpenAI({
                apiKey: process.env.ZHIPU_API_KEY,
                baseURL: process.env.ZHIPU_BASE_URL || 'https://open.bigmodel.cn/api/paas/v4'
            });
            console.log(`✅ 智谱AI客户端已初始化: ${process.env.ZHIPU_BASE_URL}`);
        } else {
            throw new Error('ZHIPU_API_KEY 未配置');
        }
    }

    /**
     * 初始化月之暗面Kimi客户端
     */
    initializeMoonshot() {
        if (process.env.MOONSHOT_API_KEY) {
            this.moonshotClient = new OpenAI({
                apiKey: process.env.MOONSHOT_API_KEY,
                baseURL: process.env.MOONSHOT_BASE_URL || 'https://api.moonshot.cn/v1'
            });
            console.log(`✅ 月之暗面Kimi客户端已初始化: ${process.env.MOONSHOT_BASE_URL}`);
        } else {
            throw new Error('MOONSHOT_API_KEY 未配置');
        }
    }

    /**
     * 初始化DeepSeek客户端
     */
    initializeDeepSeek() {
        if (process.env.DEEPSEEK_API_KEY) {
            this.deepseekClient = new OpenAI({
                apiKey: process.env.DEEPSEEK_API_KEY,
                baseURL: process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com'
            });
            console.log(`✅ DeepSeek客户端已初始化: ${process.env.DEEPSEEK_BASE_URL}`);
        } else {
            throw new Error('DEEPSEEK_API_KEY 未配置');
        }
    }

    /**
     * 初始化Claude客户端（通过OpenAI兼容接口）
     */
    initializeClaude() {
        if (process.env.CLAUDE_API_KEY) {
            this.claudeClient = new OpenAI({
                apiKey: process.env.CLAUDE_API_KEY,
                baseURL: process.env.CLAUDE_BASE_URL || 'https://api.anthropic.com/v1'
            });
            console.log(`✅ Claude客户端已初始化: ${process.env.CLAUDE_BASE_URL}`);
        } else {
            throw new Error('CLAUDE_API_KEY 未配置');
        }
    }

    /**
     * 初始化LMStudio客户端
     */
    initializeLMStudio() {
        this.lmstudioClient = new OpenAI({
            apiKey: 'lm-studio', // LMStudio不需要真实API密钥
            baseURL: process.env.LMSTUDIO_BASE_URL || 'http://localhost:1234/v1'
        });
        console.log(`✅ LMStudio客户端已初始化: ${process.env.LMSTUDIO_BASE_URL}`);
    }

    /**
     * 生成股票分析的系统提示词
     * 
     * @param {Object} stockContext - 股票数据上下文
     * @returns {string} 系统提示词
     */
    generateSystemPrompt(stockContext) {
        const currentDate = new Date().toLocaleDateString('zh-CN');
        
        let systemPrompt = `你是一位专业的金融分析师和投资顾问，具有丰富的A股市场分析经验。

**核心能力:**
- 深度技术分析和基本面分析
- 风险评估和投资建议
- 市场趋势判断和策略建议
- 专业且易懂的解释能力

**分析原则:**
1. 基于数据事实进行客观分析
2. 提供多角度的风险评估
3. 给出具体可操作的建议
4. 强调风险提示和免责声明

**响应风格:**
- 使用中文回答
- 结构化输出，使用适当的emoji
- 专业术语配合通俗解释
- 重点信息使用**粗体**标记

**当前日期:** ${currentDate}`;

        // 如果有股票数据上下文，添加到提示词中
        if (stockContext && stockContext.data && stockContext.data.length > 0) {
            const stockInfo = this.formatStockDataForPrompt(stockContext);
            systemPrompt += `\n\n**当前分析股票:**\n${stockInfo}`;
        }

        systemPrompt += `\n\n**重要提醒:** 以上分析仅供参考，不构成投资建议。股市有风险，投资需谨慎。`;

        return systemPrompt;
    }

    /**
     * 将股票数据格式化为AI提示词
     * 
     * @param {Object} stockData - 股票数据
     * @returns {string} 格式化的股票数据描述
     */
    formatStockDataForPrompt(stockData) {
        const { code, name, currentPrice, data, summary, period } = stockData;
        
        if (!data || data.length === 0) {
            return '暂无股票数据';
        }

        const recentData = data.slice(-10); // 最近10天数据
        const latestData = data[data.length - 1];
        
        let prompt = `**股票基本信息:**
- 股票代码: ${code}
- 股票名称: ${name}
- 当前价格: ${currentPrice}元
`;

        // 安全处理period字段
        if (period && period.start && period.end && period.totalDays) {
            prompt += `- 分析周期: ${period.start} 至 ${period.end} (${period.totalDays}个交易日)\n\n`;
        } else {
            prompt += `- 分析周期: 近期数据\n\n`;
        }

        prompt += `**关键统计数据:**`;

        if (summary) {
            prompt += `
- 期间涨跌幅: ${summary.changePercent || 0}%
- 最高价: ${summary.maxPrice || 'N/A'}元
- 最低价: ${summary.minPrice || 'N/A'}元
- 平均成交量: ${summary.avgVolume || 'N/A'}万手
- 价格波动率: ${summary.maxPrice && summary.minPrice ? ((summary.maxPrice - summary.minPrice) / summary.minPrice * 100).toFixed(2) : 'N/A'}%`;
        }

        if (latestData) {
            prompt += `\n\n**最新交易数据:**
- 最新收盘价: ${latestData.close || 'N/A'}元
- 开盘价: ${latestData.open || 'N/A'}元
- 最高价: ${latestData.high || 'N/A'}元
- 最低价: ${latestData.low || 'N/A'}元
- 成交量: ${latestData.volume || 'N/A'}万手`;
            
            if (latestData.high && latestData.low && latestData.low > 0) {
                prompt += `\n- 振幅: ${((latestData.high - latestData.low) / latestData.low * 100).toFixed(2)}%`;
            }
        }

        prompt += `\n\n**最近交易历史 (最近10个交易日):**`;

        recentData.forEach((day, index) => {
            const prevDay = index > 0 ? recentData[index - 1] : null;
            const changePercent = prevDay && prevDay.close && day.close ? 
                ((day.close - prevDay.close) / prevDay.close * 100).toFixed(2) : '0.00';
            const changeSymbol = changePercent > 0 ? '+' : '';
            
            prompt += `\n${day.date || '未知日期'}: 收盘${day.close || 'N/A'}元 (${changeSymbol}${changePercent}%), 成交量${day.volume || 'N/A'}万手`;
        });

        return prompt;
    }

    /**
     * 调用AI分析
     * 
     * @param {string} userMessage - 用户消息
     * @param {Object} stockContext - 股票数据上下文
     * @returns {Promise<string>} AI响应
     */
    async analyzeWithAI(userMessage, stockContext) {
        try {
            const systemPrompt = this.generateSystemPrompt(stockContext);
            
            // 根据配置选择对应的客户端和模型
            const { client, model, maxTokens, temperature } = this.getClientConfig();

            if (!client) {
                throw new Error('没有可用的AI客户端');
            }

            console.log(`🤖 使用${this.provider}模型进行分析: ${model}`);
            console.log(`🔗 API端点: ${client.baseURL}`);
            console.log(`🔑 API密钥前缀: ${process.env.OPENAI_API_KEY ? process.env.OPENAI_API_KEY.substring(0, 10) + '...' : '未配置'}`);

            // 添加请求超时控制，防止AI响应过慢
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => {
                    reject(new Error(`AI请求超时（${this.provider}模型响应时间超过60秒）`));
                }, 60000); // 60秒超时
            });

            const aiRequestPromise = client.chat.completions.create({
                model: model,
                messages: [
                    {
                        role: "system",
                        content: systemPrompt
                    },
                    {
                        role: "user", 
                        content: userMessage
                    }
                ],
                max_tokens: maxTokens,
                temperature: temperature
                // 移除gpt-5-nano不支持的参数
            });

            // 使用Promise.race实现超时控制
            const completion = await Promise.race([aiRequestPromise, timeoutPromise]);

            console.log(`📝 收到API响应:`, JSON.stringify(completion, null, 2));

            // 检查响应结构
            if (!completion || !completion.choices || completion.choices.length === 0) {
                console.error(`❌ 响应结构错误:`, {
                    hasCompletion: !!completion,
                    hasChoices: completion && !!completion.choices,
                    choicesLength: completion && completion.choices ? completion.choices.length : 0,
                    fullResponse: completion
                });
                throw new Error('空的API响应或无有效选择');
            }

            const response = completion.choices[0].message?.content;
            if (!response) {
                throw new Error('空的响应内容');
            }
            
            console.log(`✅ AI分析完成，响应长度: ${response.length}`);
            
            return response;

        } catch (error) {
            console.error(`❌ AI分析失败 (${this.provider}):`, error.message);
            
            // 降级到本地规则引擎
            console.log('🔄 降级到本地规则引擎');
            return this.fallbackToLocalAnalysis(userMessage, stockContext);
        }
    }

    /**
     * 获取对应的客户端配置
     * 
     * @returns {Object} 客户端配置信息
     */
    getClientConfig() {
        switch (this.provider) {
            case 'openai':
                return {
                    client: this.openaiClient,
                    model: process.env.OPENAI_MODEL || 'gpt-3.5-turbo',
                    maxTokens: parseInt(process.env.OPENAI_MAX_TOKENS) || 2000,
                    temperature: parseFloat(process.env.OPENAI_TEMPERATURE) || 0.7
                };
            case 'zhipu':
                return {
                    client: this.zhipuClient,
                    model: process.env.ZHIPU_MODEL || 'GLM-4.5-Flash',
                    maxTokens: parseInt(process.env.ZHIPU_MAX_TOKENS) || 2000,
                    temperature: parseFloat(process.env.ZHIPU_TEMPERATURE) || 0.7
                };
            case 'moonshot':
                return {
                    client: this.moonshotClient,
                    model: process.env.MOONSHOT_MODEL || 'moonshot-v1-8k',
                    maxTokens: parseInt(process.env.MOONSHOT_MAX_TOKENS) || 2000,
                    temperature: parseFloat(process.env.MOONSHOT_TEMPERATURE) || 0.7
                };
            case 'deepseek':
                return {
                    client: this.deepseekClient,
                    model: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
                    maxTokens: parseInt(process.env.DEEPSEEK_MAX_TOKENS) || 2000,
                    temperature: parseFloat(process.env.DEEPSEEK_TEMPERATURE) || 0.7
                };
            case 'claude':
                return {
                    client: this.claudeClient,
                    model: process.env.CLAUDE_MODEL || 'claude-3-haiku-20240307',
                    maxTokens: parseInt(process.env.CLAUDE_MAX_TOKENS) || 2000,
                    temperature: parseFloat(process.env.CLAUDE_TEMPERATURE) || 0.7
                };
            case 'lmstudio':
                return {
                    client: this.lmstudioClient,
                    model: process.env.LMSTUDIO_MODEL || 'local-model',
                    maxTokens: parseInt(process.env.LMSTUDIO_MAX_TOKENS) || 2000,
                    temperature: parseFloat(process.env.LMSTUDIO_TEMPERATURE) || 0.7
                };
            default:
                return { client: null, model: '', maxTokens: 2000, temperature: 0.7 };
        }
    }

    /**
     * 本地规则引擎降级分析
     * 
     * @param {string} userMessage - 用户消息
     * @param {Object} stockContext - 股票数据上下文
     * @returns {string} 本地分析响应
     */
    fallbackToLocalAnalysis(userMessage, stockContext) {
        const message = userMessage.toLowerCase();
        
        // 基础问候
        if (message.includes('你好') || message.includes('hello')) {
            return '您好！我是智能金融分析助手。由于AI服务暂时不可用，我将使用本地分析为您提供基础的股票分析。请告诉我您想了解什么？';
        }
        
        if (message.includes('帮助') || message.includes('help')) {
            return `📊 **本地分析模式**

我可以为您提供以下基础分析：
- 📈 **趋势分析**: 基于价格走势判断趋势
- 💰 **投资建议**: 基于技术指标的简单建议  
- ⚠️ **风险评估**: 价格波动和风险提示
- 📊 **数据解读**: 基础的数据统计分析

*注: 当前为本地分析模式，建议配置AI服务获得更专业的分析*`;
        }

        // 如果有股票数据，进行基础分析
        if (stockContext && stockContext.data && stockContext.data.length > 0) {
            return this.generateBasicStockAnalysis(stockContext, message);
        }

        return '请先选择一只股票进行分析。您可以在左侧图表区域输入股票代码获取数据。';
    }

    /**
     * 生成基础股票分析
     * 
     * @param {Object} stockContext - 股票数据
     * @param {string} userMessage - 用户消息
     * @returns {string} 基础分析结果
     */
    generateBasicStockAnalysis(stockContext, userMessage) {
        const { name, summary, data } = stockContext;
        const latestData = data[data.length - 1];
        
        let analysis = `📊 **${name} - 基础分析报告**\n\n`;
        
        // 趋势分析
        if (userMessage.includes('趋势') || userMessage.includes('走势')) {
            let trend = '';
            if (summary.changePercent > 10) trend = '强势上涨 🚀';
            else if (summary.changePercent > 3) trend = '温和上涨 📈';
            else if (summary.changePercent > -3) trend = '横盘震荡 ↔️';
            else if (summary.changePercent > -10) trend = '小幅下跌 📉';
            else trend = '深度调整 ⬇️';
            
            analysis += `**趋势判断**: ${trend}\n`;
            analysis += `**涨跌幅**: ${summary.changePercent}%\n`;
            analysis += `**波动幅度**: ${((summary.maxPrice - summary.minPrice) / summary.minPrice * 100).toFixed(2)}%\n\n`;
        }
        
        // 风险分析
        if (userMessage.includes('风险')) {
            const volatility = ((summary.maxPrice - summary.minPrice) / summary.minPrice * 100).toFixed(2);
            let riskLevel = '中等';
            if (Number(volatility) > 30) riskLevel = '较高';
            else if (Number(volatility) < 15) riskLevel = '较低';
            
            analysis += `⚠️ **风险评估**: ${riskLevel}风险\n`;
            analysis += `**价格波动**: ${volatility}%\n`;
            analysis += `**最大回撤**: ${((summary.maxPrice - latestData.close) / summary.maxPrice * 100).toFixed(2)}%\n\n`;
        }
        
        // 投资建议
        if (userMessage.includes('买入') || userMessage.includes('投资')) {
            let advice = '';
            if (summary.changePercent > 0 && summary.changePercent < 20) {
                advice = '可适当关注，建议分批建仓 💡';
            } else if (summary.changePercent > 20) {
                advice = '涨幅较大，注意高位风险 ⚠️';
            } else {
                advice = '可关注企稳信号，谨慎操作 🔍';
            }
            
            analysis += `**操作建议**: ${advice}\n\n`;
        }
        
        analysis += `**关键数据**:\n`;
        analysis += `- 最新价格: ${latestData.close}元\n`;
        analysis += `- 价格区间: ${summary.minPrice}～${summary.maxPrice}元\n`;
        analysis += `- 平均成交量: ${summary.avgVolume}万手\n\n`;
        
        analysis += `*📝 注: 本分析基于技术指标，仅供参考，不构成投资建议*`;
        
        return analysis;
    }

    /**
     * 检查AI服务状态
     * 
     * @returns {Object} 服务状态信息
     */
    getServiceStatus() {
        return {
            provider: this.provider,
            clients: {
                openai: !!this.openaiClient,
                zhipu: !!this.zhipuClient,
                moonshot: !!this.moonshotClient,
                deepseek: !!this.deepseekClient,
                claude: !!this.claudeClient,
                lmstudio: !!this.lmstudioClient
            },
            available: this.provider !== 'disabled' && this.isCurrentProviderAvailable(),
            models: {
                openai: process.env.OPENAI_MODEL || 'gpt-3.5-turbo',
                zhipu: process.env.ZHIPU_MODEL || 'GLM-4.5-Flash',
                moonshot: process.env.MOONSHOT_MODEL || 'moonshot-v1-8k',
                deepseek: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
                claude: process.env.CLAUDE_MODEL || 'claude-3-haiku-20240307',
                lmstudio: process.env.LMSTUDIO_MODEL || 'local-model'
            },
            baseUrls: {
                openai: process.env.OPENAI_BASE_URL,
                zhipu: process.env.ZHIPU_BASE_URL,
                moonshot: process.env.MOONSHOT_BASE_URL,
                deepseek: process.env.DEEPSEEK_BASE_URL,
                claude: process.env.CLAUDE_BASE_URL,
                lmstudio: process.env.LMSTUDIO_BASE_URL
            },
            currentModel: this.getCurrentModel()
        };
    }

    /**
     * 检查当前提供商是否可用
     * 
     * @returns {boolean} 是否可用
     */
    isCurrentProviderAvailable() {
        switch (this.provider) {
            case 'openai': return !!this.openaiClient;
            case 'zhipu': return !!this.zhipuClient;
            case 'moonshot': return !!this.moonshotClient;
            case 'deepseek': return !!this.deepseekClient;
            case 'claude': return !!this.claudeClient;
            case 'lmstudio': return !!this.lmstudioClient;
            default: return false;
        }
    }

    /**
     * 获取当前模型名称
     * 
     * @returns {string} 模型名称
     */
    getCurrentModel() {
        const config = this.getClientConfig();
        return config.model;
    }

    /**
     * 切换AI服务提供商
     * 
     * @param {string} newProvider - 新的提供商
     * @returns {Promise<Object>} 切换结果
     */
    async switchProvider(newProvider) {
        const supportedProviders = ['openai', 'zhipu', 'moonshot', 'deepseek', 'claude', 'lmstudio', 'disabled'];
        
        if (!supportedProviders.includes(newProvider)) {
            throw new Error(`不支持的提供商: ${newProvider}`);
        }

        const oldProvider = this.provider;
        this.provider = newProvider;

        try {
            // 重新初始化客户端
            this.initializeClients();
            
            console.log(`🔄 AI提供商已切换: ${oldProvider} -> ${newProvider}`);
            
            return {
                success: true,
                oldProvider,
                newProvider,
                available: this.isCurrentProviderAvailable(),
                message: `已成功切换到 ${newProvider}`
            };
        } catch (error) {
            // 如果切换失败，恢复到原来的提供商
            this.provider = oldProvider;
            this.initializeClients();
            
            throw new Error(`切换到 ${newProvider} 失败: ${error.message}`);
        }
    }

    /**
     * 获取所有支持的提供商和其状态
     * 
     * @returns {Object} 提供商列表和状态
     */
    getAllProviders() {
        return {
            current: this.provider,
            available: {
                openai: {
                    name: 'OpenAI',
                    description: 'GPT系列模型（支持自定义URL）',
                    configured: !!process.env.OPENAI_API_KEY,
                    model: process.env.OPENAI_MODEL || 'gpt-3.5-turbo',
                    baseUrl: process.env.OPENAI_BASE_URL
                },
                zhipu: {
                    name: '智谱AI',
                    description: 'GLM系列大模型',
                    configured: !!process.env.ZHIPU_API_KEY,
                    model: process.env.ZHIPU_MODEL || 'GLM-4.5-Flash',
                    baseUrl: process.env.ZHIPU_BASE_URL
                },
                moonshot: {
                    name: '月之暗面Kimi',
                    description: 'Moonshot系列模型',
                    configured: !!process.env.MOONSHOT_API_KEY,
                    model: process.env.MOONSHOT_MODEL || 'moonshot-v1-8k',
                    baseUrl: process.env.MOONSHOT_BASE_URL
                },
                deepseek: {
                    name: 'DeepSeek',
                    description: 'DeepSeek系列模型',
                    configured: !!process.env.DEEPSEEK_API_KEY,
                    model: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
                    baseUrl: process.env.DEEPSEEK_BASE_URL
                },
                claude: {
                    name: 'Claude',
                    description: 'Anthropic Claude模型',
                    configured: !!process.env.CLAUDE_API_KEY,
                    model: process.env.CLAUDE_MODEL || 'claude-3-haiku-20240307',
                    baseUrl: process.env.CLAUDE_BASE_URL
                },
                lmstudio: {
                    name: 'LMStudio',
                    description: '本地部署大语言模型',
                    configured: true, // LMStudio不需要API密钥
                    model: process.env.LMSTUDIO_MODEL || 'local-model',
                    baseUrl: process.env.LMSTUDIO_BASE_URL
                },
                disabled: {
                    name: '禁用AI',
                    description: '使用本地规则引擎',
                    configured: true,
                    model: 'local-rules',
                    baseUrl: 'local'
                }
            }
        };
    }
}

module.exports = new AIService();