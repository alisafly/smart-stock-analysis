# AI大模型集成使用说明

## 🎉 集成完成！

您的股票分析平台现已成功集成AI大模型功能，支持多种AI服务提供商和本地大模型。

## 🔧 配置选项

### 1. OpenAI API 配置（自定义URL）
```bash
# 在 backend/.env 文件中设置
AI_PROVIDER=openai
OPENAI_API_KEY=your_api_key_here
OPENAI_BASE_URL=https://api.zhizengzeng.com/v1
OPENAI_MODEL=gpt-3.5-turbo
```

### 2. LMStudio 本地大模型配置
```bash
# 在 backend/.env 文件中设置
AI_PROVIDER=lmstudio
LMSTUDIO_BASE_URL=http://localhost:1234/v1
LMSTUDIO_MODEL=local-model
```

### 3. 禁用AI功能
```bash
AI_PROVIDER=disabled
```

## 🚀 功能特性

### 智能股票分析
- **📊 技术分析**: 基于股票数据的专业技术分析
- **📈 趋势判断**: 智能识别股票短期和长期趋势  
- **💰 投资建议**: 基于数据提供个性化投资建议
- **⚠️ 风险评估**: 全面的风险分析和风控建议
- **📰 市场解读**: 深度解读股价波动原因

### 多模型支持
- **OpenAI GPT**: 支持自定义API URL（已配置您的地址）
- **LMStudio**: 支持本地部署的大语言模型
- **降级机制**: 当AI服务不可用时自动降级到本地分析

### 智能上下文
- **股票数据集成**: AI能够理解当前显示的股票数据
- **历史对话**: 维护对话上下文，支持连续问答
- **个性化分析**: 根据用户选择的股票提供针对性分析

## 📊 使用方法

### 1. 基础使用
1. 在左侧股票图表中输入股票代码（如：000001、600036）
2. 选择时间范围查看股票数据
3. 在右侧AI聊天面板提问

### 2. 推荐问题示例
- "这只股票的趋势如何？"
- "现在适合买入吗？"
- "最近的价格波动说明什么？"  
- "这只股票有什么风险？"
- "请分析一下技术指标"
- "给我一些投资建议"

### 3. 高级功能
- **多股票对比**: 切换不同股票后询问对比分析
- **时间段分析**: 调整时间范围后获取不同周期分析
- **专业术语解释**: 询问任何金融术语的含义

## 🔍 API接口

### 聊天接口
```http
POST /api/chat
Content-Type: application/json

{
  "message": "用户提问",
  "stockContext": {
    "code": "000001",
    "name": "股票名称",
    "currentPrice": 12.34,
    "data": [...],
    "summary": {...}
  }
}
```

### 状态检查
```http
GET /api/chat/status
```

### 对话历史
```http
GET /api/chat/history?limit=20
DELETE /api/chat/history
```

## 🛠️ 故障排除

### OpenAI API 问题
1. **API密钥错误**: 检查 `OPENAI_API_KEY` 是否正确
2. **网络连接**: 确认能访问 `https://api.zhizengzeng.com`
3. **模型不存在**: 验证 `OPENAI_MODEL` 配置

### LMStudio 问题
1. **连接失败**: 确认LMStudio服务器已启动
2. **端口错误**: 检查 `LMSTUDIO_BASE_URL` 端口配置
3. **模型未加载**: 在LMStudio中确认模型已正确加载

### 常见错误
1. **AI服务不可用**: 检查网络连接和API配置
2. **响应过慢**: 调整 `MAX_TOKENS` 参数或使用更小模型
3. **分析不准确**: 调整 `TEMPERATURE` 参数（0.1-1.0）

## 📈 性能优化

### 响应速度优化
- 使用较小的 `MAX_TOKENS` 值（如1000-1500）
- 选择更快的模型（如gpt-3.5-turbo）
- 对于LMStudio，选择参数量较小的本地模型

### 分析质量优化
- 调整 `TEMPERATURE` 参数：
  - 0.1-0.3：更稳定、保守的分析
  - 0.5-0.7：平衡的分析（推荐）
  - 0.8-1.0：更创新、多样的分析

## 🔐 安全建议

1. **保护API密钥**: 切勿将API密钥提交到版本控制
2. **访问控制**: 生产环境建议添加API访问限制
3. **数据隐私**: 确认AI服务提供商的数据处理政策
4. **备份配置**: 定期备份AI服务配置

## 🆕 未来扩展

### 计划功能
- [ ] 支持更多AI提供商（Claude、文心一言等）
- [ ] 多语言支持（英文、日文等）
- [ ] 语音对话功能
- [ ] 自定义分析模板
- [ ] AI训练历史数据微调

### 集成建议
- 添加用户认证后实现个人化AI助手
- 集成实时股票数据后提供实时分析
- 扩展到基金、债券等其他金融产品分析

---

## 🎯 快速开始

1. **配置API密钥**:
   ```bash
   # 编辑 backend/.env
   OPENAI_API_KEY=your_actual_api_key
   ```

2. **重启服务**:
   ```bash
   # 后端会自动重启（nodemon）
   # 检查启动日志确认AI客户端初始化成功
   ```

3. **开始使用**:
   - 加载股票数据
   - 在聊天面板提问
   - 享受AI智能分析！

---

**祝您使用愉快！** 🚀📈