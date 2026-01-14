# 智谱AI API配置指南

## ✅ 配置已完成！

### 已配置内容
- ✅ 小程序端：改为通过服务器代理调用
- ✅ 服务器端：添加 `/api/ai/chat` 接口
- ✅ 环境变量：已配置智谱AI API Key
- ✅ MySQL数据库：已配置连接信息

### .env文件位置
`/Users/chenlaiyi/Oyi/okxtrader-server/.env`

### 配置的API Key
```
ZHIPU_API_KEY=48e4e6c86b8e4142bc94e24f1afb7d09.QJlqSJsJZDwsEEVp
```

---

## 🚀 启动步骤

### 重启服务器
```bash
cd /Users/chenlaiyi/Oyi/okxtrader-server
npm start
# 或
pm2 restart okxtrader
```

### 测试小程序
1. 重新编译小程序
2. 打开AI聊天页面
3. 发送消息测试：**"查询余额"**

### 1. 小程序端
- **文件**: `/Users/chenlaiyi/Oyi/OKly-program/miniprogram/services/zhipu.js`
- **修改**: 改为通过服务器代理调用GLM API，不再直接暴露API Key
- **接口**: `POST https://ly.ddg.org.cn/api/ai/chat`

### 2. 服务器端
- **文件**: `/Users/chenlaiyi/Oyi/okxtrader-server/src/routes/ai.ts`
- **新增**: `/api/ai/chat` 接口，代理调用智谱AI
- **API Key来源**: 环境变量 `ZHIPU_API_KEY`

---

## 🔑 配置步骤

### 方案1: 通过环境变量配置（推荐）

在服务器上设置环境变量：

```bash
# 临时设置（当前会话有效）
export ZHIPU_API_KEY='你的API Key'

# 永久设置（添加到 ~/.bashrc 或 ~/.zshrc）
echo "export ZHIPU_API_KEY='你的API Key'" >> ~/.bashrc
source ~/.bashrc
```

### 方案2: 通过.env文件配置

1. 在服务器目录创建 `.env` 文件：
```bash
cd /Users/chenlaiyi/Oyi/okxtrader-server
cp .env.example .env
```

2. 编辑 `.env` 文件，添加你的API Key：
```env
ZHIPU_API_KEY=你的实际API_Key
```

3. 重启服务器应用

---

## 📋 获取API Key

1. 访问：https://open.bigmodel.cn/usercenter/apikeys
2. 登录智谱AI账号
3. 创建新的API Key
4. 复制API Key（格式：`id.secret`）

---

## 🧪 测试

配置完成后，测试小程序AI聊天功能：

1. 重新编译小程序
2. 打开AI聊天页面
3. 发送消息，例如："查询余额"
4. 查看是否正常响应

---

## 🔍 故障排查

### 问题1: "服务器未配置智谱AI API Key"
**原因**: 服务器环境变量未设置
**解决**: 按照上述步骤配置 `ZHIPU_API_KEY`

### 问题2: 401 Unauthorized
**原因**: API Key错误或已过期
**解决**: 检查API Key是否正确，重新生成

### 问题3: 小程序调用超时
**原因**: 服务器网络问题或API响应慢
**解决**: 检查服务器日志，确认智谱AI服务状态

---

## 📊 相关文件

- 小程序端: `/Users/chenlaiyi/Oyi/OKly-program/miniprogram/services/zhipu.js`
- 服务器路由: `/Users/chenlaiyi/Oyi/okxtrader-server/src/routes/ai.ts`
- 服务器服务: `/Users/chenlaiyi/Oyi/okxtrader-server/src/services/ai.ts`
- 环境变量示例: `/Users/chenlaiyi/Oyi/okxtrader-server/.env.example`
- 数据库配置: `/Users/chenlaiyi/Oyi/okxtrader-server/src/config/database.ts`

---

## ⚠️ 安全提示

- ❌ **不要**在小程序端硬编码API Key
- ✅ **应该**在服务器端通过环境变量配置
- ✅ **应该**定期轮换API Key
- ✅ **应该**监控API使用量和费用

---

## 🚀 下一步

配置完成后，您可以：
1. 使用AI聊天功能进行自然语言交易指令
2. 扩展更多AI功能，如智能分析、风险评估等
3. 集成其他AI模型（如DeepSeek）
