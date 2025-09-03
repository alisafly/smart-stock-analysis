/**
 * ResizableLayout组件 - 可拖拽调整的布局容器
 * 
 * 主要功能：
 * 1. 支持拖拽分割条调整左右面板宽度比例
 * 2. 左侧面板折叠/展开功能
 * 3. 右侧面板全屏模式切换
 * 4. 用户偏好保存到localStorage
 * 5. 响应式设计，适配不同屏幕尺寸
 * 6. 最小/最大宽度限制保证可用性
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';

interface ResizableLayoutProps {
  leftPanel: React.ReactNode;
  rightPanel: React.ReactNode;
  defaultLeftWidth?: number; // 默认左侧宽度百分比
  minLeftWidth?: number; // 最小左侧宽度百分比
  maxLeftWidth?: number; // 最大左侧宽度百分比
  className?: string;
}

const ResizableLayout: React.FC<ResizableLayoutProps> = ({
  leftPanel,
  rightPanel,
  defaultLeftWidth = 60,
  minLeftWidth = 30,
  maxLeftWidth = 80,
  className = ''
}) => {
  // 状态管理
  const [leftWidth, setLeftWidth] = useState(() => {
    // 从localStorage恢复用户偏好
    const saved = localStorage.getItem('resizable-layout-left-width');
    return saved ? Math.max(minLeftWidth, Math.min(maxLeftWidth, parseFloat(saved))) : defaultLeftWidth;
  });
  
  const [isLeftCollapsed, setIsLeftCollapsed] = useState(() => {
    const saved = localStorage.getItem('resizable-layout-left-collapsed');
    return saved === 'true';
  });
  
  const [isRightFullscreen, setIsRightFullscreen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  
  // 引用
  const containerRef = useRef<HTMLDivElement>(null);
  const startXRef = useRef(0);
  const startWidthRef = useRef(0);

  /**
   * 开始拖拽
   */
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    startXRef.current = e.clientX;
    startWidthRef.current = leftWidth;
    document.body.classList.add('dragging');
  }, [leftWidth]);

  /**
   * 拖拽过程中
   */
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging || !containerRef.current) return;

    const containerRect = containerRef.current.getBoundingClientRect();
    const deltaX = e.clientX - startXRef.current;
    const deltaPercent = (deltaX / containerRect.width) * 100;
    const newWidth = Math.max(
      minLeftWidth,
      Math.min(maxLeftWidth, startWidthRef.current + deltaPercent)
    );

    setLeftWidth(newWidth);
  }, [isDragging, minLeftWidth, maxLeftWidth]);

  /**
   * 结束拖拽
   */
  const handleMouseUp = useCallback(() => {
    if (isDragging) {
      setIsDragging(false);
      document.body.classList.remove('dragging');
      // 保存用户偏好
      localStorage.setItem('resizable-layout-left-width', leftWidth.toString());
    }
  }, [isDragging, leftWidth]);

  /**
   * 切换左侧面板折叠状态
   */
  const toggleLeftCollapsed = useCallback(() => {
    const newCollapsed = !isLeftCollapsed;
    setIsLeftCollapsed(newCollapsed);
    localStorage.setItem('resizable-layout-left-collapsed', newCollapsed.toString());
  }, [isLeftCollapsed]);

  /**
   * 切换右侧面板全屏状态
   */
  const toggleRightFullscreen = useCallback(() => {
    setIsRightFullscreen(!isRightFullscreen);
  }, [isRightFullscreen]);

  /**
   * 重置布局为默认状态
   */
  const resetLayout = useCallback(() => {
    setLeftWidth(defaultLeftWidth);
    setIsLeftCollapsed(false);
    setIsRightFullscreen(false);
    localStorage.setItem('resizable-layout-left-width', defaultLeftWidth.toString());
    localStorage.setItem('resizable-layout-left-collapsed', 'false');
  }, [defaultLeftWidth]);

  // 事件监听器
  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  // 计算实际宽度
  const actualLeftWidth = isLeftCollapsed ? 0 : leftWidth;
  const actualRightWidth = isRightFullscreen ? 100 : (100 - actualLeftWidth);

  return (
    <div 
      ref={containerRef}
      className={`relative h-full flex ${className}`}
    >
      {/* 左侧面板 */}
      <div 
        className={`flex-shrink-0 transition-all duration-300 ease-in-out ${
          isLeftCollapsed ? 'w-0 overflow-hidden' : ''
        } ${isRightFullscreen ? 'hidden' : ''}`}
        style={{ 
          width: isLeftCollapsed ? '0%' : `${leftWidth}%`
        }}
      >
        <div className="h-full overflow-hidden">
          {leftPanel}
        </div>
      </div>

      {/* 分割条和控制按钮 */}
      {!isRightFullscreen && (
        <div className="relative flex-shrink-0 group">
          {/* 分割条 */}
          <div
            className={`w-1 h-full bg-gray-300 hover:bg-blue-400 cursor-col-resize transition-colors relative ${
              isDragging ? 'bg-blue-500' : ''
            }`}
            onMouseDown={handleMouseDown}
          >
            {/* 拖拽指示器 */}
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-1 h-8 bg-white rounded-sm opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
          </div>

          {/* 控制按钮组 */}
          <div className="absolute top-1/2 left-2 transform -translate-y-1/2 flex flex-col space-y-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
            {/* 折叠/展开左侧按钮 */}
            <button
              onClick={toggleLeftCollapsed}
              className="w-6 h-6 bg-white border border-gray-300 rounded hover:bg-gray-50 flex items-center justify-center shadow-sm"
              title={isLeftCollapsed ? '展开左侧面板' : '折叠左侧面板'}
            >
              <svg className="w-3 h-3 text-gray-600" fill="currentColor" viewBox="0 0 20 20">
                {isLeftCollapsed ? (
                  <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                ) : (
                  <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                )}
              </svg>
            </button>

            {/* 重置布局按钮 */}
            <button
              onClick={resetLayout}
              className="w-6 h-6 bg-white border border-gray-300 rounded hover:bg-gray-50 flex items-center justify-center shadow-sm"
              title="重置布局"
            >
              <svg className="w-3 h-3 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* 右侧面板 */}
      <div 
        className={`flex-1 transition-all duration-300 ease-in-out relative ${
          isRightFullscreen ? 'fixed inset-0 z-50 bg-white' : ''
        }`}
        style={{ 
          width: isRightFullscreen ? '100%' : `${actualRightWidth}%`
        }}
      >
        <div className="h-full overflow-hidden relative">
          {/* 全屏模式切换按钮 */}
          <button
            onClick={toggleRightFullscreen}
            className="absolute top-4 right-4 w-8 h-8 bg-white border border-gray-300 rounded hover:bg-gray-50 flex items-center justify-center shadow-sm z-10"
            title={isRightFullscreen ? '退出全屏' : '全屏显示'}
          >
            <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {isRightFullscreen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 9V4.5M9 9H4.5M9 9L3.5 3.5M15 15v4.5M15 15h4.5M15 15l5.5 5.5M9 15H4.5M9 15v4.5M9 15l-5.5 5.5M15 9h4.5M15 9V4.5M15 9l5.5-5.5" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
              )}
            </svg>
          </button>
          
          {rightPanel}
        </div>
      </div>
    </div>
  );
};

export default ResizableLayout;