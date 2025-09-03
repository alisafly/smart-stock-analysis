/**
 * API工具模块
 * 封装所有与后端API的通信逻辑
 */

import axios from 'axios';

// API基础配置
// 使用相对路径启用Vite代理，解决CORS问题
const API_BASE_URL = '/api';

// 创建axios实例
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 65000,  // 65秒超时，确保比后端60秒超时更长
  headers: {
    'Content-Type': 'application/json',
  },
});

// 请求拦截器
apiClient.interceptors.request.use(
  (config) => {
    console.log(`API请求: ${config.method?.toUpperCase()} ${config.url}`);
    return config;
  },
  (error) => {
    console.error('API请求错误:', error);
    return Promise.reject(error);
  }
);

// 响应拦截器 - 增强错误处理和重试机制
apiClient.interceptors.response.use(
  (response) => {
    return response;
  },
  async (error) => {
    console.error('API响应错误:', error);
    
    // 网络连接错误处理
    if (error.code === 'ECONNREFUSED' || error.code === 'ERR_NETWORK') {
      throw new Error('后端服务未启动，请检查后端服务是否运行在 http://localhost:3002');
    }
    
    if (error.response) {
      // 服务器返回错误状态码
      const statusCode = error.response.status;
      const errorMessage = error.response.data?.error || '服务器错误';
      
      switch (statusCode) {
        case 401:
          throw new Error('AI API密钥验证失败，请检查配置');
        case 429:
          throw new Error('API调用频率限制，请稍后重试');
        case 500:
          throw new Error(`服务器内部错误: ${errorMessage}`);
        case 503:
          throw new Error('AI服务不可用，请稍后重试');
        default:
          throw new Error(`HTTP ${statusCode}: ${errorMessage}`);
      }
    } else if (error.request) {
      // 网络错误
      if (error.message.includes('timeout')) {
        throw new Error('AI响应超时，请稍后重试');
      }
      throw new Error('网络连接错误，请检查网络状态');
    } else {
      // 其他错误
      throw new Error('请求失败: ' + error.message);
    }
  }
);

// 股票数据接口
export const stockAPI = {
  // 获取股票历史数据
  getStockData: async (code: string, startDate: string, endDate: string) => {
    const response = await apiClient.get(`/stock/${code}/${startDate}/${endDate}`);
    return response.data;
  },

  // 获取股票实时数据
  getRealtimeData: async (code: string) => {
    const response = await apiClient.get(`/stock/realtime/${code}`);
    return response.data;
  },

  // 获取股票分时数据
  getTickData: async (code: string, count: number = 50) => {
    const response = await apiClient.get(`/stock/tick/${code}?count=${count}`);
    return response.data;
  },

  // 获取大盘实时数据
  getMarketData: async () => {
    const response = await apiClient.get('/stock/market');
    return response.data;
  },

  // 获取股票列表
  getStockList: async () => {
    const response = await apiClient.get('/stock/list');
    return response.data;
  },

  // 搜索股票
  searchStock: async (keyword: string) => {
    const response = await apiClient.get(`/stock/search?keyword=${keyword}`);
    return response.data;
  },
};

// 重试机制函数
const retryRequest = async (fn: () => Promise<any>, maxRetries = 2): Promise<any> => {
  let lastError;
  
  for (let i = 0; i <= maxRetries; i++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      
      // 如果是401或400错误，不重试
      if (error.message.includes('401') || error.message.includes('400')) {
        break;
      }
      
      // 最后一次尝试失败后不再重试
      if (i === maxRetries) {
        break;
      }
      
      // 等待一段时间后重试
      const delay = Math.pow(2, i) * 1000; // 指数退避: 1s, 2s, 4s
      console.log(`API请求失败，${delay/1000}秒后进行第${i+1}次重试...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
};

// AI聊天接口
export const chatAPI = {
  // 发送聊天消息 - 减少重试次数，避免多次长时间等待
  sendMessage: async (message: string, stockContext?: any) => {
    return retryRequest(async () => {
      const response = await apiClient.post('/chat', {
        message,
        stockContext,
        conversationId: Date.now().toString(),
      });
      return response.data;
    }, 1); // 仅重试1次，避免多次超时
  },

  // 获取对话历史
  getChatHistory: async (limit = 20) => {
    const response = await apiClient.get(`/chat/history?limit=${limit}`);
    return response.data;
  },

  // 清除对话历史
  clearChatHistory: async () => {
    const response = await apiClient.delete('/chat/history');
    return response.data;
  },

  // 获取AI服务状态
  getStatus: async () => {
    const response = await apiClient.get('/chat/status');
    return response.data;
  },

  // 切换AI模型
  switchModel: async (provider: string) => {
    const response = await apiClient.post('/chat/switch', { provider });
    return response.data;
  },

  // 获取所有可用的AI提供商
  getProviders: async () => {
    const response = await apiClient.get('/chat/providers');
    return response.data;
  },
};

export default apiClient;