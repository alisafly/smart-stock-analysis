/**
 * ChatPanel组件 - AI对话交互面板
 * 
 * 主要功能：
 * 1. 消息列表展示和滚动
 * 2. 用户输入和发送
 * 3. AI响应展示
 * 4. 股票数据上下文传递
 * 5. 对话历史管理
 */

import React, { useState, useRef, useEffect } from 'react';
import { chatAPI } from '../utils/api';
import LoadingSpinner from './LoadingSpinner';

interface Message {
  id: string;
  type: 'user' | 'ai';
  content: string;
  timestamp: string;
}

interface ChatPanelProps {
  stockContext: any;
  onError: (error: string) => void;
}

const ChatPanel: React.FC<ChatPanelProps> = ({ stockContext, onError }) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      type: 'ai',
      content: '您好！我是智能金融分析助手。我可以帮您分析股票数据、解读市场趋势、提供投资建议。请告诉我您想了解什么？',
      timestamp: new Date().toISOString()
    }
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  /**
   * 滚动到消息底部
   */
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  /**
   * 发送消息到AI
   */
  const sendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content: inputMessage.trim(),
      timestamp: new Date().toISOString()
    };

    // 添加用户消息
    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsLoading(true);

    try {
      // 调用AI API
      const response = await chatAPI.sendMessage(inputMessage.trim(), stockContext);
      
      // 添加AI响应
      const aiMessage: Message = {
        id: response.conversationId || Date.now().toString() + '_ai',
        type: 'ai',
        content: response.response,
        timestamp: response.timestamp
      };
      
      setMessages(prev => [...prev, aiMessage]);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'AI服务暂时不可用';
      onError(`AI聊天错误: ${errorMessage}`);
      
      // 添加错误提示消息
      const errorMsg: Message = {
        id: Date.now().toString() + '_error',
        type: 'ai',
        content: '抱歉，我暂时无法处理您的请求。请稍后重试。',
        timestamp: new Date().toISOString()
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * 处理输入框回车事件
   */
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  /**
   * 清除对话历史
   */
  const clearChat = async () => {
    try {
      await chatAPI.clearChatHistory();
      setMessages([{
        id: '1',
        type: 'ai',
        content: '对话历史已清除。您好！我是智能金融分析助手，有什么可以帮您的吗？',
        timestamp: new Date().toISOString()
      }]);
    } catch (error) {
      onError('清除对话历史失败');
    }
  };

  /**
   * 格式化时间显示
   */
  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="card h-full flex flex-col">
      {/* 聊天头部 */}
      <div className="flex items-center justify-between mb-4 pb-4 border-b border-gray-200">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">AI智能分析</h3>
          <p className="text-sm text-gray-600">
            {stockContext ? `正在分析: ${stockContext.name}` : '等待股票数据...'}
          </p>
        </div>
        <button
          onClick={clearChat}
          className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
          title="清除对话"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>

      {/* 消息列表 */}
      <div className="flex-1 overflow-y-auto scrollbar-thin space-y-4 mb-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] rounded-lg px-4 py-2 ${
                message.type === 'user'
                  ? 'bg-primary-600 text-white ml-4'
                  : 'bg-gray-100 text-gray-900 mr-4'
              }`}
            >
              <div className="text-sm whitespace-pre-wrap">{message.content}</div>
              <div
                className={`text-xs mt-1 ${
                  message.type === 'user' ? 'text-primary-100' : 'text-gray-500'
                }`}
              >
                {formatTime(message.timestamp)}
              </div>
            </div>
          </div>
        ))}
        
        {/* 加载指示器 */}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 rounded-lg px-4 py-2 mr-4">
              <LoadingSpinner size="small" />
              <div className="text-xs text-gray-500 mt-1">AI正在思考...</div>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* 输入区域 */}
      <div className="border-t border-gray-200 pt-4">
        {/* 快捷问题按钮 */}
        <div className="mb-3 flex flex-wrap gap-2">
          {[
            '这只股票的趋势如何？',
            '现在适合买入吗？',
            '有什么投资风险？',
            '技术指标分析'
          ].map((question, index) => (
            <button
              key={index}
              onClick={() => setInputMessage(question)}
              className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1 rounded-full transition-colors"
              disabled={isLoading}
            >
              {question}
            </button>
          ))}
        </div>

        {/* 输入框和发送按钮 */}
        <div className="flex items-end space-x-2">
          <div className="flex-1">
            <textarea
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="输入您的问题... (按Enter发送)"
              className="input resize-none"
              rows={2}
              disabled={isLoading}
              maxLength={500}
            />
            <div className="text-xs text-gray-500 mt-1">
              {inputMessage.length}/500
            </div>
          </div>
          
          <button
            onClick={sendMessage}
            disabled={!inputMessage.trim() || isLoading}
            className="btn btn-primary h-fit whitespace-nowrap"
          >
            {isLoading ? (
              <LoadingSpinner size="small" />
            ) : (
              <>
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
                发送
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatPanel;