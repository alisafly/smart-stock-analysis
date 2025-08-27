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
    '000001.SH': {'name': '上证指数', 'ak_symbol': 'sh000001'},
    '399001.SZ': {'name': '深证成指', 'ak_symbol': 'sz399001'},
    '399006.SZ': {'name': '创业板指', 'ak_symbol': 'sz399006'},
    '399005.SZ': {'name': '中小板指', 'ak_symbol': 'sz399005'},
    '000300.SH': {'name': '沪深300', 'ak_symbol': 'sh000300'},
    '000905.SH': {'name': '中证500', 'ak_symbol': 'sh000905'},
    '000852.SH': {'name': '中证1000', 'ak_symbol': 'sh000852'},
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
            
            # 检查缓存
            cached_data = self.cache.get(symbol, start_date, end_date, 'index')
            if cached_data:
                return cached_data
            
            # 检查是否为支持的指数
            if symbol not in INDEX_CODE_MAPPING:
                return self._create_empty_response(symbol, 'index', f"不支持的指数代码：{symbol}")
            
            ak_symbol = INDEX_CODE_MAPPING[symbol]['ak_symbol']
            print(f"正在获取指数数据: {symbol} ({ak_symbol}), 日期范围: {start_date} 到 {end_date}", file=sys.stderr)
            
            # 使用akshare获取指数数据
            df = ak.stock_zh_index_daily(symbol=ak_symbol)
            
            # 过滤日期范围
            df['date'] = pd.to_datetime(df['date'])
            start_dt = pd.to_datetime(start_date)
            end_dt = pd.to_datetime(end_date)
            df = df[(df['date'] >= start_dt) & (df['date'] <= end_dt)]
            
            # 标准化数据格式
            result = self._normalize_data_format(df, symbol, 'index')
            
            # 缓存成功的数据
            if result['success']:
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
    parser.add_argument('symbol', help='股票/指数代码')
    parser.add_argument('start_date', help='开始日期 (YYYY-MM-DD)')
    parser.add_argument('end_date', help='结束日期 (YYYY-MM-DD)')
    
    args = parser.parse_args()
    
    # 创建数据服务实例
    service = FinancialDataService()
    
    # 获取数据
    result = service.get_financial_data(args.symbol, args.start_date, args.end_date)
    
    # 输出JSON结果
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()