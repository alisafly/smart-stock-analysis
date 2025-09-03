#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
实时数据服务模块

主要功能：
1. 获取股票实时行情数据
2. 获取股票分时数据
3. 获取大盘实时数据
4. 获取指数实时数据
5. 提供统一的命令行接口

作者：智能金融分析平台团队
日期：2025-08-28
"""

import sys
import json
import argparse
import akshare as ak
import pandas as pd
from datetime import datetime
import time
from typing import Dict, List, Optional

# 指数代码映射
# 此处需要使用akshare指数实时数据API的正确代码格式
INDEX_CODE_MAPPING = {
    '000001.SH': {'ak_symbol': '000001', 'name': '上证指数'},
    '399001.SZ': {'ak_symbol': '399001', 'name': '深证成指'},
    '399006.SZ': {'ak_symbol': '399006', 'name': '创业板指'},
    '399005.SZ': {'ak_symbol': '399005', 'name': '中小板指'},
    '000300.SH': {'ak_symbol': '000300', 'name': '沪深300'},
    '000905.SH': {'ak_symbol': '000905', 'name': '中证500'},
}

class RealtimeDataService:
    """实时数据服务类"""
    
    def __init__(self):
        """初始化实时数据服务"""
        self.cache = {}
        self.cache_duration = 60  # 缓存1分钟
        self.last_update = {}
    
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
            
            if (cache_key in self.cache and 
                cache_key in self.last_update and
                current_time - self.last_update[cache_key] < self.cache_duration):
                return self.cache[cache_key]
            
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
                    try:
                        # 方法3：直接使用指数代码
                        index_data = ak.tool_trade_date_hist_sina()
                        # 如果上面都失败，返回默认数据
                        raise Exception("所有API都失败")
                    except Exception as e3:
                        print(f"方法3失败: {e3}", file=sys.stderr)
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
                self.cache[cache_key] = result
                self.last_update[cache_key] = current_time
                
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
            
            if (cache_key in self.cache and 
                cache_key in self.last_update and
                current_time - self.last_update[cache_key] < self.cache_duration):
                return self.cache[cache_key]
            
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
                self.cache[cache_key] = result
                self.last_update[cache_key] = current_time
                
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
            
            if (cache_key in self.cache and 
                cache_key in self.last_update and
                current_time - self.last_update[cache_key] < self.cache_duration):
                return self.cache[cache_key]
            
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
            self.cache[cache_key] = result
            self.last_update[cache_key] = current_time
            
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


def main():
    """命令行入口函数"""
    parser = argparse.ArgumentParser(description='获取实时金融数据')
    parser.add_argument('method', choices=['realtime', 'tick', 'market', 'index_realtime'], 
                       help='数据类型：realtime(实时行情), tick(分时数据), market(大盘数据), index_realtime(指数实时数据)')
    parser.add_argument('symbol', nargs='?', help='股票/指数代码（realtime、tick和index_realtime需要）')
    
    args = parser.parse_args()
    
    # 创建实时数据服务实例
    service = RealtimeDataService()
    
    # 根据方法调用相应的服务
    if args.method == 'realtime':
        if not args.symbol:
            result = {
                'success': False,
                'error': 'realtime方法需要提供股票代码'
            }
        else:
            result = service.get_realtime_data(args.symbol)
    elif args.method == 'index_realtime':
        if not args.symbol:
            result = {
                'success': False,
                'error': 'index_realtime方法需要提供指数代码'
            }
        else:
            result = service.get_index_realtime_data(args.symbol)
    elif args.method == 'tick':
        if not args.symbol:
            result = {
                'success': False,
                'error': 'tick方法需要提供股票代码'
            }
        else:
            result = service.get_realtime_tick_data(args.symbol)
    elif args.method == 'market':
        result = service.get_market_realtime()
    else:
        result = {
            'success': False,
            'error': f'不支持的方法: {args.method}'
        }
    
    # 输出JSON结果
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()