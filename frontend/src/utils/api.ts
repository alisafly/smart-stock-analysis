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
  timeout: 30000,  // 增加到30秒，适应AI调用的响应时间
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

// 响应拦截器
apiClient.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    console.error('API响应错误:', error);
    if (error.response) {
      // 服务器返回错误状态码
      throw new Error(error.response.data?.error || '服务器错误');
    } else if (error.request) {
      // 网络错误
      throw new Error('网络连接错误，请检查网络状态');
    } else {
      // 其他错误
      throw new Error('请求失败');
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

// AI聊天接口
export const chatAPI = {
  // 发送聊天消息
  sendMessage: async (message: string, stockContext?: any) => {
    const response = await apiClient.post('/chat', {
      message,
      stockContext,
      conversationId: Date.now().toString(),
    });
    return response.data;
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
};

export default apiClient;