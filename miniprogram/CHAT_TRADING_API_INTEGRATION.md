# AI聊天交易功能API对接完成说明

## 概述
小程序AI聊天页面已成功对接 ly.ddg.org.cn 服务器的OKX交易API，实现完整的交易功能。

## 对接的API端点

### 1. 执行交易（买入/卖出/做多/做空）
- **端点**: `POST /api/trading/trade`
- **参数格式**:
  ```javascript
  {
    userId: "用户ID",
    symbol: "ETH-USDT-SWAP",
    side: "long" | "short",  // long=做多, short=做空
    size: "10"  // 仓位百分比
  }
  ```
- **调用位置**: `/miniprogram/pages/chat/chat.js:509-544`

### 2. 平仓
- **端点**: `POST /api/trading/positions/close`
- **参数格式**:
  ```javascript
  {
    userId: "用户ID",
    positionId: "ETH-USDT-SWAP-long"  // 格式: "symbol-side"
  }
  ```
- **调用位置**: `/miniprogram/pages/chat/chat.js:549-610`

### 3. 查询余额
- **端点**: `GET /api/trading/account/balance`
- **支持参数**:
  - `{ accountId: "账号ID" }` - 查询指定账号
  - `{ userId: "用户ID" }` - 查询用户默认账号
- **调用位置**: `/miniprogram/pages/chat/chat.js:290-321`

### 4. 查询持仓
- **端点**: `GET /api/trading/positions`
- **支持参数**:
  - `{ accountId: "账号ID" }` - 查询指定账号
  - `{ userId: "用户ID" }` - 查询用户默认账号
- **调用位置**: `/miniprogram/pages/chat/chat.js:326-348`

### 5. 市场分析
- **端点**: `GET /api/ai/analysis/latest`
- **参数格式**:
  ```javascript
  {
    symbol: "ETH-USDT-SWAP",
    limit: 1,
    force: "true" | "false",
    userId: "用户ID"
  }
  ```
- **调用位置**: `/miniprogram/pages/chat/chat.js:353-395`

## 用户界面

### 快捷交易按钮（空状态页面）
用户可以在聊天页面空状态时看到三个重要操作按钮：

1. **买入做多**（绿色）
   - 命令: "市价买入做多ETH 10% 10倍杠杆"
   - 参数: `{ symbol: "ETH-USDT-SWAP", side: "long", size: "10" }`

2. **买入做空**（红色）
   - 命令: "市价买入做空ETH 10% 10倍杠杆"
   - 参数: `{ symbol: "ETH-USDT-SWAP", side: "short", size: "10" }`

3. **全部平仓**（橙色）
   - 命令: "全部平仓"
   - 逻辑: 先查询所有持仓，然后逐个平仓

### 快捷卡片
- 查询余额
- 持仓信息
- 行情分析
- 快速交易

## AI助手识别的命令

用户可以直接在聊天输入框输入以下命令，AI助手会自动识别并执行：

| 命令示例 | 操作类型 | 参数 |
|---------|---------|------|
| "查询余额" | query_balance | - |
| "持仓" / "我持有什么" | query_positions | - |
| "分析ETH" | analyze | symbol: "ETH-USDT-SWAP" |
| "市价买入做多ETH 10% 10倍杠杆" | buy | { symbol, side: "long", size: "10" } |
| "市价买入做空ETH 10% 10倍杠杆" | sell | { symbol, side: "short", size: "10" } |
| "全部平仓" | close_position | - |

## 数据流向

```
用户输入/点击按钮
    ↓
AI理解意图（zhipuService）
    ↓
parseAIResponse() 解析JSON响应
    ↓
执行对应操作:
  - executeTrade() → POST /trading/trade
  - closeAllPositions() → POST /trading/positions/close
  - queryBalance() → GET /trading/account/balance
  - queryPositions() → GET /trading/positions
  - analyzeMarket() → GET /ai/analysis/latest
    ↓
显示执行结果卡片
```

## 关键技术细节

### 1. 用户ID获取
```javascript
function getCurrentUserId() {
  const userInfo = wx.getStorageSync('userInfo');
  return (userInfo && userInfo.id) ? userInfo.id : 'default';
}
```

### 2. 账号ID获取
```javascript
function getCurrentAccountId() {
  const account = wx.getStorageSync('currentAccount');
  return account && account.id ? account.id : null;
}
```

### 3. 平仓时的positionId格式
```javascript
const positionId = `${pos.symbol}-${pos.side}`;
// 示例: "ETH-USDT-SWAP-long"
```

## 安全特性

1. **Token认证**: 所有API请求自动携带Bearer Token
2. **401处理**: Token过期时自动跳转登录页
3. **错误处理**: 完善的try-catch和用户友好的错误提示
4. **账号验证**: 优先使用当前选中的账号ID，无选中时使用用户ID

## 系统提示词（System Prompt）

AI助手使用以下提示词来理解用户意图：

```
你是OKly交易助手，可以帮用户执行以下操作：

【可执行的操作】
1. 查询账户余额
2. 查询持仓
3. 分析行情
4. 买入/做多
5. 卖出/做空
6. 平仓

【响应格式】
必须返回纯JSON: {"action": "操作类型", "params": {参数}, "message": "回复", "result": "结果说明"}

action可选值:
- query_balance: 查询余额
- query_positions: 查询持仓
- analyze: 分析行情
- buy: 买入/做多
- sell: 卖出/做空
- close_position: 平仓
- chat: 普通对话
```

## 完成状态

✅ 执行交易功能（买入做多/做空）
✅ 平仓功能（单个/全部）
✅ 查询余额功能
✅ 查询持仓功能
✅ 市场分析功能
✅ AI意图识别
✅ UI交互按钮
✅ 错误处理和用户提示
✅ Token认证和自动登录

## 测试建议

1. 测试买入做多功能
2. 测试买入做空功能
3. 测试全部平仓功能
4. 测试查询余额和持仓
5. 测试AI对话识别
6. 测试Token过期处理
7. 测试网络错误处理

## 后续优化建议

1. 添加交易确认弹窗（防止误操作）
2. 添加仓位大小自定义输入
3. 添加杠杆倍数自定义输入
4. 添加交易历史记录查看
5. 添加实时盈亏显示
6. 添加价格预警功能
7. 优化AI识别准确率
