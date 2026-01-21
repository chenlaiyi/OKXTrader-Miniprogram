# 小程序自动交易修复 - 部署指南

## 修复概述

**问题**：小程序端的自动交易开关调用的是本地引擎（使用 `setInterval`），当小程序进入后台时，JavaScript 执行被暂停，导致自动交易停止。

**解决方案**：修改小程序端代码，让自动交易开关调用服务器端 API，而不是本地引擎。服务器端使用 `cron.schedule`，可以24/7持续运行。

---

## 已修改的文件

### 1. `/miniprogram/pages/monitor/monitor.js`

**修改前**（使用本地引擎）：
```javascript
async toggleAutoTrading() {
  const { autoTradingEnabled } = this.data
  if (autoTradingEnabled) {
    autoTradingEngine.stop()  // ❌ 本地引擎
  } else {
    autoTradingEngine.start()  // ❌ 本地引擎
  }
}
```

**修改后**（调用服务器API）：
```javascript
async toggleAutoTrading(e) {
  const newValue = e.detail.value
  const userInfo = wx.getStorageSync('userInfo')

  // ✅ 调用服务器API
  const res = await API.toggleAutoTrading({
    userId: userInfo.id,
    enabled: newValue
  })

  if (res.success) {
    this.setData({ autoTradingEnabled: newValue })
    wx.showToast({
      title: newValue ? '✅ 自动交易已启动' : '⏸️ 自动交易已停止',
      icon: 'success'
    })
  }
}
```

**关键变化**：
- ✅ 移除了对本地 `autoTradingEngine` 的依赖
- ✅ 改为调用 `API.toggleAutoTrading()`
- ✅ 服务器端引擎使用 cron，可以24/7运行
- ✅ 小程序后台时，自动交易继续执行

---

## 部署步骤

### 步骤1：在微信开发者工具中测试

1. **打开项目**
   ```bash
   # 在微信开发者工具中打开项目目录
   /Users/chanlaiyi/Oyi/OKly-program/miniprogram
   ```

2. **验证代码编译**
   - 打开 `pages/monitor/monitor.js`
   - 确认没有语法错误
   - 检查控制台是否有错误

3. **测试自动交易开关**
   - 运行小程序
   - 进入"交易监控"页面
   - 点击自动交易开关
   - 查看控制台日志：
     ```
     🎛️ 切换自动交易: false → true
     ✅ 自动交易启动成功
     ```

4. **查看服务器日志**
   ```bash
   ssh root@ly.ddg.org.cn
   pm2 logs okxtrader --lines 50
   ```

   应该看到：
   ```
   🚀 [API/TOGGLE] 准备启动自动交易...
   ✅ [自动交易] 引擎启动成功
   🔄 [自动交易] 开始分析...
   ```

### 步骤2：上传代码到微信

1. **在微信开发者工具中**
   - 点击"上传"按钮
   - 填写版本号：`v0.0.154-auto-trading-fix`
   - 填写备注：`修复自动交易调用服务器API`

2. **登录微信公众平台**
   - 访问：https://mp.weixin.qq.com/
   - 进入"版本管理"

3. **提交审核**
   - 将开发版本提交审核
   - 备注：`紧急修复：自动交易功能`

### 步骤3：验证修复效果

1. **启动自动交易**
   - 在小程序中进入"交易监控"
   - 打开自动交易开关
   - 确认提示"✅ 自动交易已启动"

2. **后台运行测试**
   - 将小程序切换到后台
   - 等待2-3分钟
   - 重新打开小程序
   - 查看交易统计是否增加

3. **检查服务器日志**
   ```bash
   ssh root@ly.ddg.org.cn "pm2 logs okxtrader --lines 100 | grep '自动交易'"
   ```

   应该看到定时执行的日志：
   ```
   🔄 [自动交易] 开始分析...
   📊 [自动交易] 获取K线数据...
   🎯 [自动交易] 生成交易信号...
   ```

---

## 服务器端配置

### 确认服务器端已部署增强版代码

服务器端已经添加了详细的调试日志，位置：
- `/root/okxtrader-server/src/services/auto-trading.ts`
- `/root/okxtrader-server/src/routes/autotrading.ts`

### 检查服务器运行状态

```bash
# 1. SSH到服务器
ssh root@ly.ly.ddg.org.cn

# 2. 检查PM2进程状态
pm2 list
# 应该看到 okxtrader 进程状态为 online

# 3. 检查实时日志
pm2 logs okxtrader --lines 100

# 4. 如果需要重启
pm2 restart okxtrader
```

---

## API 端点

### 自动交易相关

**获取状态**
```
GET /api/autotrading/status?userId=USER_ID
```

**切换开关**
```
POST /api/autotrading/toggle
{
  "userId": "USER_ID",
  "enabled": true/false
}
```

---

## 测试用例

### 用例1：启动自动交易

**操作**：
1. 打开小程序
2. 进入"交易监控"页面
3. 打开自动交易开关

**预期结果**：
- ✅ 显示"✅ 自动交易已启动"
- ✅ 开关状态变为"开启"
- ✅ 服务器日志显示引擎启动成功

**验证命令**：
```bash
ssh root@ly.ly.ddg.org.cn "pm2 logs okxtrader --lines 20 | grep '自动交易'"
```

### 用例2：后台运行测试

**操作**：
1. 启动自动交易
2. 将小程序切换到后台（Home键）
3. 等待2分钟
4. 重新打开小程序

**预期结果**：
- ✅ 交易统计增加（总交易数 > 0）
- ✅ 服务器日志显示定时任务执行
- ✅ 持仓数量可能增加（如果有交易信号）

### 用例3：停止自动交易

**操作**：
1. 在"交易监控"页面
2. 关闭自动交易开关

**预期结果**：
- ✅ 显示"⏸️ 自动交易已停止"
- ✅ 开关状态变为"关闭"
- ✅ 服务器日志显示引擎停止

---

## 故障排查

### 问题1：开关打开后立即恢复

**原因**：API 请求失败

**解决方案**：
1. 检查网络连接
2. 查看服务器日志：
   ```bash
   pm2 logs okxtrader --lines 50
   ```
3. 检查API端点是否可访问：
   ```bash
   curl -X POST https://ly.ddg.org.cn/api/autotrading/toggle \
     -H "Content-Type: application/json" \
     -d '{"userId":"TEST","enabled":true}'
   ```

### 问题2：启动成功但无交易

**原因**：
- 策略条件过于严格
- 当前市场无符合条件的信号
- 账号类型为模拟盘（不支持自动交易）

**解决方案**：
1. 查看服务器日志中的信号生成记录
2. 简化策略条件
3. 确认使用实盘账号

### 问题3：小程序崩溃

**原因**：代码语法错误

**解决方案**：
1. 在微信开发者工具中检查控制台
2. 修复语法错误
3. 重新上传代码

---

## 相关文档

- [服务器端自动交易引擎](../okxtrader-server/src/services/auto-trading.ts)
- [API接口文档](../okxtrader-server/README.md)
- [策略配置说明](../okxtrader-server/STRATEGY_CONFIG.md)

---

## 更新日志

**v0.0.154** (2026-01-18)
- ✅ 修复自动交易调用本地引擎的问题
- ✅ 改为调用服务器端API
- ✅ 实现真正的24/7自动交易
- ✅ 添加详细的调试日志
- ✅ 改进错误处理和用户提示

---

**修复人员**：Claude Code
**测试状态**：待测试
**部署状态**：待部署
