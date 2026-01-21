# 策略配置保存问题 - 快速测试指南

## 🧪 测试方法

### 方法1: 使用专用测试页面（最简单）

我已经创建了一个专门的测试页面，可以快速验证保存功能。

#### 访问测试页面
在微信开发者工具的 Console 中执行：
```javascript
wx.navigateTo({
  url: '/pages/strategy-config-test/strategy-config-test'
})
```

或者在任意页面添加一个按钮：
```xml
<button bindtap="goToTestPage">测试配置保存</button>
```

```javascript
goToTestPage() {
  wx.navigateTo({
    url: '/pages/strategy-config-test/strategy-config-test'
  })
}
```

#### 测试步骤
1. **进入测试页面** → 会自动加载当前配置
2. **查看日志** → 显示当前 `tradingMode` 值
3. **点击"⚡ 纯策略模式"** → 切换到 pure
4. **点击"💾 保存配置"** → 保存到数据库
5. **点击"✅ 验证配置"** → 从数据库重新加载验证

#### 预期结果
```
[时间] 🚀 测试页面加载
[时间] 📥 开始加载配置...
[时间] ✅ 加载成功，tradingMode = "ai"
[时间] 🔄 切换到纯策略模式
[时间] 💾 开始保存配置，tradingMode = "pure"
[时间] 📤 发送保存请求...
[时间] ✅ 保存成功！
[时间] ✅ 开始验证配置...
[时间] 📊 数据库中的值: "pure"
[时间] 📊 当前页面的值: "pure"
[时间] ✅✅✅ 验证通过！配置已正确保存 ✅✅✅
```

---

### 方法2: 在 Console 中运行测试脚本

#### 1. 加载测试脚本
在微信开发者工具 Console 中执行：
```javascript
require('../../pages/strategy-edit/test-save.js')
```

#### 2. 运行完整测试
```javascript
wx.testStrategyConfigSave.runFullTest()
```

#### 3. 单独测试
```javascript
// 测试API连接
wx.testStrategyConfigSave.testAPIConnection()

// 测试保存
wx.testStrategyConfigSave.testSaveConfig()

// 验证保存
wx.testStrategyConfigSave.testVerifySave()
```

---

### 方法3: 直接测试原始策略编辑页面

#### 步骤
1. **清除缓存**
   - 微信开发者工具 → 清除缓存 → 清除数据缓存
   - 清除文件缓存

2. **重新编译**
   - 点击"编译"按钮

3. **进入策略编辑**
   - 点击"策略编辑"菜单
   - 切换到"基础设置"标签

4. **查看 Console 日志**
   应该看到：
   ```
   🚀 策略编辑页面加载，参数: {}
   📝 进入默认配置模式
   📥 开始加载策略配置...
   📊 tradingMode: pure  // ✅ 从数据库加载
   ✅ setData 后的 tradingMode: pure
   ```

5. **验证UI显示**
   - 交易模式应该显示数据库中的值
   - 如果数据库是 `"pure"`，应该显示 **⚡ 纯策略模式**

6. **修改并保存**
   - 点击选择器，切换到 **🤖 AI辅助模式**
   - 点击右上角 **保存策略**
   - 查看 Console 日志

7. **验证保存**
   - 返回上一页
   - 重新进入"策略编辑"
   - 应该显示 **🤖 AI辅助模式**

---

## 🔍 诊断步骤

### 如果测试页面可以保存，但原始页面不行

说明问题在原始页面的代码逻辑，可能是：
- `onLoad` 时序问题
- `setData` 调用时机问题
- 页面数据初始化问题

**解决方案**：已修复，将 `onLoad` 改为 `async` 函数

### 如果测试页面也不能保存

说明问题在API调用或后端，可能是：
- 网络请求被拦截
- 后端验证失败
- 数据库写入失败

**解决方案**：查看后端日志和 Network 面板

---

## 📊 检查清单

### 前端检查
- [ ] Console 显示正确的 `tradingMode` 值
- [ ] 点击保存后显示 "保存成功"
- [ ] Network 面板显示 POST 请求
- [ ] Request Payload 包含正确的 `config.basicConfig.tradingMode`
- [ ] Response 显示 `{ "success": true }`

### 后端检查
```bash
ssh root@149.88.88.171 'pm2 logs okxtrader-api --lines 50'
```

- [ ] 显示 "📥 收到策略配置保存请求"
- [ ] 显示 "📊 basicConfig.tradingMode: xxx"
- [ ] 显示 "✅ 配置已更新"
- [ ] 没有 "❌" 错误信息

### 数据库检查
```bash
curl -s 'https://ly.ddg.org.cn/api/strategy/config?userId=default' | jq '.data.basicConfig.tradingMode'
```

- [ ] 返回保存的值（`"ai"` 或 `"pure"`）

---

## 🐛 常见问题

### 问题1: 页面显示的值和数据库不一致

**原因**: 页面加载时序问题，显示的是默认值

**检查**: 查看 Console 日志中的 `📊 tradingMode` 值

**解决**: 已修复，`onLoad` 改为 `async` 函数

### 问题2: 保存成功但重新进入还是旧值

**原因**: `onShow` 重新加载了旧数据

**检查**: 查看 Console 中是否有 `🔄 页面显示，重新加载配置`

**解决**: 已修复，添加 `saving` 状态检查

### 问题3: Network 面板没有请求

**原因**: API调用失败或被拦截

**检查**: Console 中是否有错误信息

**解决**: 检查网络和服务器状态

---

## 📝 测试报告模板

请按以下格式提供测试结果：

```
## 测试环境
- 微信开发者工具版本: xxx
- 操作系统: xxx
- 测试时间: xxx

## 测试结果

### 测试页面测试
- [ ] 能否加载配置: 是/否
- [ ] 能否保存配置: 是/否
- [ ] 能否验证配置: 是/否
- [ ] Console日志: [粘贴日志]

### 原始页面测试
- [ ] 加载时显示的值: ai/pure
- [ ] 修改后能否保存: 是/否
- [ ] 重新进入后的值: ai/pure
- [ ] Console日志: [粘贴日志]

### Network请求
- [ ] Request URL: xxx
- [ ] Request Payload: [粘贴]
- [ ] Response: [粘贴]
- [ ] Status Code: xxx

### 问题描述
[描述遇到的问题]
```

---

## 🎯 下一步

请按照上述方法测试，并告诉我：
1. 哪个测试方法有问题
2. 具体的错误日志
3. Network 请求数据

这样我就能精确定位问题并修复。

---

**测试页面**: `/pages/strategy-config-test/strategy-config-test`
**测试脚本**: `/pages/strategy-edit/test-save.js`
**文档**: `QUICK_TEST_GUIDE.md`
