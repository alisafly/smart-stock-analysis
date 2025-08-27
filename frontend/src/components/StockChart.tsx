/**
 * StockChart组件 - 股票和指数图表展示 (增强版)
 * 
 * 主要功能：
 * 1. 支持股票和指数数据混合查询
 * 2. Chart.js线性时间序列图表
 * 3. 智能代码类型识别和验证
 * 4. 常用指数快速选择按钮
 * 5. 日期范围选择器（股票和指数通用）
 * 6. 数据获取和展示
 * 7. 不同类型数据的差异化展示
 * 8. 响应式图表设计
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  TimeScale,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import 'chartjs-adapter-date-fns';
import { stockAPI } from '../utils/api';
import { getDefaultDateRange, formatDate } from '../utils/dateUtils';
import LoadingSpinner from './LoadingSpinner';

// 注册Chart.js组件
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  TimeScale
);

// 常用指数快速选择配置
const POPULAR_INDICES = [
  { code: '000001.SH', name: '上证指数', color: '#dc2626' },
  { code: '399001.SZ', name: '深证成指', color: '#059669' },
  { code: '399006.SZ', name: '创业板指', color: '#7c3aed' },
  { code: '399005.SZ', name: '中小板指', color: '#dc2626' },
  { code: '000300.SH', name: '沪深300', color: '#2563eb' },
  { code: '000905.SH', name: '中证500', color: '#ea580c' }
];

// 常用股票快速选择配置
const POPULAR_STOCKS = [
  { code: '000001', name: '平安银行' },
  { code: '000002', name: '万科A' },
  { code: '600036', name: '招商银行' },
  { code: '600519', name: '贵州茅台' },
  { code: '000858', name: '五粮液' }
];

interface StockChartProps {
  onStockDataUpdate: (data: any) => void;
  onLoadingChange: (isLoading: boolean) => void;
  onError: (error: string) => void;
}

/**
 * 识别输入代码的类型
 * 
 * @param code - 输入的股票/指数代码
 * @returns 代码类型：'stock' | 'index' | 'unknown'
 */
const identifySymbolType = (code: string): 'stock' | 'index' | 'unknown' => {
  if (!code) return 'unknown';
  
  // 指数代码：以.SH或.SZ结尾
  if (code.endsWith('.SH') || code.endsWith('.SZ')) {
    return 'index';
  }
  
  // 股票代码：6位数字
  if (/^[0-9]{6}$/.test(code)) {
    return 'stock';
  }
  
  return 'unknown';
};

/**
 * 获取代码类型对应的颜色主题
 * 
 * @param symbolType - 代码类型
 * @param code - 具体代码
 * @returns 颜色配置
 */
const getColorTheme = (symbolType: string, code: string) => {
  if (symbolType === 'index') {
    // 为不同指数使用不同颜色
    const indexConfig = POPULAR_INDICES.find(idx => idx.code === code);
    return {
      line: indexConfig?.color || '#dc2626',
      background: indexConfig?.color ? `${indexConfig.color}20` : '#dc262620'
    };
  } else {
    // 股票使用蓝色主题
    return {
      line: '#2563eb',
      background: '#2563eb20'
    };
  }
};

const StockChart: React.FC<StockChartProps> = ({
  onStockDataUpdate,
  onLoadingChange,
  onError,
}) => {
  // 组件状态管理
  const [stockCode, setStockCode] = useState('000001'); // 默认平安银行
  const [dateRange, setDateRange] = useState(getDefaultDateRange());
  const [stockData, setStockData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'stock' | 'index'>('stock'); // 当前活跃的标签页
  const [searchHistory, setSearchHistory] = useState<string[]>([]); // 搜索历史

  /**
   * 获取股票/指数数据 - 增强版
   * 支持股票和指数数据的混合查询
   */
  const fetchStockData = useCallback(async () => {
    if (!stockCode || !dateRange.startDate || !dateRange.endDate) return;

    // 验证代码格式
    const symbolType = identifySymbolType(stockCode);
    if (symbolType === 'unknown') {
      onError('不支持的代码格式，请输入正确的股票代码（6位数字）或指数代码（以.SH或.SZ结尾）');
      return;
    }

    setIsLoading(true);
    onLoadingChange(true);

    try {
      console.log(`获取${symbolType === 'index' ? '指数' : '股票'}数据: ${stockCode}`);
      
      const data = await stockAPI.getStockData(
        stockCode,
        dateRange.startDate,
        dateRange.endDate
      );
      
      if (data.success) {
        setStockData(data);
        onStockDataUpdate(data);
        onError(''); // 清除错误
        
        // 添加到搜索历史
        setSearchHistory(prev => {
          const newHistory = [stockCode, ...prev.filter(code => code !== stockCode)];
          return newHistory.slice(0, 5); // 保留最近5条记录
        });
      } else {
        throw new Error(data.error || '获取数据失败');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '获取数据失败';
      onError(`获取${symbolType === 'index' ? '指数' : '股票'}数据失败: ${errorMessage}`);
      setStockData(null);
      onStockDataUpdate(null);
    } finally {
      setIsLoading(false);
      onLoadingChange(false);
    }
  }, [stockCode, dateRange, onStockDataUpdate, onLoadingChange, onError]);

  // 初始加载数据
  useEffect(() => {
    fetchStockData();
  }, [fetchStockData]);

  /**
   * 处理股票代码变更
   * 支持自动识别代码类型并切换标签页
   */
  const handleStockCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newCode = e.target.value.toUpperCase().trim();
    setStockCode(newCode);
    
    // 自动识别代码类型并切换标签页
    const symbolType = identifySymbolType(newCode);
    if (symbolType === 'stock') {
      setActiveTab('stock');
    } else if (symbolType === 'index') {
      setActiveTab('index');
    }
  };

  /**
   * 处理快速选择按钮点击
   * 支持股票和指数的快速选择
   */
  const handleQuickSelect = (code: string, type: 'stock' | 'index') => {
    setStockCode(code);
    setActiveTab(type);
  };

  /**
   * 处理日期范围变更
   * 股票和指数共用日期组件
   */
  const handleDateRangeChange = (field: 'startDate' | 'endDate') => (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    setDateRange(prev => ({
      ...prev,
      [field]: e.target.value
    }));
  };

  /**
   * 处理预设日期范围选择
   */
  const handlePresetDateRange = (days: number) => {
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000);
    
    setDateRange({
      startDate: formatDate(startDate),
      endDate: formatDate(endDate)
    });
  };

  /**
   * 准备图表数据 - 增强版
   * 支持股票和指数的差异化展示
   */
  const chartData = useMemo(() => {
    if (!stockData?.data || stockData.data.length === 0) {
      return {
        labels: [],
        datasets: []
      };
    }

    const symbolType = identifySymbolType(stockData.code);
    const colorTheme = getColorTheme(symbolType, stockData.code);

    return {
      labels: stockData.data.map((item: any) => item.date),
      datasets: [
        {
          label: `${symbolType === 'index' ? '指数点位' : '收盘价'}`,
          data: stockData.data.map((item: any) => ({
            x: item.date,
            y: item.close
          })),
          borderColor: colorTheme.line,
          backgroundColor: colorTheme.background,
          borderWidth: 2,
          fill: true,
          tension: 0.1,
          pointRadius: 0,
          pointHoverRadius: 4,
          pointHoverBackgroundColor: colorTheme.line,
          pointHoverBorderColor: '#ffffff',
          pointHoverBorderWidth: 2,
        }
      ]
    };
  }, [stockData]);

  /**
   * 图表配置选项 - 增强版
   * 优化了显示效果和交互体验
   */
  const chartOptions = useMemo(() => {
    const symbolType = stockData ? identifySymbolType(stockData.code) : 'stock';
    const isIndex = symbolType === 'index';
    
    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'top' as const,
          labels: {
            usePointStyle: true,
            padding: 20,
          }
        },
        title: {
          display: true,
          text: stockData ? 
            `${stockData.name} (${stockData.code}) - ${isIndex ? '指数走势' : '股价走势'}` : 
            '请选择股票或指数',
          font: {
            size: 16,
            weight: 'bold' as const
          },
          padding: {
            bottom: 20
          }
        },
        tooltip: {
          mode: 'index' as const,
          intersect: false,
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          titleColor: '#ffffff',
          bodyColor: '#ffffff',
          borderColor: '#e5e7eb',
          borderWidth: 1,
          cornerRadius: 8,
          displayColors: true,
          callbacks: {
            title: (context: any) => {
              const date = new Date(context[0].label);
              return `日期: ${date.toLocaleDateString('zh-CN', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                weekday: 'long'
              })}`;
            },
            label: (context: any) => {
              const value = context.parsed.y;
              const unit = isIndex ? '点' : '元';
              return `${context.dataset.label}: ${value.toFixed(2)}${unit}`;
            },
            afterLabel: (context: any) => {
              if (stockData?.data && context.dataIndex > 0) {
                const current = context.parsed.y;
                const previous = stockData.data[context.dataIndex - 1]?.close;
                if (previous) {
                  const change = current - previous;
                  const changePercent = (change / previous * 100).toFixed(2);
                  const changeText = change >= 0 ? `+${change.toFixed(2)}` : change.toFixed(2);
                  const percentText = change >= 0 ? `+${changePercent}%` : `${changePercent}%`;
                  return `日变动: ${changeText} (${percentText})`;
                }
              }
              return undefined;
            }
          }
        }
      },
      scales: {
        x: {
          type: 'time' as const,
          time: {
            unit: 'day' as const,
            displayFormats: {
              day: 'MM-dd'
            }
          },
          title: {
            display: true,
            text: '日期',
            font: {
              size: 12,
              weight: 'bold' as const
            }
          },
          grid: {
            color: '#f3f4f6',
            lineWidth: 1
          }
        },
        y: {
          title: {
            display: true,
            text: isIndex ? '指数点位' : '价格 (元)',
            font: {
              size: 12,
              weight: 'bold' as const
            }
          },
          grid: {
            color: '#f3f4f6',
            lineWidth: 1
          },
          ticks: {
            callback: function(value: any) {
              const unit = isIndex ? '点' : '元';
              return `${Number(value).toFixed(2)}${unit}`;
            }
          }
        }
      },
      interaction: {
        mode: 'nearest' as const,
        axis: 'x' as const,
        intersect: false
      },
      animation: {
        duration: 1000,
        easing: 'easeOutQuart' as const
      }
    };
  }, [stockData]);

  return (
    <div className="card h-full flex flex-col">
      {/* 头部控制面板 */}
      <div className="mb-6">
        {/* 标签页切换 */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setActiveTab('stock')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'stock'
                  ? 'bg-white text-primary-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <span className="flex items-center">
                <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
                </svg>
                股票查询
              </span>
            </button>
            <button
              onClick={() => setActiveTab('index')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'index'
                  ? 'bg-white text-primary-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <span className="flex items-center">
                <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M3 3a1 1 0 000 2v8a2 2 0 002 2h2.586l-1.293 1.293a1 1 0 101.414 1.414L10 15.414l2.293 2.293a1 1 0 001.414-1.414L12.414 15H15a2 2 0 002-2V5a1 1 0 100-2H3zm11.707 4.707a1 1 0 00-1.414-1.414L10 9.586 8.707 8.293a1 1 0 00-1.414 0l-2 2a1 1 0 101.414 1.414L8 10.414l1.293 1.293a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                指数查询
              </span>
            </button>
          </div>
          
          {/* 当前查询类型显示 */}
          {stockData && (
            <div className="flex items-center text-sm text-gray-600">
              <span className="mr-2">当前类型：</span>
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                stockData.type === 'index' 
                  ? 'bg-red-100 text-red-800' 
                  : 'bg-blue-100 text-blue-800'
              }`}>
                {stockData.type === 'index' ? '指数' : '股票'}
              </span>
            </div>
          )}
        </div>

        {/* 代码输入和搜索 */}
        <div className="flex flex-col sm:flex-row gap-4 mb-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {activeTab === 'stock' ? '股票代码' : '指数代码'}
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={stockCode}
                onChange={handleStockCodeChange}
                className="input flex-1"
                placeholder={activeTab === 'stock' ? '请输入股票代码，如：000001' : '请输入指数代码，如：000001.SH'}
                maxLength={10}
              />
              <button
                onClick={fetchStockData}
                disabled={isLoading}
                className="btn btn-primary whitespace-nowrap"
              >
                {isLoading ? '查询中...' : '查询'}
              </button>
            </div>
          </div>
        </div>

        {/* 快速选择按钮 */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {activeTab === 'stock' ? '常用股票' : '主要指数'}
          </label>
          <div className="flex flex-wrap gap-2">
            {(activeTab === 'stock' ? POPULAR_STOCKS : POPULAR_INDICES).map((item) => (
              <button
                key={item.code}
                onClick={() => handleQuickSelect(item.code, activeTab)}
                className={`px-3 py-1 text-xs rounded-full transition-colors ${
                  stockCode === item.code
                    ? activeTab === 'stock'
                      ? 'bg-blue-100 text-blue-800 border border-blue-200'
                      : 'bg-red-100 text-red-800 border border-red-200'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <span className="font-medium">{item.code}</span>
                <span className="ml-1">{item.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* 日期范围选择 */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex items-center gap-2">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                开始日期
              </label>
              <input
                type="date"
                value={dateRange.startDate}
                onChange={handleDateRangeChange('startDate')}
                className="input w-36"
              />
            </div>
            <span className="text-gray-500 mt-6">至</span>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                结束日期
              </label>
              <input
                type="date"
                value={dateRange.endDate}
                onChange={handleDateRangeChange('endDate')}
                className="input w-36"
              />
            </div>
          </div>
          
          {/* 快速日期选择 */}
          <div className="flex items-end gap-2">
            {[7, 30, 90, 180].map((days) => (
              <button
                key={days}
                onClick={() => handlePresetDateRange(days)}
                className="btn btn-secondary text-xs px-3 py-1 h-fit"
              >
                近{days}天
              </button>
            ))}
          </div>
        </div>

        {/* 搜索历史 */}
        {searchHistory.length > 0 && (
          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              最近查询
            </label>
            <div className="flex flex-wrap gap-2">
              {searchHistory.map((code, index) => (
                <button
                  key={index}
                  onClick={() => {
                    setStockCode(code);
                    const symbolType = identifySymbolType(code);
                    if (symbolType !== 'unknown') {
                      setActiveTab(symbolType);
                    }
                  }}
                  className="px-2 py-1 text-xs bg-gray-50 text-gray-600 rounded border hover:bg-gray-100 transition-colors"
                >
                  {code}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 股票/指数信息摘要 - 增强版 */}
      {stockData && stockData.success && (
        <div className="bg-gradient-to-r from-gray-50 to-blue-50 rounded-lg p-4 mb-6 border border-gray-200">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
            <div className="mb-4 lg:mb-0">
              <div className="flex items-center mb-2">
                <h3 className="text-lg font-semibold text-gray-900 mr-3">
                  {stockData.name} ({stockData.code})
                </h3>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                  stockData.type === 'index' 
                    ? 'bg-red-100 text-red-800' 
                    : 'bg-blue-100 text-blue-800'
                }`}>
                  {stockData.type === 'index' ? '指数' : '股票'}
                </span>
              </div>
              <div className="flex items-center text-sm text-gray-600">
                <span className="mr-4">
                  数据周期: {stockData.requestInfo?.period?.start} 至 {stockData.requestInfo?.period?.end}
                </span>
                <span>数据点数: {stockData.dataCount}个交易日</span>
              </div>
            </div>
            
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
              <div className="text-center">
                <div className="text-gray-600">最新{stockData.type === 'index' ? '点位' : '价格'}</div>
                <div className="text-lg font-bold text-gray-900">
                  {stockData.currentPrice?.toFixed(2)}{stockData.type === 'index' ? '点' : '元'}
                </div>
              </div>
              <div className="text-center">
                <div className="text-gray-600">期间涨跌幅</div>
                <div className={`text-lg font-bold ${
                  stockData.summary.changePercent > 0 ? 'price-up' : 
                  stockData.summary.changePercent < 0 ? 'price-down' : 'price-neutral'
                }`}>
                  {stockData.summary.changePercent > 0 ? '+' : ''}{stockData.summary.changePercent}%
                </div>
              </div>
              <div className="text-center">
                <div className="text-gray-600">最高点</div>
                <div className="text-lg font-bold text-success-600">
                  {stockData.summary.maxPrice?.toFixed(2)}
                </div>
              </div>
              <div className="text-center">
                <div className="text-gray-600">最低点</div>
                <div className="text-lg font-bold text-danger-600">
                  {stockData.summary.minPrice?.toFixed(2)}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 图表区域 - 增强版 */}
      <div className="flex-1 relative">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <LoadingSpinner size="large" />
              <p className="mt-4 text-gray-600">正在获取{activeTab === 'index' ? '指数' : '股票'}数据...</p>
            </div>
          </div>
        ) : stockData && stockData.success && stockData.data.length > 0 ? (
          <div className="chart-container relative">
            <Line data={chartData} options={chartOptions} />
            
            {/* 数据更新时间 */}
            <div className="absolute top-2 right-2 text-xs text-gray-500 bg-white px-2 py-1 rounded shadow-sm">
              数据更新: {stockData.lastUpdate ? new Date(stockData.lastUpdate).toLocaleString('zh-CN') : ''}
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-gray-500">
            <div className="text-center">
              <svg className="mx-auto h-16 w-16 text-gray-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <h3 className="text-lg font-medium text-gray-900 mb-2">暂无数据</h3>
              <p className="text-gray-500 mb-4">
                {stockData && !stockData.success 
                  ? stockData.error || '获取数据失败'
                  : `请输入有效的${activeTab === 'index' ? '指数代码' : '股票代码'}并选择日期范围`
                }
              </p>
              
              {/* 格式提示 */}
              <div className="text-sm text-gray-400">
                <p className="mb-1">
                  {activeTab === 'stock' ? '股票代码格式：6位数字（如：000001）' : '指数代码格式：以.SH或.SZ结尾（如：000001.SH）'}
                </p>
                <p>或点击上方快速选择按钮</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default StockChart;