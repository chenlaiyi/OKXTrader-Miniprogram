// pages/monitor/monitor.js
const API = require('../../services/api.js')

Page({
  data: {
    // 自动交易状态
    autoTradingEnabled: false,
    tradingConfig: null,
    tradingStats: null,

    // AI分析状态
    aiAnalysisEnabled: false,
    latestAnalysis: null,
    analysisHistory: [],

    // 账户信息
    currentAccount: null,
    positions: [],
    balance: null,

    // UI状态
    currentTime: '',
    loading: false,

    // 格式化后的显示数据
    formattedWinRate: '0',
    formattedLatestConfidence: '0',
    formattedBalance: '0.00'
  },

  onLoad() {
    console.log('📱 Monitor页面加载')
    this.loadData()
    this.startTimeUpdate()
  },

  onShow() {
    // 页面显示时刷新数据
    if (!this.data.loading) {
      this.loadData()
    }
  },

  onUnload() {
    this.stopRefresh()
  },

  onPullDownRefresh() {
    this.loadData().then(() => {
      wx.stopPullDownRefresh()
    })
  },

  /**
   * 加载所有数据
   */
  async loadData() {
    if (this.data.loading) return

    this.setData({ loading: true })

    try {
      // 1. 获取用户信息
      const userInfo = wx.getStorageSync('userInfo')
      if (!userInfo || !userInfo.id) {
        console.warn('⚠️ 未登录，无法加载数据')
        this.setData({ loading: false })
        return
      }

      // 2. 并行请求所有数据
      const [statusRes, accountRes, positionsRes, balanceRes] = await Promise.all([
        // 获取自动交易状态
        API.getAutoTradingStatus(userInfo.id),
        // 获取当前账号
        API.getAccounts(),
        // 获取持仓
        API.getPositions({ userId: userInfo.id }),
        // 获取余额
        API.getBalance()
      ])

      // 3. 处理自动交易状态
      let autoTradingEnabled = false
      let tradingConfig = null
      let tradingStats = null

      if (statusRes.success && statusRes.data) {
        const status = statusRes.data
        autoTradingEnabled = status.enabled || false
        tradingConfig = status.config || {}
        tradingStats = {
          totalTrades: status.totalTrades || 0,
          winTrades: status.winTrades || 0,
          lossTrades: status.lossTrades || 0,
          isRunning: status.isRunning || false
        }
      }

      // 4. 处理账号信息
      let currentAccount = null
      if (accountRes.success && accountRes.data && accountRes.data.length > 0) {
        const defaultAccount = accountRes.data.find(acc => acc.isDefault) || accountRes.data[0]
        currentAccount = {
          id: defaultAccount.id,
          displayName: defaultAccount.accountName || '未命名账号',
          isSimulation: defaultAccount.accountType === 'simulation'
        }
      }

      // 5. 处理持仓数据
      let positions = []
      if (positionsRes.success && positionsRes.data) {
        positions = positionsRes.data.map(pos => ({
          id: pos.posId,
          symbol: pos.instId,
          side: pos.posSide,
          size: parseFloat(pos.pos).toFixed(4),
          entryPrice: parseFloat(pos.avgPx).toFixed(2),
          unrealizedPnl: parseFloat(pos.upl),
          pnlDisplay: ((parseFloat(pos.upl) / parseFloat(pos.avgPx)) * 100).toFixed(2) + '%'
        }))
      }

      // 6. 处理余额数据
      let formattedBalance = '0.00'
      if (balanceRes.success && balanceRes.data && balanceRes.data.total_equity) {
        formattedBalance = parseFloat(balanceRes.data.total_equity).toFixed(2)
      }

      // 7. 格式化数据用于显示
      const formattedWinRate = tradingStats.totalTrades > 0
        ? ((tradingStats.winTrades / tradingStats.totalTrades) * 100).toFixed(1)
        : '0'
      // 8. 更新页面数据
      this.setData({
        autoTradingEnabled,
        tradingConfig: {
          symbol: tradingConfig.symbol || 'BTC-USDT-SWAP',
          maxPositions: tradingConfig.maxPositions || 1,
          stopLossPercent: tradingConfig.stopLossPercent || 0.2,
          takeProfitPercent: tradingConfig.takeProfitPercent || 1.0
        },
        tradingStats,
        currentAccount,
        positions,
        formattedBalance,
        formattedWinRate,
        loading: false
      })

      console.log('✅ 数据加载成功:', {
        autoTradingEnabled,
        totalTrades: tradingStats.totalTrades,
        winRate: formattedWinRate
      })

    } catch (error) {
      console.error('❌ 加载数据失败:', error)
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      })
      this.setData({ loading: false })
    }
  },

  /**
   * 切换自动交易 ✅ 修复：调用服务器API
   */
  async toggleAutoTrading(e) {
    const newValue = e.detail.value
    const { autoTradingEnabled: currentValue } = this.data

    console.log(`🎛️ 切换自动交易: ${currentValue} → ${newValue}`)

    try {
      // 1. 获取用户信息
      const userInfo = wx.getStorageSync('userInfo')
      if (!userInfo || !userInfo.id) {
        wx.showToast({
          title: '请先登录',
          icon: 'none'
        })
        // 恢复开关状态
        this.setData({ autoTradingEnabled: currentValue })
        return
      }

      // 2. 显示加载提示
      wx.showLoading({
        title: newValue ? '启动中...' : '停止中...',
        mask: true
      })

      // 3. ✅ 调用服务器API（而不是本地引擎）
      const res = await API.toggleAutoTrading({
        userId: userInfo.id,
        enabled: newValue
      })

      wx.hideLoading()

      // 4. 处理响应
      if (res.success) {
        this.setData({ autoTradingEnabled: newValue })

        wx.showToast({
          title: newValue ? '✅ 自动交易已启动' : '⏸️ 自动交易已停止',
          icon: 'success',
          duration: 2000
        })

        console.log(`✅ 自动交易${newValue ? '启动' : '停止'}成功`)

        // 5. 重新加载数据以获取最新状态
        setTimeout(() => {
          this.loadData()
        }, 500)
      } else {
        // 请求失败，恢复开关状态
        this.setData({ autoTradingEnabled: currentValue })

        wx.showToast({
          title: res.message || '操作失败',
          icon: 'none',
          duration: 2000
        })

        console.error('❌ 切换自动交易失败:', res.message)
      }

    } catch (error) {
      wx.hideLoading()

      // 恢复开关状态
      this.setData({ autoTradingEnabled: currentValue })

      console.error('❌ 切换自动交易异常:', error)

      wx.showToast({
        title: '网络错误',
        icon: 'none',
        duration: 2000
      })
    }
  },

  /**
   * 切换AI分析（保留本地实现）
   */
  toggleAIAnalysis(e) {
    const newValue = e.detail.value
    console.log('🔄 切换AI分析:', newValue)

    // TODO: 实现AI分析切换
    wx.showToast({
      title: 'AI分析功能开发中',
      icon: 'none'
    })
  },

  /**
   * 手动触发分析
   */
  async triggerAnalysis() {
    wx.showLoading({ title: '分析中...' })

    try {
      // TODO: 调用手动分析API
      await new Promise(resolve => setTimeout(resolve, 1000))

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
        icon: 'none'
      })
    }
  },

  /**
   * 手动检查持仓
   */
  async checkPositions() {
    wx.showLoading({ title: '检查中...' })

    try {
      await this.loadData()

      wx.hideLoading()
      wx.showToast({
        title: '检查完成',
        icon: 'success'
      })
    } catch (error) {
      wx.hideLoading()
      wx.showToast({
        title: '检查失败',
        icon: 'none'
      })
    }
  },

  /**
   * 跳转到账号管理
   */
  goToAccount() {
    wx.switchTab({
      url: '/pages/account/account'
    })
  },

  /**
   * 跳转到策略管理
   */
  goToStrategy() {
    wx.navigateTo({
      url: '/pages/strategy-edit/strategy-edit'
    })
  },

  /**
   * 跳转到AI分析
   */
  goToAI() {
    wx.switchTab({
      url: '/pages/trading/trading'
    })
  },

  /**
   * 开始时间更新
   */
  startTimeUpdate() {
    const updateTime = () => {
      const now = new Date()
      const hours = now.getHours().toString().padStart(2, '0')
      const minutes = now.getMinutes().toString().padStart(2, '0')
      const seconds = now.getSeconds().toString().padStart(2, '0')
      this.setData({
        currentTime: `${hours}:${minutes}:${seconds}`
      })
    }

    updateTime()
    setInterval(updateTime, 1000)
  },

  /**
   * 停止刷新
   */
  stopRefresh() {
    // 清理定时器
  },

  /**
   * 格式化时间
   */
  formatTime(timestamp) {
    if (!timestamp) return '--'
    const date = new Date(timestamp)
    return date.toLocaleString('zh-CN')
  },

  /**
   * 格式化金额
   */
  formatMoney(value) {
    if (!value) return '0.00'
    return parseFloat(value).toFixed(2)
  },

  /**
   * 格式化百分比
   */
  formatPercent(value) {
    if (!value) return '0.00%'
    const sign = value >= 0 ? '+' : ''
    return `${sign}${parseFloat(value).toFixed(2)}%`
  },

  /**
   * 获取盈亏颜色
   */
  getPnlColor(pnl) {
    return pnl >= 0 ? '#00c853' : '#ff5252'
  },

  /**
   * 获取信号颜色
   */
  getSignalColor(signal) {
    if (!signal) return '#9e9e9e'
    const signalLower = signal.toLowerCase()
    if (signalLower === 'buy' || signalLower === 'long') {
      return '#00c853'
    } else if (signalLower === 'sell' || signalLower === 'short') {
      return '#ff5252'
    }
    return '#9e9e9e'
  }
})
