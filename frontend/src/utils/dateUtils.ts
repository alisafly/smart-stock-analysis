/**
 * 日期工具函数
 */

import { format, subDays, isWeekend } from 'date-fns';

/**
 * 格式化日期为 YYYY-MM-DD 格式
 */
export const formatDate = (date: Date): string => {
  return format(date, 'yyyy-MM-dd');
};

/**
 * 获取默认的日期范围（最近30天，排除周末）
 */
export const getDefaultDateRange = () => {
  const endDate = new Date();
  const startDate = subDays(endDate, 30);
  
  return {
    startDate: formatDate(startDate),
    endDate: formatDate(endDate)
  };
};

/**
 * 检查是否为交易日（排除周末）
 */
export const isTradingDay = (date: Date): boolean => {
  return !isWeekend(date);
};

/**
 * 获取最近的交易日
 */
export const getLastTradingDay = (): string => {
  let date = new Date();
  while (isWeekend(date)) {
    date = subDays(date, 1);
  }
  return formatDate(date);
};