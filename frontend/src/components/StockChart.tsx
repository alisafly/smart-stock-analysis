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

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import ReactEChartsCore from 'echarts-for-react/lib/core';
import * as echarts from 'echarts/core';
import {
  CandlestickChart,
  BarChart,
  LineChart
} from 'echarts/charts';
import {
  GridComponent,
  TooltipComponent,
  LegendComponent,
  DataZoomComponent,
  TitleComponent
} from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import { stockAPI } from '../utils/api';
import { getDefaultDateRange, formatDate } from '../utils/dateUtils';
import LoadingSpinner from './LoadingSpinner';

// 注册ECharts组件
echarts.use([
  CandlestickChart,
  BarChart,
  LineChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  DataZoomComponent,
  TitleComponent,
  CanvasRenderer
]);

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

/**
 * 计算移动平均线
 */
const calculateMA = (data: any[], period: number): number[] => {
  const result: number[] = [];
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      result.push(null as any);
    } else {
      const sum = data.slice(i - period + 1, i + 1).reduce((acc, item) => acc + item.close, 0);
      result.push(sum / period);
    }
  }
  return result;
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
  const [realtimeData, setRealtimeData] = useState<any>(null); // 实时数据
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'stock' | 'index'>('stock'); // 当前活跃的标签页
  const [searchHistory, setSearchHistory] = useState<string[]>([]); // 搜索历史
  const [autoRefresh, setAutoRefresh] = useState(false); // 是否自动刷新
  const [lastUpdate, setLastUpdate] = useState<string>(''); // 最后更新时间
  const [containerHeight, setContainerHeight] = useState(600); // 容器高度
  
  // 引用
  const containerRef = useRef<HTMLDivElement>(null);
  const chartContainerRef = useRef<HTMLDivElement>(null);
  
  // MA显示控制
  const [showMA, setShowMA] = useState({
    MA5: true,
    MA10: true,
    MA20: true
  });

  /**
   * 获取实时数据
   * 支持股票和指数的实时数据获取
   */
  const fetchRealtimeData = useCallback(async () => {
    if (!stockCode) return;
    
    const symbolType = identifySymbolType(stockCode);
    if (symbolType === 'unknown') return; // 只支持有效的股票和指数代码
    
    try {
      const data = await stockAPI.getRealtimeData(stockCode);
      if (data.success) {
        setRealtimeData(data);
        setLastUpdate(new Date().toLocaleTimeString('zh-CN'));
      }
    } catch (error) {
      // 实时数据获取失败不显示错误，不影响主要功能
      console.warn('获取实时数据失败:', error);
    }
  }, [stockCode]);

  // 自动刷新实时数据
  useEffect(() => {
    if (!autoRefresh) return;
    
    const symbolType = identifySymbolType(stockCode);
    if (symbolType === 'unknown') return; // 只支持有效的股票和指数代码
    
    // 立即获取一次实时数据
    fetchRealtimeData();
    
    // 设置定时器，每30秒更新一次
    const interval = setInterval(fetchRealtimeData, 30000);
    
    return () => clearInterval(interval);
  }, [autoRefresh, stockCode, fetchRealtimeData]);

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
   * 准备ECharts K线图配置
   */
  const chartOption = useMemo(() => {
    if (!stockData?.data || stockData.data.length === 0) {
      return {};
    }

    const data = stockData.data;
    const dates = data.map((item: any) => item.date);
    const ohlcData = data.map((item: any) => [
      item.open,
      item.close,
      item.low,
      item.high
    ]);
    const volumes = data.map((item: any) => item.volume);

    // 计算移动平均线
    const ma5 = calculateMA(data, 5);
    const ma10 = calculateMA(data, 10);
    const ma20 = calculateMA(data, 20);

    const symbolType = identifySymbolType(stockData.code);
    const isIndex = symbolType === 'index';

    return {
      title: {
        text: `${stockData.name} (${stockData.code}) - ${isIndex ? '指数走势' : 'K线图'}`,
        left: 'center',
        textStyle: {
          color: '#333',
          fontSize: 16,
          fontWeight: 'bold'
        }
      },
      tooltip: {
        trigger: 'axis',
        axisPointer: {
          type: 'cross',
          lineStyle: {
            color: '#cccccc'
          }
        },
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        borderColor: '#333',
        borderWidth: 1,
        textStyle: {
          color: '#fff'
        },
        formatter: function (params: any) {
          const dataIndex = params[0].dataIndex;
          const item = data[dataIndex];
          const date = item.date;
          
          let tooltip = `<div style="margin: 0px; padding: 0px;">`;
          tooltip += `<div style="margin: 0px; padding: 4px 0; font-weight: bold; color: #fff;">${date}</div>`;
          tooltip += `<div style="margin: 0px; padding: 2px 0;">开盘: <span style="color: #ffa500;">${item.open.toFixed(2)}</span></div>`;
          tooltip += `<div style="margin: 0px; padding: 2px 0;">收盘: <span style="color: ${item.close >= item.open ? '#ff4757' : '#2ed573'}">${item.close.toFixed(2)}</span></div>`;
          tooltip += `<div style="margin: 0px; padding: 2px 0;">最高: <span style="color: #ff4757;">${item.high.toFixed(2)}</span></div>`;
          tooltip += `<div style="margin: 0px; padding: 2px 0;">最低: <span style="color: #2ed573;">${item.low.toFixed(2)}</span></div>`;
          if (item.volume > 0) {
            tooltip += `<div style="margin: 0px; padding: 2px 0;">成交量: <span style="color: #70a1ff;">${(item.volume / 10000).toFixed(0)}万</span></div>`;
          }
          
          // 显示MA数据
          if (showMA.MA5 && ma5[dataIndex] !== null) {
            tooltip += `<div style="margin: 0px; padding: 2px 0;">MA5: <span style="color: #ff6b6b;">${ma5[dataIndex].toFixed(2)}</span></div>`;
          }
          if (showMA.MA10 && ma10[dataIndex] !== null) {
            tooltip += `<div style="margin: 0px; padding: 2px 0;">MA10: <span style="color: #4ecdc4;">${ma10[dataIndex].toFixed(2)}</span></div>`;
          }
          if (showMA.MA20 && ma20[dataIndex] !== null) {
            tooltip += `<div style="margin: 0px; padding: 2px 0;">MA20: <span style="color: #45b7d1;">${ma20[dataIndex].toFixed(2)}</span></div>`;
          }
          
          tooltip += `</div>`;
          return tooltip;
        }
      },
      legend: {
        data: ['K线图', 'MA5', 'MA10', 'MA20', '成交量'],
        left: 'left',
        top: 30
      },
      grid: [
        {
          left: '8%',
          right: '8%',
          top: '15%',
          height: '60%',
          containLabel: true
        },
        {
          left: '8%',
          right: '8%',
          top: '78%',
          height: '15%',
          containLabel: true
        }
      ],
      xAxis: [
        {
          type: 'category',
          data: dates,
          scale: true,
          boundaryGap: false,
          axisLine: { onZero: false },
          splitLine: { show: false },
          splitNumber: 20,
          min: 'dataMin',
          max: 'dataMax'
        },
        {
          type: 'category',
          gridIndex: 1,
          data: dates,
          scale: true,
          boundaryGap: false,
          axisLine: { onZero: false },
          axisTick: { show: false },
          splitLine: { show: false },
          axisLabel: { show: false },
          splitNumber: 20,
          min: 'dataMin',
          max: 'dataMax'
        }
      ],
      yAxis: [
        {
          scale: true,
          splitArea: {
            show: true
          }
        },
        {
          scale: true,
          gridIndex: 1,
          splitNumber: 2,
          axisLabel: { show: false },
          axisLine: { show: false },
          axisTick: { show: false },
          splitLine: { show: false }
        }
      ],
      dataZoom: [
        {
          type: 'inside',
          xAxisIndex: [0, 1],
          start: 0,
          end: 100,
          minSpan: 10
        },
        {
          show: true,
          xAxisIndex: [0, 1],
          type: 'slider',
          top: '95%',
          start: 0,
          end: 100,
          minSpan: 10
        }
      ],
      series: [
        // K线图
        {
          name: 'K线图',
          type: 'candlestick',
          data: ohlcData,
          itemStyle: {
            color: '#ff4757', // 阳线颜色（红色）
            color0: '#2ed573', // 阴线颜色（绿色）
            borderColor: '#ff4757', // 阳线边框
            borderColor0: '#2ed573' // 阴线边框
          },
          emphasis: {
            itemStyle: {
              color: '#ff6b6b',
              color0: '#26de81',
              borderColor: '#ff6b6b',
              borderColor0: '#26de81'
            }
          }
        },
        // MA5
        ...(showMA.MA5 ? [{
          name: 'MA5',
          type: 'line',
          data: ma5,
          smooth: true,
          symbol: 'none',
          lineStyle: {
            color: '#ff6b6b',
            width: 1
          }
        }] : []),
        // MA10
        ...(showMA.MA10 ? [{
          name: 'MA10',
          type: 'line',
          data: ma10,
          smooth: true,
          symbol: 'none',
          lineStyle: {
            color: '#4ecdc4',
            width: 1
          }
        }] : []),
        // MA20
        ...(showMA.MA20 ? [{
          name: 'MA20',
          type: 'line',
          data: ma20,
          smooth: true,
          symbol: 'none',
          lineStyle: {
            color: '#45b7d1',
            width: 1
          }
        }] : []),
        // 成交量
        {
          name: '成交量',
          type: 'bar',
          xAxisIndex: 1,
          yAxisIndex: 1,
          data: volumes.map((vol: number, index: number) => ({
            value: vol,
            itemStyle: {
              color: data[index].close >= data[index].open ? '#ff4757' : '#2ed573'
            }
          }))
        }
      ]
    };
  }, [stockData, showMA]);

  // 监听容器大小变化，动态调整图表高度
  useEffect(() => {
    const updateContainerHeight = () => {
      if (containerRef.current && chartContainerRef.current) {
        const containerRect = containerRef.current.getBoundingClientRect();
        const chartContainerRect = chartContainerRef.current.getBoundingClientRect();
        
        // 计算可用高度：窗口高度 - 容器顶部位置 - 底部边距
        const availableHeight = window.innerHeight - chartContainerRect.top - 60;
        const minHeight = 400; // 最小高度
        const maxHeight = Math.max(600, availableHeight * 0.8); // 最大高度，至少600px
        
        const newHeight = Math.max(minHeight, Math.min(maxHeight, availableHeight));
        setContainerHeight(newHeight);
        
        console.log('图表高度计算:', {
          windowHeight: window.innerHeight,
          chartTop: chartContainerRect.top,
          availableHeight,
          newHeight
        });
      }
    };

    // 初始化时延迟计算高度，确保DOM已渲染
    const initHeight = () => {
      setTimeout(updateContainerHeight, 100);
    };

    // 监听窗口大小变化
    const handleResize = () => {
      // 防抖处理
      setTimeout(updateContainerHeight, 150);
    };

    // 初始化
    initHeight();
    window.addEventListener('resize', handleResize);
    
    // 使用 ResizeObserver 监听容器大小变化（如左侧面板宽度改变）
    let resizeObserver: ResizeObserver | null = null;
    if (window.ResizeObserver) {
      const observeResize = () => {
        if (containerRef.current) {
          resizeObserver = new ResizeObserver(() => {
            setTimeout(updateContainerHeight, 100);
          });
          resizeObserver.observe(containerRef.current);
        }
      };
      
      setTimeout(observeResize, 200); // 延迟观察，确保DOM稳定
    }

    return () => {
      window.removeEventListener('resize', handleResize);
      if (resizeObserver && containerRef.current) {
        resizeObserver.unobserve(containerRef.current);
      }
    };
  }, [stockData]); // 当stockData变化时也重新计算

  return (
    <div ref={containerRef} className="card h-full flex flex-col overflow-hidden">
      {/* 头部控制面板 - 优化布局，减少垂直空间占用 */}
      <div className="flex-shrink-0 mb-4">
        {/* 标签页切换 - 简化布局 */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setActiveTab('stock')}
              className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'stock'
                  ? 'bg-white text-primary-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              股票查询
            </button>
            <button
              onClick={() => setActiveTab('index')}
              className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'index'
                  ? 'bg-white text-primary-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              指数查询
            </button>
          </div>
          
          {/* 当前查询类型显示 */}
          {stockData && (
            <div className="flex items-center text-sm text-gray-600">
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

        {/* 代码输入和控制 - 紧凑布局 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-3">
          {/* 左列：代码输入和快速选择 */}
          <div>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={stockCode}
                onChange={handleStockCodeChange}
                className="input flex-1 text-sm"
                placeholder={activeTab === 'stock' ? '股票代码，如：000001' : '指数代码，如：000001.SH'}
                maxLength={10}
              />
              <button
                onClick={fetchStockData}
                disabled={isLoading}
                className="btn btn-primary text-sm px-3 py-1 whitespace-nowrap"
              >
                {isLoading ? '查询中' : '查询'}
              </button>
            </div>
            {/* 快速选择按钮 - 紧凑显示 */}
            <div className="flex flex-wrap gap-1">
              {(activeTab === 'stock' ? POPULAR_STOCKS : POPULAR_INDICES).slice(0, 3).map((item) => (
                <button
                  key={item.code}
                  onClick={() => handleQuickSelect(item.code, activeTab)}
                  className={`px-2 py-1 text-xs rounded transition-colors ${
                    stockCode === item.code
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {item.name}
                </button>
              ))}
            </div>
          </div>

          {/* 右列：日期选择和MA控制 */}
          <div>
            <div className="flex gap-2 mb-2">
              <input
                type="date"
                value={dateRange.startDate}
                onChange={handleDateRangeChange('startDate')}
                className="input text-sm flex-1"
              />
              <span className="text-gray-500 text-sm self-center">至</span>
              <input
                type="date"
                value={dateRange.endDate}
                onChange={handleDateRangeChange('endDate')}
                className="input text-sm flex-1"
              />
            </div>
            {/* MA控制和快速日期 */}
            <div className="flex items-center justify-between">
              <div className="flex gap-2 text-xs">
                {Object.entries(showMA).map(([key, value]) => (
                  <label key={key} className="flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={value}
                      onChange={(e) => setShowMA(prev => ({ ...prev, [key]: e.target.checked }))}
                      className="mr-1 text-xs"
                    />
                    <span>{key}</span>
                  </label>
                ))}
              </div>
              <div className="flex gap-1">
                {[30, 90].map((days) => (
                  <button
                    key={days}
                    onClick={() => handlePresetDateRange(days)}
                    className="btn btn-secondary text-xs px-2 py-1"
                  >
                    {days}天
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 股票信息摘要 - 简化显示 */}
      {stockData && stockData.success && (
        <div className="flex-shrink-0 bg-gradient-to-r from-gray-50 to-blue-50 rounded-lg p-3 mb-3 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold text-gray-900">
                {stockData.name} ({stockData.code})
              </h3>
              <div className="text-xs text-gray-600">
                {stockData.dataCount}个交易日 | {stockData.requestInfo?.period?.start} ~ {stockData.requestInfo?.period?.end}
              </div>
            </div>
            <div className="grid grid-cols-4 gap-3 text-xs text-center">
              <div>
                <div className="text-gray-600">最新价</div>
                <div className="font-bold text-gray-900">
                  {realtimeData?.success && stockData.type === 'stock' ? 
                    realtimeData.current_price?.toFixed(2) : 
                    stockData.currentPrice?.toFixed(2)
                  }
                </div>
              </div>
              <div>
                <div className="text-gray-600">涨跌幅</div>
                <div className={`font-bold ${
                  stockData.summary.changePercent > 0 ? 'text-red-600' : 
                  stockData.summary.changePercent < 0 ? 'text-green-600' : 'text-gray-600'
                }`}>
                  {stockData.summary.changePercent > 0 ? '+' : ''}{stockData.summary.changePercent}%
                </div>
              </div>
              <div>
                <div className="text-gray-600">最高</div>
                <div className="font-bold text-red-600">
                  {realtimeData?.success && stockData.type === 'stock' ? 
                    realtimeData.high?.toFixed(2) : 
                    stockData.summary.maxPrice?.toFixed(2)
                  }
                </div>
              </div>
              <div>
                <div className="text-gray-600">最低</div>
                <div className="font-bold text-green-600">
                  {realtimeData?.success && stockData.type === 'stock' ? 
                    realtimeData.low?.toFixed(2) : 
                    stockData.summary.minPrice?.toFixed(2)
                  }
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 图表区域 - 自适应高度 */}
      <div ref={chartContainerRef} className="flex-1 relative min-h-0">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <LoadingSpinner size="large" />
              <p className="mt-4 text-gray-600">正在获取{activeTab === 'index' ? '指数' : '股票'}数据...</p>
            </div>
          </div>
        ) : stockData && stockData.success && stockData.data.length > 0 ? (
          <div className="chart-container w-full h-full" style={{ height: `${containerHeight}px`, minHeight: '400px' }}>
            <ReactEChartsCore
              echarts={echarts}
              option={chartOption}
              style={{ height: '100%', width: '100%' }}
              opts={{ renderer: 'canvas' }}
            />
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
              <div className="text-sm text-gray-400">
                <p className="mb-1">
                  {activeTab === 'stock' ? '股票代码：6位数字（如：000001）' : '指数代码：以.SH或.SZ结尾（如：000001.SH）'}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default StockChart;