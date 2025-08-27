# 🤖 多模型AI集成使用指南

## 🎉 完成升级！

您的股票分析平台现已支持多种AI大模型，包括智谱AI、月之暗面Kimi、DeepSeek等，并具备动态切换功能！

---

## 🔧 已配置的AI服务

### 当前状态
- ✅ **OpenAI**: 已配置，使用您的自定义API地址
- ⚙️ **智谱AI**: 等待配置API密钥
- ⚙️ **月之暗面Kimi**: 等待配置API密钥
- ⚙️ **DeepSeek**: 等待配置API密钥
- ⚙️ **Claude**: 等待配置API密钥
- ✅ **LMStudio**: 可配置本地模型
- ✅ **本地分析**: 规则引擎备份

---

## 📝 重启服务说明

**好消息！** Nodemon已自动检测到配置变化并重启服务，无需手动重启！

- 🔄 **自动重启**: 每次修改.env文件后自动重启
- 🌟 **环境变量加载**: 已加载36个环境变量
- ✅ **OpenAI客户端**: 已初始化成功

---

## 🔑 配置其他AI模型

### 1. 智谱AI（推荐）

```bash
# 在 backend/.env 中设置
AI_PROVIDER=zhipu
ZHIPU_API_KEY=your_zhipu_api_key_here
```

**获取API密钥**: [智谱AI开放平台](https://open.bigmodel.cn/)

### 2. 月之暗面Kimi

```bash
AI_PROVIDER=moonshot
MOONSHOT_API_KEY=your_moonshot_api_key_here
```

**获取API密钥**: [月之暗面API](https://platform.moonshot.cn/)

### 3. DeepSeek

```bash
AI_PROVIDER=deepseek
DEEPSEEK_API_KEY=your_deepseek_api_key_here
```

**获取API密钥**: [DeepSeek开放平台](https://platform.deepseek.com/)

### 4. LMStudio本地模型

```bash
AI_PROVIDER=lmstudio
LMSTUDIO_BASE_URL=http://localhost:1234/v1
LMSTUDIO_MODEL=your_local_model_name
```

**使用步骤**:
1. 下载 [LMStudio](https://lmstudio.ai/)
2. 加载本地大语言模型
3. 启动本地服务器
4. 设置上述配置

---

## 🔄 动态切换模型

### API接口切换

```bash
# 切换到智谱AI
curl -X POST http://localhost:3002/api/chat/switch \
  -H "Content-Type: application/json" \
  -d '{"provider": "zhipu"}'

# 切换到月之暗面
curl -X POST http://localhost:3002/api/chat/switch \
  -H "Content-Type: application/json" \
  -d '{"provider": "moonshot"}'

# 切换到本地模式
curl -X POST http://localhost:3002/api/chat/switch \
  -H "Content-Type: application/json" \
  -d '{"provider": "disabled"}'
```

### PowerShell切换示例

```powershell
# 切换到智谱AI
$body = @{ provider = "zhipu" } | ConvertTo-Json
Invoke-RestMethod -Uri "http://localhost:3002/api/chat/switch" -Method POST -Body $body -ContentType "application/json"

# 切换到月之暗面Kimi
$body = @{ provider = "moonshot" } | ConvertTo-Json
Invoke-RestMethod -Uri "http://localhost:3002/api/chat/switch" -Method POST -Body $body -ContentType "application/json"
```

---

## 📊 状态检查API

### 查看当前AI服务状态
```bash
GET http://localhost:3002/api/chat/status
```

### 查看所有支持的模型
```bash
GET http://localhost:3002/api/chat/providers
```

---

## 🚀 使用体验

### 1. 智能股票分析
- 在左侧加载股票数据
- AI会自动理解股票上下文
- 提供专业的投资分析和建议

### 2. 模型特色对比

| 模型 | 特色 | 适用场景 |
|------|------|----------|
| **OpenAI GPT** | 通用能力强 | 综合分析 |
| **智谱AI** | 中文理解优秀 | 中文金融分析 |
| **月之暗面Kimi** | 长文本处理 | 深度研究报告 |
| **DeepSeek** | 代码和逻辑能力强 | 量化分析 |
| **LMStudio** | 隐私安全 | 本地部署 |

### 3. 推荐问题示例
- "这只股票的技术指标如何？"
- "请分析一下最近的市场走势"
- "给我一些投资建议"
- "这个价位适合入场吗？"
- "风险评估和止损建议"

---

## 🔧 故障排除

### 1. AI调用失败
- **检查API密钥**: 确认密钥正确且有效
- **检查网络**: 确认能访问对应的API地址
- **检查余额**: 确认API账户有足够余额
- **查看日志**: 后端控制台会显示详细错误信息

### 2. 模型切换失败
- **检查provider名称**: 确保使用正确的provider名称
- **检查配置**: 确认对应模型的API密钥已配置
- **重启服务**: 修改配置后可能需要等待自动重启

### 3. 降级到本地分析
- 这是正常的降级机制
- 当AI服务不可用时会自动使用本地规则引擎
- 确保有股票数据加载后再提问

---

## 📈 性能优化建议

### 1. 模型选择策略
- **快速查询**: 使用智谱AI或DeepSeek
- **深度分析**: 使用月之暗面Kimi
- **隐私需求**: 使用LMStudio本地模型
- **综合平衡**: 使用OpenAI GPT

### 2. 参数调优
```bash
# 调整响应长度
ZHIPU_MAX_TOKENS=1500

# 调整创造性
ZHIPU_TEMPERATURE=0.5  # 更保守
ZHIPU_TEMPERATURE=0.8  # 更创新
```

---

## 🔐 安全注意事项

1. **API密钥安全**: 不要将密钥提交到代码仓库
2. **访问限制**: 生产环境建议设置IP白名单
3. **数据隐私**: 敏感数据建议使用本地模型
4. **成本控制**: 监控API调用量和费用

---

## 🎯 快速开始

### 立即体验智谱AI

1. **获取API密钥**: 访问 [智谱AI开放平台](https://open.bigmodel.cn/)
2. **配置密钥**:
   ```bash
   # 编辑 backend/.env
   ZHIPU_API_KEY=你的智谱AI密钥
   ```
3. **切换模型**:
   ```bash
   # PowerShell
   $body = @{ provider = "zhipu" } | ConvertTo-Json
   Invoke-RestMethod -Uri "http://localhost:3002/api/chat/switch" -Method POST -Body $body -ContentType "application/json"
   ```
4. **开始对话**: 在右侧聊天面板提问！

---

**🎉 恭喜！您现在拥有了一个强大的多模型AI股票分析平台！**

需要任何帮助或有问题，随时告诉我！ 📞🤖