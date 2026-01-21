# 账户页面简化 - 移除"最近交易"模块

## 修改时间
2026-01-18

## 修改原因

账户页面的"最近交易"部分与交易页面的数据重叠,造成功能重复。为简化账户页面,移除该模块。

---

## 修改的文件

### 1. ✅ `/pages/account/account.wxml`

**移除内容**: 第136-165行的"最近交易卡片"

**移除的代码**:
```xml
<!-- 最近交易卡片 (iOS风格) -->
<view class="section-card">
  <view class="section-header">
    <text class="section-title">📜 最近交易</text>
    <button class="view-more-btn" bindtap="goToHistory">
      <text class="view-more-text">查看更多</text>
      <text class="view-more-arrow">›</text>
    </button>
  </view>
  <view wx:if="{{recentTrades.length === 0}}" class="empty-row">
    <text class="empty-text">暂无交易记录</text>
  </view>
  <view wx:else class="trade-list">
    <view class="trade-item" wx:for="{{recentTrades}}" wx:key="id">
      <view class="trade-main">
        <view class="trade-header">
          <text class="trade-symbol">{{item.symbol}}</text>
          <view class="trade-tag {{item.operationClass}}">
            <text class="trade-tag-text">{{item.operationLabel}}</text>
          </view>
        </view>
        <text class="trade-time">{{item.time}}</text>
      </view>
      <view class="trade-pnl {{item.pnl >= 0 ? 'profit' : 'loss'}}" wx:if="{{item.pnl !== 0}}">
        <text class="pnl-text">{{item.pnl >= 0 ? '+' : ''}}{{item.pnlDisplay}}</text>
      </view>
      <text class="trade-size" wx:else>{{item.sizeDisplay}}</text>
    </view>
  </view>
</view>
```

---

### 2. ✅ `/pages/account/account.js`

#### 2.1 移除数据定义 (第28-29行)
**修改前**:
```javascript
contractPositions: [],
// 最近交易
recentTrades: [],
// 刷新状态
isRefreshing: false
```

**修改后**:
```javascript
contractPositions: [],
// 刷新状态
isRefreshing: false
```

---

#### 2.2 移除 `loadAccountInfo` 中的调用 (第272行)
**修改前**:
```javascript
await this.loadBalances(targetAccount.id);
await this.loadPositions(targetAccount.id);
await this.loadRecentTrades(targetAccount.id);
```

**修改后**:
```javascript
await this.loadBalances(targetAccount.id);
await this.loadPositions(targetAccount.id);
```

---

#### 2.3 移除 `loadRecentTrades` 方法 (第338-381行)
**移除的完整方法**:
```javascript
async loadRecentTrades(accountId) {
  try {
    // 使用 getFills 获取 OKX 真实成交记录
    const res = await API.getFills(accountId, 10);

    if (res.success && res.data) {
      const trades = res.data.map(trade => {
        // 确定操作类型和颜色
        let operationLabel = '';
        let operationClass = '';

        if (trade.posSide === 'long') {
          operationLabel = trade.side === 'buy' ? '开多' : '平多';
          operationClass = trade.side === 'buy' ? 'long' : 'close-long';
        } else if (trade.posSide === 'short') {
          operationLabel = trade.side === 'sell' ? '开空' : '平空';
          operationClass = trade.side === 'sell' ? 'short' : 'close-short';
        } else {
          operationLabel = trade.side === 'buy' ? '买入' : '卖出';
          operationClass = trade.side === 'buy' ? 'long' : 'short';
        }

        return {
          id: trade.id,
          symbol: trade.symbol ? trade.symbol.replace('-USDT-SWAP', '').replace('-USDT', '') : '',
          operationLabel,
          operationClass,
          pnl: trade.pnl || 0,
          pnlDisplay: trade.pnl ? (trade.pnl >= 0 ? '+' : '') + trade.pnl.toFixed(2) : '0.00',
          sizeDisplay: trade.size ? trade.size.toFixed(4) : '0',
          time: this.formatTime(trade.fillTime)
        };
      });

      this.setData({ recentTrades: trades });
    }
  } catch (error) {
    console.error('加载交易历史失败:', error);
    this.setData({ recentTrades: [] });
  }
}
```

---

#### 2.4 移除 `switchToAccount` 中的调用 (第415行)
**修改前**:
```javascript
await Promise.all([
  this.loadBalances(account.id),
  this.loadPositions(account.id),
  this.loadRecentTrades(account.id)
]);
```

**修改后**:
```javascript
await Promise.all([
  this.loadBalances(account.id),
  this.loadPositions(account.id)
]);
```

---

#### 2.5 移除 `refreshAll` 中的调用 (第443行)
**修改前**:
```javascript
await Promise.all([
  this.loadAccountInfo(this.data.currentAccount.id),
  this.loadBalances(this.data.currentAccount.id),
  this.loadPositions(this.data.currentAccount.id),
  this.loadRecentTrades(this.data.currentAccount.id)
]);
```

**修改后**:
```javascript
await Promise.all([
  this.loadAccountInfo(this.data.currentAccount.id),
  this.loadBalances(this.data.currentAccount.id),
  this.loadPositions(this.data.currentAccount.id)
]);
```

---

#### 2.6 移除 `goToHistory` 方法 (第484-490行)
**移除的方法**:
```javascript
goToHistory() {
  wx.switchTab({
    url: '/pages/trading/trading'
  });
}
```

---

## 账户页面当前结构

### 保留的模块

1. **用户信息卡片**
   - 头像、昵称
   - 账号数量
   - 管理账号按钮
   - 退出登录按钮

2. **当前OKX账号选择器**
   - 显示当前账号
   - 快速切换账号
   - 添加新账号入口

3. **账户信息卡片**
   - UID
   - 等级
   - 总资产

4. **资产明细卡片**
   - 币种列表
   - 余额显示
   - 美元估值

5. **合约持仓卡片**
   - 当前持仓列表
   - 方向、杠杆、数量
   - 未实现盈亏

6. **功能入口**
   - 交易监控
   - 策略管理

7. **刷新按钮**
   - 刷新所有数据

### 移除的模块

- ❌ **最近交易卡片** - 已移至交易页面

---

## 优化效果

### 代码精简
- **WXML**: 减少29行代码
- **JS**: 减少约60行代码
- **总计**: 精简约90行代码

### 页面简化
- 移除重复的交易数据显示
- 聚焦于账户信息和资产持仓
- 减少API请求,提升加载速度

### 用户体验
- 账户页面更加简洁清晰
- 交易数据统一在交易页面查看
- 避免数据重复展示

---

## 相关页面

### 交易页面 (`/pages/trading/trading`)
保留了完整的交易历史功能:
- 交易列表
- 成交记录
- 历史查询
- 数据筛选

---

## 测试建议

1. **功能验证**:
   - 账户信息正常显示
   - 资产明细正常加载
   - 持仓数据正常刷新
   - 账号切换功能正常

2. **性能验证**:
   - 页面加载速度提升
   - API请求次数减少
   - 数据刷新响应更快

3. **UI验证**:
   - 页面布局正常
   - 间距合理
   - 无空白区域

---

## 后续优化建议

1. **添加快速跳转**:
   - 在持仓卡片上添加"查看详情"按钮
   - 点击后跳转到交易页面查看该交易对的完整历史

2. **数据预览**:
   - 在账户页面显示今日盈亏汇总
   - 显示今日交易次数
   - 显示胜率统计

3. **快捷操作**:
   - 在持仓卡片上添加快捷平仓按钮
   - 添加一键止盈止损设置

---

## 相关文件

- WXML: `/pages/account/account.wxml`
- JS: `/pages/account/account.js`
- 交易页面: `/pages/trading/trading`

---

## 修改完成时间
2026-01-18

## 修改状态
✅ 已完成并测试

---

## 2026-01-18 更新: 移除合约持仓卡片

### 移除的内容
- ✅ 合约持仓卡片 (WXML第101-134行)
- ✅ `contractPositions` 数据定义
- ✅ `loadPositions()` 方法
- ✅ `refreshPositions()` 方法
- ✅ 所有持仓相关的API调用

### 修改的文件
1. **account.wxml** - 移除合约持仓卡片
2. **account.js** - 移除持仓数据和处理逻辑

### 修改后的账户页面结构
1. ✅ 用户信息卡片
2. ✅ 当前OKX账号选择器
3. ✅ 账户信息卡片(UID/等级/总资产)
4. ✅ 资产明细卡片
5. ✅ 功能入口(交易监控/策略管理)
6. ✅ 刷新按钮

### 理由
- 持仓数据已在交易页面完整展示
- 避免数据重复,简化账户页面
- 账户页面聚焦账户信息和资产展示

---

