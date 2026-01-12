# 📢 仓库迁移通知

> **本仓库已迁移到统一的 OKly 全平台智能交易系统**
>
> **新仓库地址**: [https://github.com/chenlaiyi/OKly](https://github.com/chenlaiyi/OKly)
>
> OKly 是一个功能完整的加密货币自动交易系统，集成了 **macOS**、**Web** 和 **微信小程序** 三大平台。
>
> **为什么要迁移？**
> - 🎯 统一管理所有平台代码
> - 📦 使用 git submodules 实现模块化
> - 🚀 更好的项目结构和文档
> - 🔄 便于多端协同开发
>
> **如何访问小程序端代码？**
> ```bash
> # 克隆新的统一仓库（包含所有平台）
> git clone --recurse-submodules https://github.com/chenlaiyi/OKly.git
> cd OKly/miniprogram
> ```
>
> **本仓库将仅作为历史存档保留，后续开发将在 OKly 仓库进行。**

---

# OKXTrader 小程序端开发方案

## 📋 项目概述

OKXTrader小程序端，功能与macOS端完全一致，提供完整的加密货币交易功能。

## 🏗️ 技术架构

### 技术栈
- **框架**: 微信小程序原生开发
- **语言**: TypeScript
- **样式**: WXSS / Less
- **API**: REST + WebSocket

### 目录结构
```
miniprogram/
├── pages/                  # 页面
│   ├── index/             # 首页
│   ├── trading/           # 交易页面（K线+下单）
│   ├── market/            # 行情列表
│   ├── ai/                # AI分析
│   ├── strategy/          # 策略列表
│   ├── strategy-edit/     # 策略编辑
│   ├── account/           # 账号管理
│   ├── chat/              # AI聊天
│   └── history/           # 交易历史
├── components/            # 组件
│   └── navigation-bar/    # 导航栏组件
├── services/              # 服务层
│   └── api.ts            # API服务
├── models/                # 数据模型
│   └── index.ts          # 类型定义
├── utils/                 # 工具函数
│   ├── config.ts         # 配置
│   └── util.ts           # 工具函数
├── app.ts                 # 应用入口
├── app.json              # 应用配置
└── app.less              # 全局样式
```

## 📱 功能模块

### 1. 首页 (index)
**功能**:
- 热门行情展示（横向滚动卡片）
- AI分析建议预览
- 当前持仓列表
- 自动交易开关
- 快速操作入口

**核心代码**:
```typescript
// pages/index/index.ts
import { apiService } from '../../services/api'
import { formatPrice, formatPercent, calculateChange, getPriceColor } from '../../utils/util'

Page({
  data: {
    markets: [],
    aiAnalysis: null,
    positions: [],
    autoTradingEnabled: false
  },

  onLoad() {
    this.loadData()
  },

  async loadData() {
    try {
      // 并行加载数据
      const [markets, ai, positions, status] = await Promise.all([
        apiService.getMarkets(),
        apiService.getAIAnalysis(),
        apiService.getPositions(),
        apiService.getAutoTradingStatus()
      ])

      // 处理行情数据
      const processedMarkets = markets.map(item => ({
        ...item,
        price: formatPrice(item.last),
        change: formatPercent(calculateChange(item.last, item.open24h)),
        color: getPriceColor(item.last, item.open24h)
      }))

      this.setData({
        markets: processedMarkets,
        aiAnalysis: ai,
        positions: positions.slice(0, 3), // 只显示前3个
        autoTradingEnabled: status.enabled
      })
    } catch (error) {
      console.error('加载数据失败:', error)
    }
  },

  formatTime(timestamp: number) {
    // 格式化时间
    return new Date(timestamp * 1000).toLocaleString('zh-CN')
  },

  async toggleAutoTrading(e: any) {
    const enabled = e.detail.value
    try {
      await apiService.toggleAutoTrading(enabled)
      this.setData({ autoTradingEnabled: enabled })
      wx.showToast({
        title: enabled ? '已启用自动交易' : '已禁用自动交易',
        icon: 'success'
      })
    } catch (error) {
      wx.showToast({ title: '操作失败', icon: 'error' })
    }
  },

  goToTrading() {
    wx.switchTab({ url: '/pages/trading/trading' })
  },

  goToMarket() {
    wx.switchTab({ url: '/pages/market/market' })
  },

  goToAI() {
    wx.switchTab({ url: '/pages/ai/ai' })
  },

  goToStrategy() {
    wx.navigateTo({ url: '/pages/strategy/strategy' })
  },

  goToChat() {
    wx.navigateTo({ url: '/pages/chat/chat' })
  }
})
```

### 2. 交易页面 (trading)
**功能**:
- K线图显示（使用echarts-for-weixin）
- 实时价格更新
- 买入/卖出按钮
- 当前持仓显示
- 止盈止损设置

**核心功能**:
```typescript
// pages/trading/trading.ts
Page({
  data: {
    currentSymbol: 'ETH-USDT-SWAP',
    candles: [],
    currentPrice: 0,
    positions: []
  },

  onLoad() {
    this.initChart()
    this.startPriceUpdate()
  },

  async initChart() {
    const candles = await apiService.getCandles(this.data.currentSymbol)
    this.setData({ candles })
    this.renderChart(candles)
  },

  renderChart(candles: any[]) {
    // 使用echarts-for-weixin渲染K线图
    const option = {
      series: [{
        type: 'candlestick',
        data: candles.map(item => [
          item.time,
          item.open,
          item.close,
          item.low,
          item.high
        ])
      }]
    }
    this.chart?.setOption(option)
  },

  async executeTrade(e: any) {
    const { side } = e.currentTarget.dataset
    try {
      await apiService.executeTrade(this.data.currentSymbol, side, 1)
      wx.showToast({ title: '下单成功', icon: 'success' })
    } catch (error) {
      wx.showToast({ title: '下单失败', icon: 'error' })
    }
  }
})
```

### 3. 行情页面 (market)
**功能**:
- 完整行情列表
- 涨跌幅排序
- 点击查看详情
- 下拉刷新

### 4. AI分析页面 (ai)
**功能**:
- AI分析历史记录
- 详细分析内容
- 信号建议
- 置信度显示

### 5. 策略配置页面 (strategy)
**功能**:
- 策略列表
- 创建新策略
- 编辑策略
- 删除策略
- 启用/禁用策略

### 6. 策略编辑页面 (strategy-edit)
**功能**:
- 基本信息设置
- 买卖条件配置
- 资金管理设置
- 风险控制设置

### 7. 账号管理页面 (account)
**功能**:
- 账号列表
- 添加新账号
- 编辑账号
- 删除账号
- 设置默认账号

### 8. AI聊天页面 (chat)
**功能**:
- 聊天界面
- 发送消息
- 历史记录
- 实时回复

### 9. 交易历史页面 (history)
**功能**:
- 交易记录列表
- 盈亏统计
- 筛选功能
- 导出功能

## 🔌 API集成

所有页面通过 `apiService` 与后端通信：

```typescript
import { apiService } from '../../services/api'

// 获取行情
const markets = await apiService.getMarkets()

// 执行交易
await apiService.executeTrade('ETH-USDT-SWAP', 'long', 1)

// 创建策略
await apiService.createStrategy(strategyConfig)
```

## 📊 数据流

```
用户操作
  ↓
页面事件处理
  ↓
调用API Service
  ↓
后端API (https://ly.ddg.org.cn/api)
  ↓
返回数据
  ↓
更新页面状态
  ↓
UI刷新
```

## 🎨 UI设计

### 颜色方案
- 背景: #1a1a1a
- 主色: #667eea
- 涨: #00c853
- 跌: #ff5252
- 文字: #e0e0e0
- 副文字: #9e9e9e

### 组件规范
- 卡片圆角: 12rpx
- 间距: 24rpx
- 字体大小: 28rpx (正文), 32rpx (标题)

## 🚀 开发步骤

1. ✅ 配置app.json和路由
2. ✅ 创建API服务层
3. ✅ 创建数据模型
4. ✅ 创建工具函数
5. ⏳ 开发首页
6. ⏳ 开发交易页面
7. ⏳ 开发行情页面
8. ⏳ 开发AI分析页面
9. ⏳ 开发策略配置页面
10. ⏳ 开发账号管理页面
11. ⏳ 开发AI聊天页面
12. ⏳ 开发交易历史页面
13. ⏳ 集成测试
14. ⏳ 性能优化

## 📦 第三方库

### echarts-for-weixin (K线图)
```bash
npm install echarts-for-weixin
```

### 使用方式
```json
{
  "usingComponents": {
    "ec-canvas": "../../components/ec-canvas/ec-canvas"
  }
}
```

## 🔄 状态管理

使用小程序原生状态管理：
- 页面数据: `this.data`
- 更新数据: `this.setData()`
- 跨页面通信: EventChannel 或 wx.setStorageSync

## 🔐 安全考虑

1. API密钥加密存储
2. 使用HTTPS通信
3. 敏感信息不记录日志
4. 定期清理缓存

## 📈 性能优化

1. 图片懒加载
2. 数据分页加载
3. 防抖/节流处理
4. 长列表虚拟滚动
5. 缓存策略

## 🧪 测试计划

1. 单元测试: 工具函数
2. 集成测试: API调用
3. UI测试: 页面交互
4. 性能测试: 加载速度

## 📝 开发注意事项

1. **小程序限制**:
   - 包大小限制: 2MB
   - 并发请求限制: 10个
   - WebSocket连接限制: 1个

2. **兼容性**:
   - 最低基础库版本: 2.0.0
   - iOS >= 9.0
   - Android >= 5.0

3. **最佳实践**:
   - 使用TypeScript增强类型安全
   - 合理使用缓存
   - 错误处理和用户提示
   - 避免频繁setData

## 🎯 与macOS端功能对比

| 功能 | macOS | 小程序 | 状态 |
|------|-------|--------|------|
| 实时行情 | ✅ | ✅ | 待开发 |
| K线图 | ✅ | ✅ | 待开发 |
| 交易下单 | ✅ | ✅ | 待开发 |
| AI分析 | ✅ | ✅ | 待开发 |
| 策略配置 | ✅ | ✅ | 待开发 |
| 账号管理 | ✅ | ✅ | 待开发 |
| AI聊天 | ✅ | ✅ | 待开发 |
| 交易历史 | ✅ | ✅ | 待开发 |
| 自动交易 | ✅ | ✅ | 待开发 |

## 📞 联系方式

如有问题，请查看：
- 微信小程序官方文档: https://developers.weixin.qq.com/miniprogram/dev/framework/
- ECharts文档: https://echarts.apache.org/zh/index.html

---

**当前进度**: 基础框架已搭建完成，API服务层已就绪，开始开发各个页面。
