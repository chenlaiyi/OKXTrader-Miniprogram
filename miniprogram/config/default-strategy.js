/**
 * 纯SAR趋势跟踪系统 - 默认策略配置
 * 基于: SAR.md
 *
 * 核心逻辑:
 * 1. 日线SAR判断大趋势方向 (可开关)
 * 2. 15分钟SAR反转白点触发入场
 * 3. 所有判断基于已完成K线,避免信号闪烁
 */

const DEFAULT_STRATEGY = {
  // 策略名称和描述
  name: 'SAR标准策略',
  description: '日线SAR方向(可开关)，15分钟SAR反转白点触发',
  version: '1.0',

  // ==================== 基础设置 ====================
  symbol: 'ETH-USDT-SWAP',  // 默认交易对
  strategyType: 'sar',
  tradingMode: 'pure',  // 纯策略模式,不依赖AI
  tradeDirection: 'both',  // 多空双向

  // 时间周期配置
  directionTimeframe: 'daily',  // 日线判断大趋势
  entryTimeframe: '15m',  // 15分钟确认入场
  analysisInterval: 30,  // 每30秒分析一次
  cooldownSeconds: 60,  // 交易冷却时间

  // ==================== 买入条件 ====================
  // 逻辑类型: or (任一触发)
  buyLogic: 'or',
  buyConditions: [
    {
      id: 'daily_sar_long',
      name: '日线SAR方向',
      desc: '日线SAR定方向(可开关)',
      indicator: 'sar',
      timeframe: '1D',
      operator: 'direction',
      enabled: true,
      required: true
    },
    {
      id: 'sar_15m_reversal',
      name: '15分钟SAR反转',
      desc: 'SAR反转白点信号(回看一根K线)',
      indicator: 'sar',
      timeframe: '15m',
      operator: 'reversal',
      enabled: true
    }
  ],
  minConfidence: 70,  // 最低置信度要求

  // ==================== 卖出条件 ====================
  // 逻辑类型: or (任一条件满足即可)
  sellLogic: 'or',
  sellConditions: [
    {
      id: 'sar_15m_reversal',
      name: '15分钟SAR反转',
      desc: 'SAR反转白点信号',
      indicator: 'sar',
      timeframe: '15m',
      operator: 'reversal',
      enabled: true
    }
  ],

  // 止盈止损配置
  stopLoss: {
    enabled: true,
    percent: 0.5,  // 0.5%止损(文档中建议)
    type: 'percentage'
  },
  takeProfit: {
    enabled: true,
    percent: 1.0,  // 1.0%止盈(文档中建议)
    type: 'percentage'
  },

  // ==================== 做多条件详细说明 ====================
  longConditions: {
    primary: [
      '日线SAR方向为多头(可开关)',
      '15分钟SAR反转到多头'
    ],
    secondary: [],
    note: '纯SAR策略，反转触发'
  },

  // ==================== 做空条件详细说明 ====================
  shortConditions: {
    primary: [
      '日线SAR方向为空头(可开关)',
      '15分钟SAR反转到空头'
    ],
    secondary: [],
    note: '纯SAR策略，反转触发'
  },

  // ==================== 出场条件 ====================
  exitConditions: {
    longExit: [
      '15分钟SAR反转空头'
    ],
    shortExit: [
      '15分钟SAR反转多头'
    ]
  },

  // ==================== 资金管理 ====================
  fundManagement: {
    mode: 'fixed',  // 固定金额模式
    fixedAmount: 50,  // 每单50 USDT
    balancePercent: 10,  // 账户余额10%模式
    leverage: 3,  // 3倍杠杆
    marginMode: 'cross'  // 全仓模式
  },

  // ==================== 风险控制 ====================
  riskControl: {
    maxPositions: 3,  // 最大持仓数
    cooldownSeconds: 60,  // 交易冷却时间
    maxDailyLossPercent: 15,  // 每日最大亏损15%停止交易
    maxDrawdownPercent: 20,  // 最大回撤20%减半仓位

    // 连续亏损保护
    maxConsecutiveLosses: 5,  // 连续5次亏损停止
    consecutiveLosses: 0,  // 当前连续亏损次数
    lastTradeTime: null  // 上次交易时间
  },

  // ==================== SAR参数 ====================
  sarParams: {
    afStep: 0.02,  // 加速因子步长
    afMax: 0.2     // 加速因子最大值
  },

  // ==================== 策略说明 ====================
  instructions: {
    title: 'SAR标准策略',
    summary: '日线SAR方向(可开关)，15分钟SAR反转白点触发',

    keyPoints: [
      '✅ 日线方向: 可开关的日线SAR方向过滤',
      '✅ 反转触发: 15分钟SAR反转白点触发',
      '✅ 避免闪烁: 所有判断基于已完成K线(前一根K线)',
      '✅ 快速止损: 0.5%硬止损,1.0%止盈',
      '✅ 3倍杠杆: 使用3倍杠杆提高资金利用率'
    ],

    longEntry: [
      '1. 日线SAR方向为多头 (可开关)',
      '2. 15分钟SAR反转到多头'
    ],

    shortEntry: [
      '1. 日线SAR方向为空头 (可开关)',
      '2. 15分钟SAR反转到空头'
    ],

    longExit: [
      '15分钟SAR转向空头'
    ],

    shortExit: [
      '15分钟SAR转向多头'
    ]
  },

  // ==================== 性能统计 ====================
  performance: {
    totalTrades: 0,
    winTrades: 0,
    lossTrades: 0,
    winRate: 0,
    totalPnl: 0,
    maxDrawdown: 0,
    sharpeRatio: 0
  },

  // ==================== 状态 ====================
  isEnabled: false,  // 默认不启用,需要用户手动启用
  isDefault: true,   // 标记为默认策略
  createdAt: null,
  updatedAt: null
}

module.exports = DEFAULT_STRATEGY
