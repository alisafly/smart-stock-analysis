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
import ReactMarkdown from 'react-markdown';
import { chatAPI } from '../utils/api';
import LoadingSpinner from './LoadingSpinner';

interface Message {
  id: string;
  type: 'user' | 'ai';
  content: string;
  timestamp: string;
  hasTable?: boolean; // 标记消息是否包含表格
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
      timestamp: new Date().toISOString(),
      hasTable: false
    }
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [hasTableContent, setHasTableContent] = useState(false); // 检测当前是否有表格内容
  const [dynamicWidth, setDynamicWidth] = useState('min-w-[400px]'); // 动态宽度类名
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  /**
   * 格式化数值显示（金融数据专用）
   */
  const formatFinancialValue = (value: string): string => {
    const text = value.trim();
    
    // 处理百分比
    if (text.includes('%')) {
      const match = text.match(/([+-]?\d+\.?\d*)%/);
      if (match) {
        const num = parseFloat(match[1]);
        return `${num >= 0 ? '+' : ''}${num.toFixed(2)}%`;
      }
    }
    
    // 处理货币值
    if (text.includes('￥') || text.includes('$')) {
      const match = text.match(/[￥$]([\d,]+\.?\d*)/);
      if (match) {
        const num = parseFloat(match[1].replace(/,/g, ''));
        const formatted = new Intl.NumberFormat('zh-CN', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
        }).format(num);
        return text.includes('￥') ? `￥${formatted}` : `$${formatted}`;
      }
    }
    
    // 处理纯数字（添加千分符）
    const numMatch = text.match(/^([+-]?\d+(?:\.\d+)?)$/);
    if (numMatch) {
      const num = parseFloat(numMatch[1]);
      return new Intl.NumberFormat('zh-CN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }).format(num);
    }
    
    return text;
  };

  /**
   * 智能检测单元格数据类型并应用相应样式
   */
  const getCellClassName = (content: string): string => {
    const text = content.toString().trim();
    
    // 检测百分比
    if (text.includes('%')) {
      return 'table-percentage';
    }
    
    // 检测货币
    if (text.includes('¥') || text.includes('$') || text.includes('€') || text.includes('￥')) {
      return 'table-currency';
    }
    
    // 检测数值
    const numericRegex = /^[+-]?\d+(\.\d+)?([eE][+-]?\d+)?$/;
    if (numericRegex.test(text) || /^[+-]?\d{1,3}(,\d{3})*(\.\d+)?$/.test(text)) {
      // 检测正负数
      const num = parseFloat(text.replace(/,/g, ''));
      if (num > 0) return 'table-positive table-numeric';
      if (num < 0) return 'table-negative table-numeric';
      return 'table-neutral table-numeric';
    }
    
    // 检测涨跌符号
    if (text.includes('↑') || text.includes('▲') || text.includes('+')) {
      return 'table-positive';
    }
    if (text.includes('↓') || text.includes('▼') || text.startsWith('-')) {
      return 'table-negative';
    }
    
    return 'table-neutral';
  };

  /**
   * 检测消息内容是否包含表格 - 增强版
   */
  const detectTableContent = (content: string): boolean => {
    // 多种 Markdown 表格格式检测
    const patterns = [
      // 标准 Markdown 表格格式
      /\|[^\n]*\|[^\n]*\n\s*\|[-:]+\|/,
      // 简单表格格式
      /\|.*\|.*\n.*\|.*\|/,
      // 对齐符表格
      /\|\s*[-:]+\s*\|/,
      // 复杂表格格式
      /\n\s*\|[^\n]*\|\s*\n\s*\|[-\s:|]+\|/
    ];
    
    // 检查是否匹配任何表格模式
    const hasTablePattern = patterns.some(pattern => pattern.test(content));
    
    // 额外检查：至少包含 3 个管道符并且有换行
    const hasMultiplePipes = content.includes('|') && 
                            (content.match(/\|/g) || []).length >= 3 &&
                            content.includes('\n');
    
    return hasTablePattern || hasMultiplePipes;
  };

  /**
   * 更新表格检测状态和动态宽度
   */
  const updateTableDetection = (messages: Message[]) => {
    const hasTable = messages.some(msg => msg.hasTable);
    setHasTableContent(hasTable);
    
    // 根据表格内容动态调整最小宽度
    if (hasTable) {
      // 检测表格复杂度来决定宽度
      const tableMessages = messages.filter(msg => msg.hasTable);
      const maxColumns = Math.max(...tableMessages.map(msg => {
        const matches = msg.content.match(/\|/g);
        return matches ? matches.length / 2 : 0; // 估算列数
      }));
      
      if (maxColumns > 6) {
        setDynamicWidth('min-w-[800px]');
      } else if (maxColumns > 4) {
        setDynamicWidth('min-w-[650px]');
      } else {
        setDynamicWidth('min-w-[500px]');
      }
    } else {
      setDynamicWidth('min-w-[400px]');
    }
  };

  /**
   * 滚动到消息底部
   */
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
    updateTableDetection(messages);
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
      
      // 检测响应中是否有表格
      const hasTable = detectTableContent(response.response);
      
      // 添加AI响应
      const aiMessage: Message = {
        id: response.conversationId || Date.now().toString() + '_ai',
        type: 'ai',
        content: response.response,
        timestamp: response.timestamp,
        hasTable
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
        timestamp: new Date().toISOString(),
        hasTable: false
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
        timestamp: new Date().toISOString(),
        hasTable: false
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
    <div 
      ref={chatContainerRef}
      className={`card h-full flex flex-col ${dynamicWidth} ${hasTableContent ? 'table-container' : ''}`}
    >
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
      <div className={`flex-1 overflow-y-auto scrollbar-thin space-y-4 mb-4 ${
        hasTableContent ? 'overflow-x-auto table-message-container' : ''
      }`}>
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`rounded-lg px-4 py-2 ${
                message.type === 'user'
                  ? 'bg-primary-600 text-white ml-4 max-w-[80%]'
                  : `bg-gray-100 text-gray-900 mr-4 ${
                      message.hasTable 
                        ? 'max-w-full overflow-x-auto table-message' 
                        : 'max-w-[80%]'
                    }`
              }`}
            >
              <div className="text-sm">
                {message.type === 'ai' ? (
                  <div className={message.hasTable ? 'overflow-x-auto table-wrapper' : ''}>
                    <ReactMarkdown 
                      components={{
                        table: ({children}) => (
                          <div className="overflow-x-auto my-4 rounded-lg border border-gray-200 shadow-sm bg-white">
                            <table className="min-w-full border-collapse text-xs table-auto financial-table">
                              {children}
                            </table>
                          </div>
                        ),
                        thead: ({children}) => (
                          <thead className="bg-gradient-to-r from-slate-50 to-blue-50 sticky top-0 z-10">
                            {children}
                          </thead>
                        ),
                        tbody: ({children}) => (
                          <tbody className="divide-y divide-gray-100 bg-white">
                            {children}
                          </tbody>
                        ),
                        tr: ({children, ...props}) => {
                          // 区分表头和表体行
                          try {
                            const isHeaderRow = React.Children.toArray(children).some(
                              child => React.isValidElement(child) && child.type === 'th'
                            );
                            
                            return (
                              <tr className={`
                                ${isHeaderRow 
                                  ? 'bg-gradient-to-r from-slate-50 to-blue-50 border-b-2 border-blue-200' 
                                  : 'hover:bg-blue-25 transition-colors duration-150 border-b border-gray-100'
                                }
                              `}>
                                {children}
                              </tr>
                            );
                          } catch (error) {
                            console.warn('表格行渲染错误:', error);
                            return <tr className="border-b border-gray-100">{children}</tr>;
                          }
                        },
                        td: ({children}) => {
                          try {
                            const cellContent = React.Children.toArray(children).join('');
                            const cellClass = getCellClassName(cellContent);
                            const formattedContent = formatFinancialValue(cellContent);
                            
                            return (
                              <td className={`px-4 py-3 text-xs align-top min-w-[100px] max-w-[250px] break-words financial-cell ${cellClass}`}>
                                <div className="whitespace-normal leading-relaxed">
                                  {formattedContent || children}
                                </div>
                              </td>
                            );
                          } catch (error) {
                            console.warn('表格单元格渲染错误:', error);
                            return (
                              <td className="px-4 py-3 text-xs align-top financial-cell">
                                <div className="whitespace-normal leading-relaxed">{children}</div>
                              </td>
                            );
                          }
                        },
                        th: ({children}) => (
                          <th className="px-4 py-3 text-xs font-bold text-left min-w-[100px] max-w-[250px] financial-header">
                            <div className="whitespace-normal uppercase tracking-wider text-slate-700 font-semibold">
                              {children}
                            </div>
                          </th>
                        ),
                        p: ({children}) => (
                          <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>
                        ),
                        strong: ({children}) => (
                          <strong className="font-semibold text-gray-800">{children}</strong>
                        ),
                        h1: ({children}) => (
                          <h1 className="text-lg font-bold mb-3 text-gray-800 border-b border-gray-200 pb-1">{children}</h1>
                        ),
                        h2: ({children}) => (
                          <h2 className="text-base font-bold mb-2 text-gray-800">{children}</h2>
                        ),
                        h3: ({children}) => (
                          <h3 className="text-sm font-bold mb-2 text-gray-800">{children}</h3>
                        ),
                        ul: ({children}) => (
                          <ul className="list-disc list-inside mb-2 ml-2 space-y-1">{children}</ul>
                        ),
                        ol: ({children}) => (
                          <ol className="list-decimal list-inside mb-2 ml-2 space-y-1">{children}</ol>
                        ),
                        li: ({children}) => (
                          <li className="mb-1 text-xs leading-relaxed">{children}</li>
                        ),
                        blockquote: ({children}) => (
                          <blockquote className="border-l-4 border-blue-300 pl-4 py-2 my-3 bg-blue-50 text-gray-700 text-xs italic rounded-r-lg">
                            {children}
                          </blockquote>
                        ),
                        code: ({children}) => (
                          <code className="bg-gray-200 px-2 py-1 rounded text-xs font-mono break-words">{children}</code>
                        )
                      }}
                    >
                      {message.content}
                    </ReactMarkdown>
                  </div>
                ) : (
                  <div className="whitespace-pre-wrap">{message.content}</div>
                )}
              </div>
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
            '技术指标分析',
            '显示表格演示' // 添加表格测试按钮
          ].map((question, index) => (
            <button
              key={index}
              onClick={() => {
                if (question === '显示表格演示') {
                  // 添加一个测试表格消息
                  const testTableMessage: Message = {
                    id: Date.now().toString(),
                    type: 'ai',
                    content: `## 股票分析报告

以下是目前市场上热门股票的表现情况：

| 股票代码 | 股票名称 | 当前价格 | 涨跌幅 | 成交量 | 市值(亿元) | 投资建议 |
|---------|---------|----------|--------|--------|------------|----------|
| 000001 | 平安银行 | ￥15.68 | +2.34% | 1.2亿手 | 3028.5 | 买入 ↑ |
| 600036 | 招商银行 | ￥42.15 | -1.23% | 8900万手 | 11250.8 | 持有 |
| 600519 | 贵州茅台 | ￥1680.50 | +0.89% | 156万手 | 21138.7 | 买入 ↑ |
| 000858 | 五粮液 | ￥128.90 | -0.45% | 234万手 | 4856.2 | 观望 |
| 300014 | 亿纬锂业 | ￥18.72 | +5.67% | 3.8亿手 | 1204.5 | 买入 ↑ |

**分析结论：**
- 金融股表现稳健，建议重点关注
- 白酒行业优势明显，值得投资
- 新能源板块活跃，短线机会较多`,
                    timestamp: new Date().toISOString(),
                    hasTable: true
                  };
                  setMessages(prev => [...prev, testTableMessage]);
                } else {
                  setInputMessage(question);
                }
              }}
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