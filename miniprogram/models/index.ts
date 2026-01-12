// 数据模型定义

// 行情数据
export interface MarketData {
  inst_id: string
  last: string
  open24h: string
  volume: string
  high24h: string
  low24h: string
  change24h?: number
  changePercent?: number
}

// K线数据
export interface CandleData {
  time: number
  open: number
  high: number
  low: number
  close: number
  volume?: number
}

// 技术指标
export interface Indicators {
  sar: {
    value: string
    signal: 'long' | 'short'
  }
  macd: {
    value: string
    signal: 'bullish' | 'bearish'
    histogram: string
  }
  rsi: {
    value: string
    signal: 'overbought' | 'oversold' | 'neutral'
  }
}

// AI分析数据
export interface AIAnalysis {
  id?: string
  inst_id: string
  signal_type: string
  confidence: number
  reasoning: string
  position_analysis: string
  suggested_price?: number
  stop_loss?: number
  take_profit?: number
  timestamp: number
}

// 持仓数据
export interface Position {
  id: string
  symbol: string
  side: 'long' | 'short'
  size: number
  entryPrice: number
  unrealizedPnl: number
  entryTime: number
  takeProfit: number
  stopLoss: number
}

// 策略配置
export interface StrategyConfig {
  id?: string
  name: string
  description: string
  direction_timeframe: string
  entry_timeframe: string
  fund_config: {
    mode: 'fixedAmount' | 'accountBalance'
    fixedAmount: number
    percentage: number
    leverage: number
    marginMode: string
  }
  buy_strategy: {
    conditions: any[]
    logicType: 'and' | 'or'
  }
  sell_strategy: {
    takeProfitPercent: number
    stopLossPercent: number
  }
  risk_control: {
    cooldownSeconds: number
    maxPositions: number
  }
  is_enabled: boolean
  is_default: boolean
}

// 账号信息
export interface Account {
  id: string
  name: string
  api_key: string
  is_default: boolean
  is_validated: boolean
}

// 交易记录
export interface TradeRecord {
  id: string
  inst_id: string
  side: string
  entry_price: number
  exit_price: number
  pnl: number
  pnl_percent: number
  is_profit: boolean
  entry_time: number
  exit_time: number
}

// 聊天消息
export interface ChatMessage {
  id?: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: number
}

// 自动交易配置
export interface AutoTradingConfig {
  enabled: boolean
  symbol: string
  strategy?: StrategyConfig
  minConfidence: number
  maxPositions: number
  stopLossPercent: number
  takeProfitPercent: number
  positionSize: number
  cooldownSeconds: number
}

// 交易状态
export interface TradingState {
  isRunning: boolean
  lastAnalysisTime: number
  lastTradeTime: number
  totalTrades: number
  winTrades: number
  lossTrades: number
  currentPositions: Position[]
}
