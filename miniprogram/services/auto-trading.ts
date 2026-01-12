// 自动交易引擎
import { AIAnalysis, Position, StrategyConfig } from '../models/index'
import { apiService } from './api'
import { accountService } from './account'

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

export interface TradingState {
  isRunning: boolean
  lastAnalysisTime: number
  lastTradeTime: number
  totalTrades: number
  winTrades: number
  lossTrades: number
  currentPositions: Position[]
}

class AutoTradingEngine {
  private config: AutoTradingConfig = {
    enabled: false,
    symbol: 'ETH-USDT-SWAP',
    minConfidence: 0.7,
    maxPositions: 3,
    stopLossPercent: 0.2,
    takeProfitPercent: 1.0,
    positionSize: 0.4,
    cooldownSeconds: 60
  }

  private state: TradingState = {
    isRunning: false,
    lastAnalysisTime: 0,
    lastTradeTime: 0,
    totalTrades: 0,
    winTrades: 0,
    lossTrades: 0,
    currentPositions: []
  }

  private timer: number | null = null
  private analysisInterval: number = 30000 // 30秒分析一次

  // 启动自动交易
  start(): boolean {
    if (this.state.isRunning) {
      return false
    }

    if (accountService.isSimulationMode()) {
      console.log('⚠️ 模拟账号不支持自动交易')
      return false
    }

    this.state.isRunning = true
    this.config.enabled = true

    // 立即执行一次分析
    this.analyzeAndTrade()

    // 启动定时任务
    this.timer = setInterval(() => {
      this.analyzeAndTrade()
    }, this.analysisInterval)

    console.log('✅ 自动交易引擎已启动')
    this.saveState()
    return true
  }

  // 停止自动交易
  stop(): boolean {
    if (!this.state.isRunning) {
      return false
    }

    this.state.isRunning = false
    this.config.enabled = false

    if (this.timer !== null) {
      clearInterval(this.timer)
      this.timer = null
    }

    console.log('⏹️ 自动交易引擎已停止')
    this.saveState()
    return true
  }

  // 分析并交易
  private async analyzeAndTrade() {
    try {
      // 获取AI分析
      const analysis = await apiService.getAIAnalysis(this.config.symbol)

      // 更新最后分析时间
      this.state.lastAnalysisTime = Date.now()

      // 检查置信度
      if (analysis.confidence < this.config.minConfidence) {
        console.log(`⚠️ 置信度过低: ${analysis.confidence}`)
        return
      }

      // 获取当前持仓
      const positions = await apiService.getPositions()
      this.state.currentPositions = positions

      // 检查持仓数量限制
      if (positions.length >= this.config.maxPositions) {
        console.log('⚠️ 已达到最大持仓数量')
        return
      }

      // 检查冷却时间
      const timeSinceLastTrade = Date.now() - this.state.lastTradeTime
      if (timeSinceLastTrade < this.config.cooldownSeconds * 1000) {
        console.log('⏳ 冷却中...')
        return
      }

      // 判断交易方向
      const signalType = analysis.signal_type.toLowerCase()
      let side: 'long' | 'short' = 'long'

      if (signalType === 'sell' || signalType === 'short') {
        side = 'short'
      }

      // 执行交易
      await this.executeTrade(side, analysis)

      // 更新最后交易时间
      this.state.lastTradeTime = Date.now()

    } catch (error) {
      console.error('自动交易分析失败:', error)
    }
  }

  // 执行交易
  private async executeTrade(side: 'long' | 'short', analysis: AIAnalysis) {
    try {
      console.log(`📊 执行交易: ${side} ${this.config.symbol}`)

      // 计算仓位大小
      const balance = await apiService.getAccountBalance()
      const positionValue = parseFloat(balance.total_equity) * this.config.positionSize

      // 执行交易
      const result = await apiService.executeTrade(
        this.config.symbol,
        side,
        positionValue
      )

      console.log('✅ 交易执行成功:', result)

      // 设置止盈止损
      if (analysis.stop_loss || analysis.take_profit) {
        // 使用AI建议的止盈止损
        console.log(`🎯 止损: ${analysis.stop_loss}, 止盈: ${analysis.take_profit}`)
      }

      // 更新统计
      this.state.totalTrades++
      this.saveState()

      // 发送通知
      this.sendNotification(
        `交易成功`,
        `${side === 'long' ? '做多' : '做空'} ${this.config.symbol}`,
        `置信度: ${(analysis.confidence * 100).toFixed(0)}%`
      )

    } catch (error: any) {
      console.error('执行交易失败:', error)
      this.sendNotification('交易失败', error.message || '未知错误', '')
    }
  }

  // 检查持仓并平仓
  async checkPositions(): Promise<void> {
    try {
      const positions = await apiService.getPositions()

      for (const position of positions) {
        // 检查是否达到止盈止损
        const pnlPercent = (position.unrealizedPnl / position.entryPrice) * 100

        if (pnlPercent <= -this.config.stopLossPercent) {
          console.log(`🛑 触发止损: ${position.symbol}`)
          await this.closePosition(position.id, '止损')
        } else if (pnlPercent >= this.config.takeProfitPercent) {
          console.log(`💰 触发止盈: ${position.symbol}`)
          await this.closePosition(position.id, '止盈')
        }
      }
    } catch (error) {
      console.error('检查持仓失败:', error)
    }
  }

  // 平仓
  private async closePosition(positionId: string, reason: string) {
    try {
      await apiService.closePosition(positionId)
      console.log(`✅ 平仓成功: ${reason}`)

      // 更新统计
      if (reason === '止盈') {
        this.state.winTrades++
      } else {
        this.state.lossTrades++
      }
      this.saveState()

    } catch (error) {
      console.error('平仓失败:', error)
    }
  }

  // 更新配置
  updateConfig(updates: Partial<AutoTradingConfig>): void {
    this.config = { ...this.config, ...updates }
    this.saveConfig()
  }

  // 获取配置
  getConfig(): AutoTradingConfig {
    return { ...this.config }
  }

  // 获取状态
  getState(): TradingState {
    return { ...this.state }
  }

  // 获取胜率
  getWinRate(): number {
    if (this.state.totalTrades === 0) return 0
    return (this.state.winTrades / this.state.totalTrades) * 100
  }

  // 获取统计
  getStats(): {
    totalTrades: number
    winTrades: number
    lossTrades: number
    winRate: number
    isRunning: boolean
  } {
    return {
      totalTrades: this.state.totalTrades,
      winTrades: this.state.winTrades,
      lossTrades: this.state.lossTrades,
      winRate: this.getWinRate(),
      isRunning: this.state.isRunning
    }
  }

  // 保存配置到存储
  private saveConfig() {
    try {
      wx.setStorageSync('auto_trading_config', this.config)
    } catch (error) {
      console.error('保存配置失败:', error)
    }
  }

  // 保存状态到存储
  private saveState() {
    try {
      wx.setStorageSync('auto_trading_state', this.state)
    } catch (error) {
      console.error('保存状态失败:', error)
    }
  }

  // 从存储加载配置和状态
  loadFromStorage() {
    try {
      const config = wx.getStorageSync('auto_trading_config')
      if (config) {
        this.config = { ...this.config, ...config }
      }

      const state = wx.getStorageSync('auto_trading_state')
      if (state) {
        this.state = { ...this.state, ...state }
      }
    } catch (error) {
      console.error('加载配置失败:', error)
    }
  }

  // 发送通知
  private sendNotification(title: string, content: string, extra: string) {
    // 使用小程序订阅消息
    wx.requestSubscribeMessage({
      tmplIds: ['你的模板ID'],
      success: (res) => {
        console.log('订阅消息成功:', res)
      },
      fail: (err) => {
        console.log('订阅消息失败:', err)
        // 降级到系统通知
        wx.showToast({
          title: `${title}: ${content}`,
          icon: 'success',
          duration: 3000
        })
      }
    })
  }

  // 初始化（在app启动时调用）
  init() {
    this.loadFromStorage()

    // 如果之前是运行状态，重新启动
    if (this.config.enabled && !this.state.isRunning) {
      this.start()
    }
  }
}

export const autoTradingEngine = new AutoTradingEngine()
