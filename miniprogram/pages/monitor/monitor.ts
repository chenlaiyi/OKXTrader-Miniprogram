// pages/monitor/monitor.ts
import { autoTradingEngine } from '../../services/auto-trading'
import { aiAnalysisService } from '../../services/ai-analysis'
import { apiService } from '../../services/api'
import { accountService } from '../../services/account'

Page({
  data: {
    autoTradingEnabled: false,
    aiAnalysisEnabled: false,

    tradingConfig: null,
    tradingState: null,
    tradingStats: null,

    aiConfig: null,
    aiStatus: null,
    latestAnalysis: null,
    analysisHistory: [],

    currentAccount: null,
    positions: [],
    balance: null,

    refreshInterval: null,
    currentTime: ''
  },

  onLoad() {
    this.loadData()
    this.startTimeUpdate()
  },

  onUnload() {
    this.stopRefresh()
  },

  onPullDownRefresh() {
    this.loadData().then(() => {
      wx.stopPullDownRefresh()
    })
  },

  // 加载数据
  async loadData() {
    try {
      // 加载自动交易状态
      const tradingConfig = autoTradingEngine.getConfig()
      const tradingState = autoTradingEngine.getState()
      const tradingStats = autoTradingEngine.getStats()

      // 加载AI分析状态
      const aiConfig = aiAnalysisService.getConfig()
      const aiStatus = aiAnalysisService.getStatus()
      const latestAnalysis = await aiAnalysisService.getLatestAnalysis()
      const analysisHistory = aiAnalysisService.getHistory(5)

      // 加载账号信息
      const currentAccount = accountService.getCurrentAccount()

      // 加载持仓和余额
      const positions = await apiService.getPositions()
      const balance = await apiService.getAccountBalance()

      this.setData({
        autoTradingEnabled: tradingStats.isRunning,
        aiAnalysisEnabled: aiStatus.isRunning,

        tradingConfig,
        tradingState,
        tradingStats,

        aiConfig,
        aiStatus,
        latestAnalysis,
        analysisHistory,

        currentAccount,
        positions,
        balance
      })
    } catch (error) {
      console.error('加载数据失败:', error)
      wx.showToast({
        title: '加载数据失败',
        icon: 'error'
      })
    }
  },

  // 切换自动交易
  async toggleAutoTrading() {
    const { autoTradingEnabled } = this.data

    try {
      if (autoTradingEnabled) {
        autoTradingEngine.stop()
        wx.showToast({
          title: '已停止自动交易',
          icon: 'success'
        })
      } else {
        // 检查账号
        if (accountService.isSimulationMode()) {
          wx.showModal({
            title: '提示',
            content: '模拟账号不支持自动交易，请切换到真实账号',
            showCancel: false
          })
          return
        }

        const success = autoTradingEngine.start()
        if (success) {
          wx.showToast({
            title: '已启动自动交易',
            icon: 'success'
          })
        } else {
          wx.showToast({
            title: '启动失败',
            icon: 'error'
          })
        }
      }

      await this.loadData()
    } catch (error) {
      console.error('切换自动交易失败:', error)
      wx.showToast({
        title: '操作失败',
        icon: 'error'
      })
    }
  },

  // 切换AI分析
  toggleAIAnalysis() {
    const { aiAnalysisEnabled } = this.data

    try {
      if (aiAnalysisEnabled) {
        aiAnalysisService.stopContinuousAnalysis()
        wx.showToast({
          title: '已停止AI分析',
          icon: 'success'
        })
      } else {
        const success = aiAnalysisService.startContinuousAnalysis()
        if (success) {
          wx.showToast({
            title: '已启动AI分析',
            icon: 'success'
          })
        }
      }

      this.loadData()
    } catch (error) {
      console.error('切换AI分析失败:', error)
      wx.showToast({
        title: '操作失败',
        icon: 'error'
      })
    }
  },

  // 手动触发分析
  async triggerAnalysis() {
    wx.showLoading({ title: '分析中...' })

    try {
      await aiAnalysisService.performAnalysis()
      wx.hideLoading()
      wx.showToast({
        title: '分析完成',
        icon: 'success'
      })
      this.loadData()
    } catch (error) {
      wx.hideLoading()
      wx.showToast({
        title: '分析失败',
        icon: 'error'
      })
    }
  },

  // 手动检查持仓
  async checkPositions() {
    wx.showLoading({ title: '检查中...' })

    try {
      await autoTradingEngine.checkPositions()
      wx.hideLoading()
      wx.showToast({
        title: '检查完成',
        icon: 'success'
      })
      this.loadData()
    } catch (error) {
      wx.hideLoading()
      wx.showToast({
        title: '检查失败',
        icon: 'error'
      })
    }
  },

  // 跳转到账号管理
  goToAccount() {
    wx.navigateTo({ url: '/pages/account/account' })
  },

  // 跳转到策略管理
  goToStrategy() {
    wx.navigateTo({ url: '/pages/strategy/strategy' })
  },

  // 跳转到AI分析详情
  goToAI() {
    wx.switchTab({ url: '/pages/ai/ai' })
  },

  // 查看分析详情
  viewAnalysisDetail(e: any) {
    const analysis = e.currentTarget.dataset.analysis
    wx.showModal({
      title: `分析详情 - ${analysis.inst_id}`,
      content: `
信号: ${analysis.signal_type}
置信度: ${(analysis.confidence * 100).toFixed(0)}%
推理: ${analysis.reasoning}
建议价格: ${analysis.suggested_price || '无'}
止损: ${analysis.stop_loss || '无'}
止盈: ${analysis.take_profit || '无'}
      `,
      showCancel: false
    })
  },

  // 开始自动刷新
  startAutoRefresh() {
    if (this.data.refreshInterval) {
      return
    }

    const interval = setInterval(() => {
      this.loadData()
    }, 5000) // 每5秒刷新一次

    this.setData({ refreshInterval: interval })
  },

  // 停止刷新
  stopRefresh() {
    if (this.data.refreshInterval) {
      clearInterval(this.data.refreshInterval)
      this.setData({ refreshInterval: null })
    }
  },

  // 开始时间更新
  startTimeUpdate() {
    const updateTime = () => {
      const now = new Date()
      this.setData({
        currentTime: now.toLocaleString('zh-CN')
      })
    }

    updateTime()
    setInterval(updateTime, 1000)
  },

  // 格式化时间
  formatTime(timestamp: number) {
    const date = new Date(timestamp)
    return date.toLocaleString('zh-CN')
  },

  // 格式化金额
  formatMoney(value: number) {
    return value.toFixed(2)
  },

  // 格式化百分比
  formatPercent(value: number) {
    const sign = value >= 0 ? '+' : ''
    return `${sign}${value.toFixed(2)}%`
  },

  // 获取盈亏颜色
  getPnlColor(pnl: number) {
    return pnl >= 0 ? '#00c853' : '#ff5252'
  },

  // 获取信号颜色
  getSignalColor(signal: string) {
    const signalLower = signal.toLowerCase()
    if (signalLower === 'buy' || signalLower === 'long') {
      return '#00c853'
    } else if (signalLower === 'sell' || signalLower === 'short') {
      return '#ff5252'
    }
    return '#9e9e9e'
  }
})
