#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
智能金融分析平台 - 数据获取服务模块

主要功能：
1. 使用akshare库获取A股股票历史数据
2. 获取主要指数数据（上证指数、深证成指、创业板指等）
3. 统一数据格式输出，确保前端能正确解析
4. 实现数据缓存机制，提高性能
5. 完善的错误处理和数据验证

作者：智能金融分析平台团队
日期：2025-08-26
"""

import sys
import json
import argparse
import akshare as ak
import pandas as pd
from datetime import datetime, timedelta
import os
import hashlib
import time
from typing import Dict, List, Optional, Union

# 数据缓存配置
CACHE_DIR = os.path.join(os.path.dirname(__file__), '.cache')
CACHE_EXPIRE_HOURS = 1  # 缓存过期时间（小时）

# 支持的指数代码映射
INDEX_CODE_MAPPING = {
    '000001.SH': {'name': '上证指数', 'ak_symbol': '000001'},
    '399001.SZ': {'name': '深证成指', 'ak_symbol': '399001'},
    '399006.SZ': {'name': '创业板指', 'ak_symbol': '399006'},
    '399005.SZ': {'name': '中小板指', 'ak_symbol': '399005'},
    '000300.SH': {'name': '沪深300', 'ak_symbol': '000300'},
    '000905.SH': {'name': '中证500', 'ak_symbol': '000905'},
    '000852.SH': {'name': '中证1000', 'ak_symbol': '000852'},
}

# 常用股票代码验证模式
STOCK_CODE_PATTERNS = {
    'A股': r'^(00[0-9]{4}|30[0-9]{4}|60[0-9]{4})$',
    '指数_上海': r'^000[0-9]{3}\.SH$',
    '指数_深圳': r'^399[0-9]{3}\.SZ$',
}

class DataCache:
    """数据缓存管理类"""
    
    def __init__(self):
        """初始化缓存目录"""
        if not os.path.exists(CACHE_DIR):
            os.makedirs(CACHE_DIR)
    
    def _get_cache_key(self, symbol: str, start_date: str, end_date: str, data_type: str) -> str:
        """生成缓存键"""
        cache_string = f"{symbol}_{start_date}_{end_date}_{data_type}"
        return hashlib.md5(cache_string.encode()).hexdigest()
    
    def _get_cache_file(self, cache_key: str) -> str:
        """获取缓存文件路径"""
        return os.path.join(CACHE_DIR, f"{cache_key}.json")
    
    def get(self, symbol: str, start_date: str, end_date: str, data_type: str) -> Optional[Dict]:
        """从缓存获取数据"""
        try:
            cache_key = self._get_cache_key(symbol, start_date, end_date, data_type)
            cache_file = self._get_cache_file(cache_key)
            
            if not os.path.exists(cache_file):
                return None
            
            # 检查缓存是否过期
            file_time = os.path.getmtime(cache_file)
            current_time = time.time()
            if (current_time - file_time) > (CACHE_EXPIRE_HOURS * 3600):
                os.remove(cache_file)
                return None
            
            with open(cache_file, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception:
            return None
    
    def set(self, symbol: str, start_date: str, end_date: str, data_type: str, data: Dict):
        """设置缓存数据"""
        try:
            cache_key = self._get_cache_key(symbol, start_date, end_date, data_type)
            cache_file = self._get_cache_file(cache_key)
            
            with open(cache_file, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
        except Exception:
            pass  # 缓存失败不影响主要功能


class FinancialDataService:
    """金融数据获取服务类"""
    
    def __init__(self):
        """初始化数据服务"""
        self.cache = DataCache()
        self.realtime_cache = {}  # 实时数据缓存
        self.cache_duration = 60  # 实时数据缓存1分钟
        self.last_realtime_update = {}
    
    def get_kline_data(self, symbol: str, period: str = "daily", start_date: str = None, end_date: str = None) -> Dict:
        """
        获取K线数据（支持不同周期）
        
        Args:
            symbol: 股票/指数代码
            period: 周期类型 ('1min', '5min', '15min', '30min', '60min', 'daily', 'weekly', 'monthly')
            start_date: 开始日期
            end_date: 结束日期
            
        Returns:
            K线数据字典
        """
        try:
            # 识别代码类型
            symbol_type = self._identify_symbol_type(symbol)
            
            # 处理空字符串参数，将其转换为None
            if start_date == "":
                start_date = None
            if end_date == "":
                end_date = None
                
            # 设置默认日期范围
            if not start_date:
                if period in ['1min', '5min', '15min', '30min', '60min']:
                    # 分时数据默认获取最近1天
                    end_date = datetime.now().strftime('%Y-%m-%d')
                    start_date = (datetime.now() - timedelta(days=1)).strftime('%Y-%m-%d')
                else:
                    # 日K及以上周期默认获取最近1年
                    end_date = datetime.now().strftime('%Y-%m-%d')
                    start_date = (datetime.now() - timedelta(days=365)).strftime('%Y-%m-%d')
            
            if not end_date:
                end_date = datetime.now().strftime('%Y-%m-%d')
            
            print(f"正在获取{period}周期K线数据: {symbol}, 日期范围: {start_date} 到 {end_date}", file=sys.stderr)
            
            # 根据周期类型获取数据
            if period in ['1min', '5min', '15min', '30min', '60min']:
                # 分时数据
                return self._get_minute_data(symbol, period, start_date, end_date)
            elif period == 'daily':
                # 日K数据
                if symbol_type == 'stock':
                    return self.get_stock_data(symbol, start_date, end_date)
                elif symbol_type == 'index':
                    return self.get_index_data(symbol, start_date, end_date)
            elif period == 'weekly':
                # 周K数据
                return self._get_weekly_data(symbol, start_date, end_date)
            elif period == 'monthly':
                # 月K数据
                return self._get_monthly_data(symbol, start_date, end_date)
            else:
                # 默认返回日K数据
                if symbol_type == 'stock':
                    return self.get_stock_data(symbol, start_date, end_date)
                elif symbol_type == 'index':
                    return self.get_index_data(symbol, start_date, end_date)
                
        except Exception as e:
            error_msg = f"获取{period}周期K线数据失败：{str(e)}"
            print(error_msg, file=sys.stderr)
            return self._create_empty_response(symbol, 'unknown', error_msg)
    
    def _get_minute_data(self, symbol: str, period: str, start_date: str, end_date: str) -> Dict:
        """
        获取分时数据
        
        Args:
            symbol: 股票代码
            period: 分时周期 ('1min', '5min', '15min', '30min', '60min')
            start_date: 开始日期
            end_date: 结束日期
            
        Returns:
            分时数据字典
        """
        try:
            # 检查缓存
            cached_data = self.cache.get(symbol, start_date, end_date, f'minute_{period}')
            if cached_data:
                return cached_data
            
            # 映射周期到akshare参数
            period_mapping = {
                '1min': '1',
                '5min': '5',
                '15min': '15',
                '30min': '30',
                '60min': '60'
            }
            
            ak_period = period_mapping.get(period, '1')
            
            print(f"正在获取分时数据: {symbol}, 周期: {period} ({ak_period}分钟)", file=sys.stderr)
            
            # 使用akshare获取分时数据
            df = ak.stock_zh_a_hist_min_em(
                symbol=symbol,
                period=ak_period,
                start_date=f"{start_date} 09:30:00",
                end_date=f"{end_date} 15:00:00",
                adjust=""
            )
            
            if df.empty:
                return self._create_empty_response(symbol, 'stock', "暂无分时数据")
            
            # 处理数据格式
            df = df.rename(columns={
                '时间': 'date',
                '开盘': 'open',
                '收盘': 'close',
                '最高': 'high',
                '最低': 'low',
                '成交量': 'volume',
                '成交额': 'amount'
            })
            
            # 确保必要的列存在
            required_columns = ['date', 'open', 'close', 'high', 'low', 'volume']
            for col in required_columns:
                if col not in df.columns:
                    df[col] = 0
            
            # 处理数据类型
            for col in ['open', 'close', 'high', 'low']:
                df[col] = pd.to_numeric(df[col], errors='coerce')
            
            df['volume'] = pd.to_numeric(df['volume'], errors='coerce').fillna(0)
            
            # 按时间排序
            df['date'] = pd.to_datetime(df['date'])
            df = df.sort_values('date')
            
            # 转换为前端需要的格式
            data_list = []
            for _, row in df.iterrows():
                data_list.append({
                    'date': row['date'].strftime('%Y-%m-%d %H:%M'),
                    'open': float(row['open']) if pd.notna(row['open']) else 0,
                    'close': float(row['close']) if pd.notna(row['close']) else 0,
                    'high': float(row['high']) if pd.notna(row['high']) else 0,
                    'low': float(row['low']) if pd.notna(row['low']) else 0,
                    'volume': int(row['volume']) if pd.notna(row['volume']) else 0
                })
            
            # 计算统计信息
            if data_list:
                first_price = data_list[0]['close']
                last_price = data_list[-1]['close']
                change_percent = ((last_price - first_price) / first_price * 100) if first_price != 0 else 0
                max_price = max([d['high'] for d in data_list])
                min_price = min([d['low'] for d in data_list if d['low'] > 0])
                avg_volume = sum([d['volume'] for d in data_list]) / len(data_list)
                
                summary = {
                    'changePercent': round(change_percent, 2),
                    'maxPrice': round(max_price, 2),
                    'minPrice': round(min_price, 2),
                    'avgVolume': int(avg_volume)
                }
            else:
                summary = {
                    'changePercent': 0,
                    'maxPrice': 0,
                    'minPrice': 0,
                    'avgVolume': 0
                }
            
            result = {
                'success': True,
                'code': symbol,
                'name': f"股票_{symbol}",
                'type': 'stock',
                'currentPrice': data_list[-1]['close'] if data_list else 0,
                'data': data_list,
                'summary': summary,
                'dataCount': len(data_list),
                'lastUpdate': datetime.now().isoformat(),
                'period': period
            }
            
            # 缓存数据
            if result['success']:
                self.cache.set(symbol, start_date, end_date, f'minute_{period}', result)
            
            return result
            
        except Exception as e:
            error_msg = f"获取分时数据失败：{str(e)}"
            print(error_msg, file=sys.stderr)
            return self._create_empty_response(symbol, 'stock', error_msg)
    
    def _get_weekly_data(self, symbol: str, start_date: str, end_date: str) -> Dict:
        """
        获取周K数据
        
        Args:
            symbol: 股票/指数代码
            start_date: 开始日期
            end_date: 结束日期
            
        Returns:
            周K数据字典
        """
        try:
            # 先获取日K数据
            daily_data = self.get_financial_data(symbol, start_date, end_date)
            
            if not daily_data.get('success', False):
                return daily_data
            
            # 将日K数据转换为周K数据
            daily_df = pd.DataFrame(daily_data['data'])
            daily_df['date'] = pd.to_datetime(daily_df['date'])
            daily_df = daily_df.sort_values('date')
            
            # 按周分组
            weekly_df = daily_df.resample('W', on='date').agg({
                'open': 'first',
                'close': 'last',
                'high': 'max',
                'low': 'min',
                'volume': 'sum'
            }).reset_index()
            
            # 转换为列表格式
            data_list = []
            for _, row in weekly_df.iterrows():
                data_list.append({
                    'date': row['date'].strftime('%Y-%m-%d'),
                    'open': float(row['open']),
                    'close': float(row['close']),
                    'high': float(row['high']),
                    'low': float(row['low']),
                    'volume': int(row['volume'])
                })
            
            # 更新统计信息
            if data_list:
                first_price = data_list[0]['close']
                last_price = data_list[-1]['close']
                change_percent = ((last_price - first_price) / first_price * 100) if first_price != 0 else 0
                max_price = max([d['high'] for d in data_list])
                min_price = min([d['low'] for d in data_list if d['low'] > 0])
                avg_volume = sum([d['volume'] for d in data_list]) / len(data_list)
                
                summary = {
                    'changePercent': round(change_percent, 2),
                    'maxPrice': round(max_price, 2),
                    'minPrice': round(min_price, 2),
                    'avgVolume': int(avg_volume)
                }
            else:
                summary = {
                    'changePercent': 0,
                    'maxPrice': 0,
                    'minPrice': 0,
                    'avgVolume': 0
                }
            
            result = {
                'success': True,
                'code': symbol,
                'name': daily_data.get('name', f"股票_{symbol}"),
                'type': daily_data.get('type', 'stock'),
                'currentPrice': data_list[-1]['close'] if data_list else 0,
                'data': data_list,
                'summary': summary,
                'dataCount': len(data_list),
                'lastUpdate': datetime.now().isoformat(),
                'period': 'weekly'
            }
            
            return result
            
        except Exception as e:
            error_msg = f"获取周K数据失败：{str(e)}"
            print(error_msg, file=sys.stderr)
            return self._create_empty_response(symbol, 'unknown', error_msg)
    
    def _get_monthly_data(self, symbol: str, start_date: str, end_date: str) -> Dict:
        """
        获取月K数据
        
        Args:
            symbol: 股票/指数代码
            start_date: 开始日期
            end_date: 结束日期
            
        Returns:
            月K数据字典
        """
        try:
            # 先获取日K数据
            daily_data = self.get_financial_data(symbol, start_date, end_date)
            
            if not daily_data.get('success', False):
                return daily_data
            
            # 将日K数据转换为月K数据
            daily_df = pd.DataFrame(daily_data['data'])
            daily_df['date'] = pd.to_datetime(daily_df['date'])
            daily_df = daily_df.sort_values('date')
            
            # 按月分组
            monthly_df = daily_df.resample('M', on='date').agg({
                'open': 'first',
                'close': 'last',
                'high': 'max',
                'low': 'min',
                'volume': 'sum'
            }).reset_index()
            
            # 转换为列表格式
            data_list = []
            for _, row in monthly_df.iterrows():
                data_list.append({
                    'date': row['date'].strftime('%Y-%m-%d'),
                    'open': float(row['open']),
                    'close': float(row['close']),
                    'high': float(row['high']),
                    'low': float(row['low']),
                    'volume': int(row['volume'])
                })
            
            # 更新统计信息
            if data_list:
                first_price = data_list[0]['close']
                last_price = data_list[-1]['close']
                change_percent = ((last_price - first_price) / first_price * 100) if first_price != 0 else 0
                max_price = max([d['high'] for d in data_list])
                min_price = min([d['low'] for d in data_list if d['low'] > 0])
                avg_volume = sum([d['volume'] for d in data_list]) / len(data_list)
                
                summary = {
                    'changePercent': round(change_percent, 2),
                    'maxPrice': round(max_price, 2),
                    'minPrice': round(min_price, 2),
                    'avgVolume': int(avg_volume)
                }
            else:
                summary = {
                    'changePercent': 0,
                    'maxPrice': 0,
                    'minPrice': 0,
                    'avgVolume': 0
                }
            
            result = {
                'success': True,
                'code': symbol,
                'name': daily_data.get('name', f"股票_{symbol}"),
                'type': daily_data.get('type', 'stock'),
                'currentPrice': data_list[-1]['close'] if data_list else 0,
                'data': data_list,
                'summary': summary,
                'dataCount': len(data_list),
                'lastUpdate': datetime.now().isoformat(),
                'period': 'monthly'
            }
            
            return result
            
        except Exception as e:
            error_msg = f"获取月K数据失败：{str(e)}"
            print(error_msg, file=sys.stderr)
            return self._create_empty_response(symbol, 'unknown', error_msg)
    
    def get_index_realtime_data(self, symbol: str) -> Dict:
        """
        获取指数实时数据
        
        Args:
            symbol: 指数代码（如000001.SH）
            
        Returns:
            指数实时数据字典
        """
        try:
            # 检查缓存是否有效
            current_time = time.time()
            cache_key = f"index_realtime_{symbol}"
            
            if (cache_key in self.realtime_cache and 
                cache_key in self.last_realtime_update and
                current_time - self.last_realtime_update[cache_key] < self.cache_duration):
                return self.realtime_cache[cache_key]
            
            # 检查是否为支持的指数
            if symbol not in INDEX_CODE_MAPPING:
                return {
                    'success': False,
                    'code': symbol,
                    'error': f'不支持的指数代码: {symbol}',
                    'update_time': datetime.now().strftime('%Y-%m-%d %H:%M:%S')
                }
            
            ak_symbol = INDEX_CODE_MAPPING[symbol]['ak_symbol']
            print(f"正在获取指数实时数据: {symbol} ({ak_symbol})", file=sys.stderr)
            
            # 获取指数实时数据 - 使用正确的API
            # 尝试使用不同API获取指数实时数据
            index_data = None
            try:
                # 方法1：使用stock_zh_index_spot_em
                index_data = ak.stock_zh_index_spot_em()
                # 筛选特定指数
                index_data = index_data[index_data['代码'] == ak_symbol]
            except Exception as e1:
                print(f"方法1失败: {e1}", file=sys.stderr)
                try:
                    # 方法2：使用index_zh_a_spot_em
                    index_data = ak.index_zh_a_spot_em()
                    index_data = index_data[index_data['代码'] == ak_symbol]
                except Exception as e2:
                    print(f"方法2失败: {e2}", file=sys.stderr)
                    raise Exception(f"无法获取指数数据: {e1}")
            
            if not index_data.empty:
                row = index_data.iloc[0]
                result = {
                    'success': True,
                    'code': symbol,
                    'name': INDEX_CODE_MAPPING[symbol]['name'],
                    'current': float(row['最新价']) if '最新价' in row else 0,
                    'change_percent': float(row['涨跌幅']) if '涨跌幅' in row else 0,
                    'change_amount': float(row['涨跌额']) if '涨跌额' in row else 0,
                    'high': float(row['最高']) if '最高' in row else 0,
                    'low': float(row['最低']) if '最低' in row else 0,
                    'open': float(row['今开']) if '今开' in row else 0,
                    'yesterday_close': float(row['昨收']) if '昨收' in row else 0,
                    'volume': int(row['成交量']) if '成交量' in row and pd.notna(row['成交量']) else 0,
                    'turnover': float(row['成交额']) if '成交额' in row and pd.notna(row['成交额']) else 0,
                    'update_time': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
                    'market_status': self._get_market_status()
                }
                
                # 更新缓存
                self.realtime_cache[cache_key] = result
                self.last_realtime_update[cache_key] = current_time
                
                return result
            else:
                return {
                    'success': False,
                    'code': symbol,
                    'error': '未找到该指数的实时数据',
                    'update_time': datetime.now().strftime('%Y-%m-%d %H:%M:%S')
                }
                
        except Exception as e:
            error_msg = f"获取指数实时数据失败：{str(e)}"
            print(error_msg, file=sys.stderr)
            return {
                'success': False,
                'code': symbol,
                'error': error_msg,
                'update_time': datetime.now().strftime('%Y-%m-%d %H:%M:%S')
            }

    def get_realtime_data(self, symbol: str) -> Dict:
        """
        获取股票实时数据
        
        Args:
            symbol: 股票代码
            
        Returns:
            实时数据字典
        """
        try:
            # 检查缓存是否有效
            current_time = time.time()
            cache_key = f"realtime_{symbol}"
            
            if (cache_key in self.realtime_cache and 
                cache_key in self.last_realtime_update and
                current_time - self.last_realtime_update[cache_key] < self.cache_duration):
                return self.realtime_cache[cache_key]
            
            print(f"正在获取实时数据: {symbol}", file=sys.stderr)
            
            # 获取实时行情数据
            realtime_data = ak.stock_zh_a_spot_em()
            
            # 筛选特定股票
            stock_data = realtime_data[realtime_data['代码'] == symbol]
            
            if not stock_data.empty:
                row = stock_data.iloc[0]
                result = {
                    'success': True,
                    'code': symbol,
                    'name': row['名称'],
                    'current_price': float(row['最新价']),
                    'change_percent': float(row['涨跌幅']),
                    'change_amount': float(row['涨跌额']),
                    'volume': int(row['成交量']) if pd.notna(row['成交量']) else 0,
                    'turnover': float(row['成交额']) if pd.notna(row['成交额']) else 0,
                    'high': float(row['最高']),
                    'low': float(row['最低']),
                    'open': float(row['今开']),
                    'yesterday_close': float(row['昨收']),
                    'update_time': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
                    'market_status': self._get_market_status()
                }
                
                # 更新缓存
                self.realtime_cache[cache_key] = result
                self.last_realtime_update[cache_key] = current_time
                
                return result
            else:
                return {
                    'success': False,
                    'code': symbol,
                    'error': '未找到该股票的实时数据',
                    'update_time': datetime.now().strftime('%Y-%m-%d %H:%M:%S')
                }
                
        except Exception as e:
            error_msg = f"获取实时数据失败：{str(e)}"
            print(error_msg, file=sys.stderr)
            return {
                'success': False,
                'code': symbol,
                'error': error_msg,
                'update_time': datetime.now().strftime('%Y-%m-%d %H:%M:%S')
            }
    
    def get_realtime_tick_data(self, symbol: str, count: int = 50) -> Dict:
        """
        获取股票实时分时数据
        
        Args:
            symbol: 股票代码
            count: 返回数据条数
            
        Returns:
            分时数据字典
        """
        try:
            print(f"正在获取分时数据: {symbol}", file=sys.stderr)
            
            # 获取分时数据 - 使用不同的API
            try:
                # 尝试获取当日分时数据
                tick_data = ak.stock_zh_a_minute(symbol=symbol, period='1', adjust="")
                
                if not tick_data.empty:
                    # 获取最新的count条数据
                    recent_data = tick_data.tail(count)
                    
                    tick_list = []
                    for _, row in recent_data.iterrows():
                        tick_list.append({
                            'time': row.name.strftime('%H:%M') if hasattr(row.name, 'strftime') else str(row.name),
                            'price': float(row['close']) if pd.notna(row['close']) else 0,
                            'volume': int(row['volume']) if pd.notna(row['volume']) else 0
                        })
                    
                    return {
                        'success': True,
                        'code': symbol,
                        'data': tick_list,
                        'count': len(tick_list),
                        'update_time': datetime.now().strftime('%Y-%m-%d %H:%M:%S')
                    }
                else:
                    return {
                        'success': False,
                        'code': symbol,
                        'error': '暂无分时数据',
                        'data': [],
                        'update_time': datetime.now().strftime('%Y-%m-%d %H:%M:%S')
                    }
                    
            except Exception:
                # 如果分时数据获取失败，返回空数据
                return {
                    'success': False,
                    'code': symbol,
                    'error': '分时数据暂不可用',
                    'data': [],
                    'update_time': datetime.now().strftime('%Y-%m-%d %H:%M:%S')
                }
                
        except Exception as e:
            error_msg = f"获取分时数据失败：{str(e)}"
            print(error_msg, file=sys.stderr)
            return {
                'success': False,
                'code': symbol,
                'error': error_msg,
                'data': [],
                'update_time': datetime.now().strftime('%Y-%m-%d %H:%M:%S')
            }
    
    def get_market_realtime(self) -> Dict:
        """
        获取大盘实时数据
        
        Returns:
            大盘实时数据字典
        """
        try:
            # 检查缓存
            current_time = time.time()
            cache_key = "market_realtime"
            
            if (cache_key in self.realtime_cache and 
                cache_key in self.last_realtime_update and
                current_time - self.last_realtime_update[cache_key] < self.cache_duration):
                return self.realtime_cache[cache_key]
            
            print("正在获取大盘实时数据", file=sys.stderr)
            
            # 获取主要指数实时数据
            indices = ['sh000001', 'sz399001', 'sz399006']  # 上证、深证、创业板
            market_data = []
            
            for index_code in indices:
                try:
                    index_data = ak.stock_zh_index_spot_em(symbol=index_code)
                    if not index_data.empty:
                        row = index_data.iloc[0]
                        market_data.append({
                            'code': index_code,
                            'name': row['名称'] if '名称' in row else index_code,
                            'current': float(row['最新价']) if '最新价' in row else 0,
                            'change_percent': float(row['涨跌幅']) if '涨跌幅' in row else 0,
                            'change_amount': float(row['涨跌额']) if '涨跌额' in row else 0
                        })
                except Exception as e:
                    print(f"获取指数{index_code}数据失败: {e}", file=sys.stderr)
                    continue
            
            result = {
                'success': True,
                'data': market_data,
                'update_time': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
                'market_status': self._get_market_status()
            }
            
            # 更新缓存
            self.realtime_cache[cache_key] = result
            self.last_realtime_update[cache_key] = current_time
            
            return result
            
        except Exception as e:
            error_msg = f"获取大盘数据失败：{str(e)}"
            print(error_msg, file=sys.stderr)
            return {
                'success': False,
                'error': error_msg,
                'data': [],
                'update_time': datetime.now().strftime('%Y-%m-%d %H:%M:%S')
            }
    
    def _get_market_status(self) -> str:
        """
        获取市场状态
        
        Returns:
            市场状态字符串
        """
        now = datetime.now()
        current_time = now.time()
        weekday = now.weekday()
        
        # 周末
        if weekday >= 5:  # 5=Saturday, 6=Sunday
            return 'closed'
        
        # 交易时间判断
        morning_start = datetime.strptime('09:30', '%H:%M').time()
        morning_end = datetime.strptime('11:30', '%H:%M').time()
        afternoon_start = datetime.strptime('13:00', '%H:%M').time()
        afternoon_end = datetime.strptime('15:00', '%H:%M').time()
        
        if ((morning_start <= current_time <= morning_end) or 
            (afternoon_start <= current_time <= afternoon_end)):
            return 'trading'
        else:
            return 'closed'
    
    def _identify_symbol_type(self, symbol: str) -> str:
        """
        识别股票代码类型
        
        Args:
            symbol: 股票/指数代码
            
        Returns:
            代码类型：'stock'（股票）或'index'（指数）
        """
        # 检查是否为指数代码
        if symbol in INDEX_CODE_MAPPING:
            return 'index'
        
        # 检查是否为A股股票代码
        if len(symbol) == 6 and symbol.isdigit():
            if symbol.startswith(('00', '30', '60')):
                return 'stock'
        
        return 'unknown'
    
    def _validate_date_range(self, start_date: str, end_date: str) -> tuple:
        """
        验证和调整日期范围
        
        Args:
            start_date: 开始日期 (YYYY-MM-DD)
            end_date: 结束日期 (YYYY-MM-DD)
            
        Returns:
            调整后的日期范围元组
        """
        try:
            # 处理空日期参数
            if not start_date or not end_date:
                end_date = datetime.now().strftime('%Y-%m-%d')
                start_date = (datetime.now() - timedelta(days=30)).strftime('%Y-%m-%d')
                return start_date, end_date
            
            start_dt = datetime.strptime(start_date, '%Y-%m-%d')
            end_dt = datetime.strptime(end_date, '%Y-%m-%d')
            
            # 确保开始日期不晚于结束日期
            if start_dt > end_dt:
                start_dt, end_dt = end_dt, start_dt
            
            # 确保不超过当前日期
            today = datetime.now()
            if end_dt > today:
                end_dt = today
            
            # 确保日期范围不超过2年（避免数据量过大）
            max_range = timedelta(days=730)
            if end_dt - start_dt > max_range:
                start_dt = end_dt - max_range
            
            return start_dt.strftime('%Y-%m-%d'), end_dt.strftime('%Y-%m-%d')
            
        except ValueError as e:
            # 如果日期格式无效，返回最近30天
            end_date = datetime.now().strftime('%Y-%m-%d')
            start_date = (datetime.now() - timedelta(days=30)).strftime('%Y-%m-%d')
            return start_date, end_date
    
    def _normalize_data_format(self, df: pd.DataFrame, symbol: str, symbol_type: str) -> Dict:
        """
        标准化数据格式，确保前端能正确解析
        
        Args:
            df: 原始数据DataFrame
            symbol: 股票/指数代码
            symbol_type: 代码类型
            
        Returns:
            标准化后的数据字典
        """
        try:
            # 确保DataFrame不为空
            if df.empty:
                return self._create_empty_response(symbol, symbol_type, "暂无数据")
            
            # 重置索引，确保日期列可访问
            df_reset = df.reset_index()
            
            # 标准化列名映射
            column_mapping = {
                # 股票数据列名
                '日期': 'date', 'date': 'date',
                '开盘': 'open', 'open': 'open',
                '收盘': 'close', 'close': 'close',
                '最高': 'high', 'high': 'high',
                '最低': 'low', 'low': 'low',
                '成交量': 'volume', 'volume': 'volume',
                '成交额': 'amount',
                
                # 指数数据列名
                '开盘价': 'open',
                '收盘价': 'close',
                '最高价': 'high',
                '最低价': 'low',
            }
            
            # 重命名列
            df_renamed = df_reset.rename(columns=column_mapping)
            
            # 确保必要的列存在
            required_columns = ['date', 'open', 'close', 'high', 'low']
            missing_columns = [col for col in required_columns if col not in df_renamed.columns]
            
            if missing_columns:
                return self._create_empty_response(symbol, symbol_type, f"数据格式不完整，缺少列：{missing_columns}")
            
            # 处理数据类型
            for col in ['open', 'close', 'high', 'low']:
                df_renamed[col] = pd.to_numeric(df_renamed[col], errors='coerce')
            
            # 处理成交量（可能不存在）
            if 'volume' in df_renamed.columns:
                df_renamed['volume'] = pd.to_numeric(df_renamed['volume'], errors='coerce').fillna(0)
            else:
                df_renamed['volume'] = 0
            
            # 按日期排序
            df_renamed['date'] = pd.to_datetime(df_renamed['date'])
            df_renamed = df_renamed.sort_values('date')
            
            # 转换为前端需要的格式
            data_list = []
            for _, row in df_renamed.iterrows():
                data_list.append({
                    'date': row['date'].strftime('%Y-%m-%d'),
                    'open': float(row['open']) if pd.notna(row['open']) else 0,
                    'close': float(row['close']) if pd.notna(row['close']) else 0,
                    'high': float(row['high']) if pd.notna(row['high']) else 0,
                    'low': float(row['low']) if pd.notna(row['low']) else 0,
                    'volume': int(row['volume']) if pd.notna(row['volume']) else 0
                })
            
            # 计算统计信息
            if data_list:
                first_price = data_list[0]['close']
                last_price = data_list[-1]['close']
                change_percent = ((last_price - first_price) / first_price * 100) if first_price != 0 else 0
                max_price = max([d['high'] for d in data_list])
                min_price = min([d['low'] for d in data_list if d['low'] > 0])
                avg_volume = sum([d['volume'] for d in data_list]) / len(data_list)
                
                summary = {
                    'changePercent': round(change_percent, 2),
                    'maxPrice': round(max_price, 2),
                    'minPrice': round(min_price, 2),
                    'avgVolume': int(avg_volume)
                }
            else:
                summary = {
                    'changePercent': 0,
                    'maxPrice': 0,
                    'minPrice': 0,
                    'avgVolume': 0
                }
            
            # 获取显示名称
            if symbol_type == 'index' and symbol in INDEX_CODE_MAPPING:
                display_name = INDEX_CODE_MAPPING[symbol]['name']
            else:
                display_name = f"股票_{symbol}"
            
            return {
                'success': True,
                'code': symbol,
                'name': display_name,
                'type': symbol_type,
                'currentPrice': data_list[-1]['close'] if data_list else 0,
                'data': data_list,
                'summary': summary,
                'dataCount': len(data_list),
                'lastUpdate': datetime.now().isoformat()
            }
            
        except Exception as e:
            return self._create_empty_response(symbol, symbol_type, f"数据处理错误：{str(e)}")
    
    def _create_empty_response(self, symbol: str, symbol_type: str, message: str) -> Dict:
        """创建空数据响应"""
        return {
            'success': False,
            'code': symbol,
            'name': f"{'指数' if symbol_type == 'index' else '股票'}_{symbol}",
            'type': symbol_type,
            'currentPrice': 0,
            'data': [],
            'summary': {
                'changePercent': 0,
                'maxPrice': 0,
                'minPrice': 0,
                'avgVolume': 0
            },
            'error': message,
            'dataCount': 0,
            'lastUpdate': datetime.now().isoformat()
        }
    
    def get_stock_data(self, symbol: str, start_date: str, end_date: str) -> Dict:
        """
        获取股票历史数据
        
        Args:
            symbol: 股票代码（6位数字）
            start_date: 开始日期
            end_date: 结束日期
            
        Returns:
            标准化的股票数据字典
        """
        try:
            # 验证日期范围
            start_date, end_date = self._validate_date_range(start_date, end_date)
            
            # 检查缓存
            cached_data = self.cache.get(symbol, start_date, end_date, 'stock')
            if cached_data:
                return cached_data
            
            print(f"正在获取股票数据: {symbol}, 日期范围: {start_date} 到 {end_date}", file=sys.stderr)
            
            # 使用akshare获取股票数据
            df = ak.stock_zh_a_hist(
                symbol=symbol,
                period="daily",
                start_date=start_date.replace('-', ''),
                end_date=end_date.replace('-', ''),
                adjust=""
            )
            
            # 标准化数据格式
            result = self._normalize_data_format(df, symbol, 'stock')
            
            # 缓存成功的数据
            if result['success']:
                self.cache.set(symbol, start_date, end_date, 'stock', result)
            
            return result
            
        except Exception as e:
            error_msg = f"获取股票数据失败：{str(e)}"
            print(error_msg, file=sys.stderr)
            return self._create_empty_response(symbol, 'stock', error_msg)
    
    def get_index_data(self, symbol: str, start_date: str, end_date: str) -> Dict:
        """
        获取指数历史数据
        
        Args:
            symbol: 指数代码（如000001.SH）
            start_date: 开始日期
            end_date: 结束日期
            
        Returns:
            标准化的指数数据字典
        """
        try:
            # 验证日期范围
            start_date, end_date = self._validate_date_range(start_date, end_date)
            
            # 检查缓存（缩短缓存时间以获取更新的数据）
            cached_data = self.cache.get(symbol, start_date, end_date, 'index')
            if cached_data:
                # 如果是今天的数据，不使用缓存，获取最新数据
                today = datetime.now().strftime('%Y-%m-%d')
                if end_date == today:
                    print(f"今日指数数据，跳过缓存: {symbol}", file=sys.stderr)
                else:
                    return cached_data
            
            # 检查是否为支持的指数
            if symbol not in INDEX_CODE_MAPPING:
                return self._create_empty_response(symbol, 'index', f"不支持的指数代码：{symbol}")
            
            ak_symbol = INDEX_CODE_MAPPING[symbol]['ak_symbol']
            print(f"正在获取指数数据: {symbol} ({ak_symbol}), 日期范围: {start_date} 到 {end_date}", file=sys.stderr)
            
            # 获取指数历史数据
            df = None
            try:
                # 尝试使用不同的API获取指数数据
                df = ak.stock_zh_index_daily(symbol=ak_symbol)
                print(f"使用stock_zh_index_daily成功获取数据", file=sys.stderr)
            except Exception as e:
                print(f"获取指数历史数据失败，尝试备用方法: {e}", file=sys.stderr)
                try:
                    # 备用方法：使用index_zh_a_hist
                    df = ak.index_zh_a_hist(
                        symbol=ak_symbol, 
                        period="daily", 
                        start_date=start_date.replace('-', ''), 
                        end_date=end_date.replace('-', '')
                    )
                    print(f"使用index_zh_a_hist成功获取数据", file=sys.stderr)
                except Exception as e2:
                    print(f"备用方法也失败: {e2}", file=sys.stderr)
                    return self._create_empty_response(symbol, 'index', f"获取指数数据失败：{str(e2)}")
            
            if df is None or df.empty:
                return self._create_empty_response(symbol, 'index', "获取到的指数数据为空")
            
            # 处理日期列
            # 检查是否有date列，如果没有则使用索引作为日期
            if 'date' not in df.columns:
                if df.index.name == 'date' or pd.api.types.is_datetime64_any_dtype(df.index):
                    df = df.reset_index()
                    if df.columns[0] not in ['date'] and pd.api.types.is_datetime64_any_dtype(df.iloc[:, 0]):
                        df.rename(columns={df.columns[0]: 'date'}, inplace=True)
                else:
                    # 如果索引不是日期类型，尝试寻找日期列
                    date_cols = [col for col in df.columns if 'date' in col.lower() or '日期' in str(col)]
                    if date_cols:
                        df.rename(columns={date_cols[0]: 'date'}, inplace=True)
                    else:
                        return self._create_empty_response(symbol, 'index', "无法找到日期列")
            
            df['date'] = pd.to_datetime(df['date'])
            start_dt = pd.to_datetime(start_date)
            end_dt = pd.to_datetime(end_date)
            df = df[(df['date'] >= start_dt) & (df['date'] <= end_dt)]
            
            # 检查是否需要补充今日数据
            today = datetime.now().strftime('%Y-%m-%d')
            today_dt = pd.to_datetime(today)
            
            # 如果查询范围包含今天，且今天是工作日，尝试获取今日实时数据
            if (end_dt >= today_dt and 
                datetime.now().weekday() < 5 and  # 工作日
                (df.empty or df['date'].max() < today_dt)):  # 没有今日数据
                
                print(f"尝试获取今日指数实时数据: {symbol}", file=sys.stderr)
                realtime_data = self.get_index_realtime_data(symbol)
                
                if realtime_data and realtime_data.get('success'):
                    # 将实时数据添加到历史数据中
                    today_row = {
                        'date': today_dt,
                        'open': realtime_data.get('open', realtime_data.get('current', 0)),
                        'close': realtime_data.get('current', 0),
                        'high': realtime_data.get('high', realtime_data.get('current', 0)),
                        'low': realtime_data.get('low', realtime_data.get('current', 0)),
                        'volume': realtime_data.get('volume', 0)
                    }
                    
                    # 创建今日数据的DataFrame
                    today_df = pd.DataFrame([today_row])
                    
                    # 合并数据
                    if not df.empty:
                        df = pd.concat([df, today_df], ignore_index=True)
                    else:
                        df = today_df
                    
                    print(f"成功添加今日指数数据: {symbol}", file=sys.stderr)
            
            # 标准化数据格式
            result = self._normalize_data_format(df, symbol, 'index')
            
            # 只缓存非今日的数据
            if result['success'] and end_date != today:
                self.cache.set(symbol, start_date, end_date, 'index', result)
            
            return result
            
        except Exception as e:
            error_msg = f"获取指数数据失败：{str(e)}"
            print(error_msg, file=sys.stderr)
            return self._create_empty_response(symbol, 'index', error_msg)
    
    def get_financial_data(self, symbol: str, start_date: str, end_date: str) -> Dict:
        """
        统一的金融数据获取接口
        
        Args:
            symbol: 股票/指数代码
            start_date: 开始日期
            end_date: 结束日期
            
        Returns:
            标准化的金融数据字典
        """
        # 识别代码类型
        symbol_type = self._identify_symbol_type(symbol)
        
        if symbol_type == 'stock':
            return self.get_stock_data(symbol, start_date, end_date)
        elif symbol_type == 'index':
            return self.get_index_data(symbol, start_date, end_date)
        else:
            return self._create_empty_response(symbol, 'unknown', f"无法识别的代码格式：{symbol}")


def main():
    """命令行入口函数"""
    parser = argparse.ArgumentParser(description='获取金融数据')
    parser.add_argument('action', choices=['stock', 'kline'], default='stock', nargs='?', 
                       help='操作类型：stock(股票数据), kline(K线数据)')
    parser.add_argument('symbol', help='股票/指数代码')
    parser.add_argument('start_date', help='开始日期 (YYYY-MM-DD)')
    parser.add_argument('end_date', help='结束日期 (YYYY-MM-DD)')
    parser.add_argument('period', nargs='?', default='daily', help='K线周期')
    
    args = parser.parse_args()
    
    # 创建数据服务实例
    service = FinancialDataService()
    
    # 根据操作类型调用相应的服务
    if args.action == 'stock':
        result = service.get_financial_data(args.symbol, args.start_date, args.end_date)
    elif args.action == 'kline':
        result = service.get_kline_data(args.symbol, args.period, args.start_date, args.end_date)
    else:
        result = {
            'success': False,
            'error': f'不支持的操作类型: {args.action}'
        }
    
    # 输出JSON结果
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()