// 自动交易引擎
const API = require('./api')
const { strategyValidator } = require('./strategy-validator')

class AutoTradingEngine {
  constructor() {
    this.config = {
      enabled: false,
      userId: null,  // ✅ 用户ID,用于获取持仓
      symbol: 'ETH-USDT-SWAP',
      strategy: undefined,  // ✅ v0.0.154新增：策略配置
      tradingMode: 'ai',  // ✅ 新增：交易模式 ('ai'=AI辅助, 'pure'=纯策略)
      minConfidence: 0.7,
      maxPositions: 3,
      stopLossPercent: 0.2,
      takeProfitPercent: 1.0,
      positionSize: 0.4,
      cooldownSeconds: 60
    }

    this.state = {
      isRunning: false,
      lastAnalysisTime: 0,
      lastTradeTime: 0,
      totalTrades: 0,
      winTrades: 0,
      lossTrades: 0,
      currentPositions: []
    }

    this.timer = null
    this.analysisInterval = 30000 // 30秒分析一次
  }

  // 启动自动交易
  start() {
    if (this.state.isRunning) {
      return false
    }

    // TODO: 添加模拟账号检查
    // if (accountService.isSimulationMode()) {
    //   console.log('⚠️ 模拟账号不支持自动交易')
    //   return false
    // }

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
  stop() {
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

  // 分析并交易（✅ v0.0.154: 添加本地策略验证）
  async analyzeAndTrade() {
    try {
      console.log('🔄 开始新的交易分析...')

      // 获取AI分析
      const analysis = await API.getAIAnalysis(this.config.symbol)
      console.log(`📊 AI分析结果: ${analysis.signal_type}, 置信度: ${(analysis.confidence * 100).toFixed(0)}%`)

      // 更新最后分析时间
      this.state.lastAnalysisTime = Date.now()

      // 检查置信度
      if (analysis.confidence < this.config.minConfidence) {
        console.log(`⚠️ 置信度过低: ${(analysis.confidence * 100).toFixed(0)}% < ${this.config.minConfidence * 100}%`)
        return
      }

      // ✅ v0.0.154新增：本地策略验证
      if (this.config.strategy) {
        console.log('🔍 执行本地策略验证...')

        const validationResult = await strategyValidator.validateStrategy(
          this.config.strategy,
          analysis,
          this.config.symbol
        )

        if (!validationResult.passed) {
          console.log(`❌ 本地策略验证失败: ${validationResult.reason}`)
          console.log('   详细信息:', validationResult.details)

          // 发送通知
          this.sendNotification(
            '策略验证失败',
            validationResult.reason,
            `AI建议: ${analysis.signal_type}`
          )

          return // 验证失败，不执行交易
        }

        console.log(`✅ 本地策略验证通过`)
      }

      // 获取当前持仓
      const params = this.config.userId ? { userId: this.config.userId } : {}
      const positionsRes = await API.getPositions(params)
      const positions = positionsRes.success ? (positionsRes.data || []) : []
      this.state.currentPositions = positions

      // 检查持仓数量限制
      if (positions.length >= this.config.maxPositions) {
        console.log('⚠️ 已达到最大持仓数量')
        return
      }

      // 检查冷却时间
      const timeSinceLastTrade = Date.now() - this.state.lastTradeTime
      if (timeSinceLastTrade < this.config.cooldownSeconds * 1000) {
        const remaining = Math.ceil((this.config.cooldownSeconds * 1000 - timeSinceLastTrade) / 1000)
        console.log(`⏳ 冷却中... 剩余 ${remaining} 秒`)
        return
      }

      // 判断交易方向
      const signalType = analysis.signal_type.toLowerCase()
      let side = 'long'

      if (signalType === 'sell' || signalType === 'short') {
        side = 'short'
      }

      console.log(`✅ 所有检查通过，准备执行交易: ${side}`)

      // 执行交易
      await this.executeTrade(side, analysis)

      // 更新最后交易时间
      this.state.lastTradeTime = Date.now()

    } catch (error) {
      console.error('自动交易分析失败:', error)
    }
  }

  // 执行交易
  async executeTrade(side, analysis) {
    try {
      console.log(`📊 执行交易: ${side} ${this.config.symbol}`)

      // 计算仓位大小
      const balance = await API.getAccountBalance()
      const positionValue = parseFloat(balance.total_equity) * this.config.positionSize

      // 执行交易
      const result = await API.executeTrade(
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

    } catch (error) {
      console.error('执行交易失败:', error)
      this.sendNotification('交易失败', error.message || '未知错误', '')
    }
  }

  // 检查持仓并平仓
  async checkPositions() {
    try {
      const params = this.config.userId ? { userId: this.config.userId } : {}
      const positionsRes = await API.getPositions(params)
      const positions = positionsRes.success ? (positionsRes.data || []) : []

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
  async closePosition(positionId, reason) {
    try {
      await API.closePosition(positionId)
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
  updateConfig(updates) {
    this.config = { ...this.config, ...updates }
    this.saveConfig()
  }

  // ✅ 新增：切换交易模式
  setTradingMode(mode) {
    if (mode !== 'ai' && mode !== 'pure') {
      console.error('❌ 无效的交易模式:', mode)
      return false
    }

    const oldMode = this.config.tradingMode
    this.config.tradingMode = mode
    this.saveConfig()

    console.log(`✅ 交易模式已切换: ${oldMode} → ${mode}`)
    if (mode === 'pure') {
      console.log('   ⚡ 纯策略模式：直接基于技术指标，快速响应，零AI成本')
    } else {
      console.log('   🤖 AI辅助模式：AI智能分析，考虑更多因素')
    }

    return true
  }

  // 获取当前交易模式
  getTradingMode() {
    return this.config.tradingMode || 'ai'
  }

  // ✅ v0.0.154新增：设置策略配置
  setStrategyConfig(strategy, userId) {
    this.config.strategy = strategy
    if (userId) {
      this.config.userId = userId
    }
    console.log('✅ 策略配置已更新:', strategy.name)
    this.saveConfig()
  }

  // 获取配置
  getConfig() {
    return { ...this.config }
  }

  // 获取状态
  getState() {
    return { ...this.state }
  }

  // 获取胜率
  getWinRate() {
    if (this.state.totalTrades === 0) return 0
    return (this.state.winTrades / this.state.totalTrades) * 100
  }

  // 获取统计
  getStats() {
    return {
      totalTrades: this.state.totalTrades,
      winTrades: this.state.winTrades,
      lossTrades: this.state.lossTrades,
      winRate: this.getWinRate(),
      isRunning: this.state.isRunning
    }
  }

  // 保存配置到存储
  saveConfig() {
    try {
      wx.setStorageSync('auto_trading_config', this.config)
    } catch (error) {
      console.error('保存配置失败:', error)
    }
  }

  // 保存状态到存储
  saveState() {
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
  sendNotification(title, content, extra) {
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

// 导出单例
const autoTradingEngine = new AutoTradingEngine()

module.exports = {
  autoTradingEngine,
  AutoTradingEngine
}
