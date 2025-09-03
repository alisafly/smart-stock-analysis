/**
 * 智能金融分析平台 - 主应用组件
 * 
 * 主要功能：
 * 1. 整体布局管理 (Header + 左右面板)
 * 2. 股票数据状态管理
 * 3. AI对话上下文传递
 * 4. 全局错误处理
 * 5. 响应式设计支持
 */

import React, { useState, useCallback } from 'react';
import Header from './components/Header';
import StockChart from './components/StockChart';
import ChatPanel from './components/ChatPanel';
import ErrorBoundary from './components/ErrorBoundary';
import LoadingSpinner from './components/LoadingSpinner';
import ResizableLayout from './components/ResizableLayout';

// 股票数据接口定义
interface StockData {
  code: string;
  name: string;
  currentPrice: number;
  data: Array<{
    date: string;
    open: number;
    close: number;
    high: number;
    low: number;
    volume: number;
  }>;
  period: {
    start: string;
    end: string;
    totalDays: number;
  };
  summary: {
    changePercent: number;
    maxPrice: number;
    minPrice: number;
    avgVolume: number;
  };
  timestamp: string;
}

// 应用状态接口
interface AppState {
  currentStockData: StockData | null;
  isLoading: boolean;
  error: string | null;
}

function App() {
  // 应用全局状态管理
  const [appState, setAppState] = useState<AppState>({
    currentStockData: null,
    isLoading: false,
    error: null
  });

  /**
   * 处理股票数据更新
   * 当用户在图表组件中选择新股票时调用
   * 
   * @param stockData - 新的股票数据
   */
  const handleStockDataUpdate = useCallback((stockData: StockData | null) => {
    setAppState(prev => ({
      ...prev,
      currentStockData: stockData,
      error: null
    }));
  }, []);

  /**
   * 处理加载状态变化
   * 显示/隐藏加载指示器
   * 
   * @param isLoading - 是否正在加载
   */
  const handleLoadingChange = useCallback((isLoading: boolean) => {
    setAppState(prev => ({
      ...prev,
      isLoading
    }));
  }, []);

  /**
   * 处理错误状态
   * 统一的错误处理和显示
   * 
   * @param error - 错误信息
   */
  const handleError = useCallback((error: string | null) => {
    setAppState(prev => ({
      ...prev,
      error,
      isLoading: false
    }));
  }, []);

  /**
   * 清除错误状态
   * 用户确认错误信息后清除
   */
  const clearError = useCallback(() => {
    setAppState(prev => ({
      ...prev,
      error: null
    }));
  }, []);

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-gray-50">
        {/* 应用头部 */}
        <Header />
        
        {/* 主要内容区域 */}
        <main className="container mx-auto px-4 py-6">
          {/* 全局错误提示 */}
          {appState.error && (
            <div className="mb-6 bg-danger-50 border border-danger-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <svg className="w-5 h-5 text-danger-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                  <span className="text-danger-800 font-medium">错误：{appState.error}</span>
                </div>
                <button
                  onClick={clearError}
                  className="text-danger-600 hover:text-danger-800 transition-colors"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
            </div>
          )}
          
          {/* 全局加载状态 */}
          {appState.isLoading && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <LoadingSpinner size="large" />
            </div>
          )}
          
          {/* 主要内容布局 */}
          <div className="h-[calc(100vh-140px)]">
            <ResizableLayout
              leftPanel={
                <StockChart
                  onStockDataUpdate={handleStockDataUpdate}
                  onLoadingChange={handleLoadingChange}
                  onError={handleError}
                />
              }
              rightPanel={
                <ChatPanel
                  stockContext={appState.currentStockData}
                  onError={handleError}
                />
              }
              defaultLeftWidth={65}
              minLeftWidth={35}
              maxLeftWidth={80}
            />
          </div>
        </main>
      </div>
    </ErrorBoundary>
  );
}

export default App;
