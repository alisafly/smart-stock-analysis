/**
 * Header组件 - 应用头部
 */

import React from 'react';

const Header: React.FC = () => {
  return (
    <header className="bg-white shadow-sm border-b border-gray-200">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* 左侧：应用标题和图标 */}
          <div className="flex items-center space-x-4">
            <div className="flex items-center justify-center w-10 h-10 bg-primary-600 rounded-lg">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">智能金融分析平台</h1>
              <p className="text-xs text-gray-500">Intelligent Financial Analysis Platform</p>
            </div>
          </div>
          
          {/* 右侧：状态信息 */}
          <div className="flex items-center space-x-4">
            <div className="hidden sm:flex items-center space-x-2">
              <div className="w-2 h-2 bg-success-500 rounded-full animate-pulse"></div>
              <span className="text-sm text-gray-600">实时数据</span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;