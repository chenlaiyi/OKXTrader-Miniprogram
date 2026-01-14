// pages/ai/ai.ts
import { apiService } from '../../services/api'

Page({
  data: {
    // 状态
    autoTradeEnabled: false,
    isAnalyzing: false,
    autoAnalysisEnabled: false,

    // 策略信息 (iOS风格)
    currentStrategy: {
      emoji: '📊',
      name: 'SAR + MACD 策略'
    },
    tradingStyle: 'conservative', // 'aggressive' | 'conservative'

    // 核心参数 (iOS v0.0.099)
    takeProfitPercent: 5.0,
    stopLossPercent: 3.0,
    leverage: 3,
    confidenceThreshold: 70,
    analysisInterval: 15,

    // 持仓数据
    apiPositions: [] as any[],
    spotBalances: [] as any[],
    strategyPositions: [] as any[],

    // 当前分析
    currentAnalysis: null as any,
    analysisTime: '',

    // 历史记录
    historyList: [] as any[],
    buyCount: 0,
    sellCount: 0,
    holdCount: 0
  },

  onLoad() {
    this.loadData()
    this.loadSettings()
  },

  onShow() {
    this.loadData()
  },

  // 加载设置
  loadSettings() {
    // 从本地存储读取设置
    const settings = wx.getStorageSync('ai_settings') || {}
    this.setData({
      takeProfitPercent: settings.takeProfitPercent ?? 5.0,
      stopLossPercent: settings.stopLossPercent ?? 3.0,
      leverage: settings.leverage ?? 3,
      confidenceThreshold: settings.confidenceThreshold ?? 70,
      analysisInterval: settings.analysisInterval ?? 15,
      tradingStyle: settings.tradingStyle ?? 'conservative'
    })
  },

  async loadData() {
    try {
      // TODO: 从API获取真实数据
      const mockData = this.generateMockData()
      this.setData({
        ...mockData,
        buyCount: mockData.historyList.filter((h: any) => h.signalType === 'long').length,
        sellCount: mockData.historyList.filter((h: any) => h.signalType === 'short').length,
        holdCount: mockData.historyList.filter((h: any) => h.signalType === 'neutral').length
      })
    } catch (error) {
      console.error('加载数据失败:', error)
    }
  },

  generateMockData() {
    return {
      apiPositions: [
        {
          instId: 'ETH-USDT-SWAP',
          side: 'long',
          leverage: 5,
          quantity: '0.5',
          avgPrice: '3480.50',
          currentPrice: '3520.00',
          pnl: 19.75,
          pnlPercent: '+1.14%'
        }
      ],
      spotBalances: [
        {
          currency: 'ETH',
          available: '1.5',
          holding: '1.5',
          value: '5280.00'
        }
      ],
      strategyPositions: [],
      currentAnalysis: {
        // 双信号显示 (iOS风格)
        spotSignalText: '买入 📈',
        spotSignalClass: 'green',
        contractSignalText: '开多 🚀',
        contractSignalClass: 'green',
        confidence: 75,
        leverage: 5,
        suggestedPrice: '3515.00',
        stopLoss: '3400.00',
        takeProfit: '3650.00',
        reasoning: 'ETH处于上升趋势中，MA5>MA10>MA20呈现多头排列，RSI14为55显示处于中性偏强区域。MACD金叉，Histogram为正值显示动量转强。价格接近BOLL中轨，建议在中轨附近介入。',
        positionAnalysis: '当前持有ETH多头持仓0.5个，入场价3480.50，当前价3520.00，浮盈+19.75 USDT (+1.14%)。',
        risks: [
          '注意BTC走势对ETH的连带影响',
          '关注大盘整体趋势变化',
          '注意3480支撑位，跌破需及时止损'
        ]
      },
      analysisTime: '14:35',
      historyList: [
        {
          id: '1',
          time: '14:35',
          symbol: 'ETH',
          signalType: 'long',
          signalClass: 'green',
          signalText: '买入📈',
          confidence: 75
        },
        {
          id: '2',
          time: '13:20',
          symbol: 'BTC',
          signalType: 'neutral',
          signalClass: 'yellow',
          signalText: '观望⏳',
          confidence: 60
        },
        {
          id: '3',
          time: '12:05',
          symbol: 'ETH',
          signalType: 'short',
          signalClass: 'red',
          signalText: '卖出📉',
          confidence: 68
        }
      ]
    }
  },

  // 开启设置
  openSettings() {
    wx.navigateTo({
      url: '/pages/strategy/strategy'
    })
  },

  // 切换自动交易
  toggleAutoTrade(e: any) {
    const enabled = e.detail.value
    this.setData({ autoTradeEnabled: enabled })
    wx.showToast({
      title: enabled ? '自动交易已开启' : '自动交易已关闭',
      icon: 'none'
    })
  },

  // 开始分析
  async startAnalysis() {
    this.setData({ isAnalyzing: true })
    wx.showLoading({ title: '分析中...' })

    try {
      // TODO: 调用真实的AI分析API
      await new Promise(resolve => setTimeout(resolve, 2000))

      const mockAnalysis = {
        spotSignalText: '买入 📈',
        spotSignalClass: 'green',
        contractSignalText: '开多 🚀',
        contractSignalClass: 'green',
        confidence: Math.floor(Math.random() * 30) + 60,
        leverage: this.data.leverage,
        suggestedPrice: '3515.00',
        stopLoss: '3400.00',
        takeProfit: '3650.00',
        reasoning: 'ETH处于上升趋势中，MA5>MA10>MA20呈现多头排列，RSI14为55显示处于中性偏强区域。MACD金叉，Histogram为正值显示动量转强。',
        risks: [
          '注意BTC走势对ETH的连带影响',
          '关注大盘整体趋势变化'
        ]
      }

      const now = new Date()
      const time = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`

      // 添加到历史记录
      const newHistoryItem = {
        id: Date.now().toString(),
        time,
        symbol: 'ETH',
        signalType: 'long',
        signalClass: 'green',
        signalText: mockAnalysis.spotSignalText,
        confidence: mockAnalysis.confidence
      }

      const historyList = [newHistoryItem, ...this.data.historyList].slice(0, 20)

      this.setData({
        currentAnalysis: mockAnalysis,
        analysisTime: time,
        isAnalyzing: false,
        historyList,
        buyCount: historyList.filter((h: any) => h.signalType === 'long').length,
        sellCount: historyList.filter((h: any) => h.signalType === 'short').length,
        holdCount: historyList.filter((h: any) => h.signalType === 'neutral').length
      })

      wx.hideLoading()
      wx.showToast({ title: '分析完成', icon: 'success' })
    } catch (error) {
      this.setData({ isAnalyzing: false })
      wx.hideLoading()
      wx.showToast({ title: '分析失败', icon: 'none' })
    }
  },

  // 切换自动分析
  toggleAutoAnalysis() {
    const enabled = !this.data.autoAnalysisEnabled
    this.setData({ autoAnalysisEnabled: enabled })
    wx.showToast({
      title: enabled ? '自动分析已开启' : '自动分析已停止',
      icon: 'none'
    })

    if (enabled) {
      // 开启自动分析定时器
      this.startAutoAnalysis()
    } else {
      this.stopAutoAnalysis()
    }
  },

  autoAnalysisTimer: null as any,

  startAutoAnalysis() {
    const interval = this.data.analysisInterval * 60 * 1000
    this.autoAnalysisTimer = setInterval(() => {
      if (!this.data.isAnalyzing) {
        this.startAnalysis()
      }
    }, interval)
  },

  stopAutoAnalysis() {
    if (this.autoAnalysisTimer) {
      clearInterval(this.autoAnalysisTimer)
      this.autoAnalysisTimer = null
    }
  },

  // 刷新持仓
  refreshPositions() {
    wx.showToast({ title: '刷新中...', icon: 'loading' })
    this.loadData().then(() => {
      wx.showToast({ title: '刷新完成', icon: 'success' })
    })
  },

  // 查看历史详情
  viewHistoryDetail(e: any) {
    const item = e.currentTarget.dataset.item
    wx.showModal({
      title: `${item.symbol} 分析详情`,
      content: `时间: ${item.time}\n信号: ${item.signalText}\n置信度: ${item.confidence}%`,
      showCancel: false
    })
  },

  onUnload() {
    this.stopAutoAnalysis()
  }
})
