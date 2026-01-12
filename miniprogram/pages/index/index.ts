// pages/index/index.ts
import { apiService } from '../../services/api'
import { formatPrice, formatPercent, calculateChange, getPriceColor, showToast, showLoading, hideLoading } from '../../utils/util'

Page({
  data: {
    markets: [] as any[],
    aiAnalysis: null as any,
    positions: [] as any[],
    autoTradingEnabled: false,
    loading: false
  },

  onLoad() {
    this.loadData()
  },

  onShow() {
    // 每次显示页面时刷新数据
    this.loadData()
  },

  async loadData() {
    if (this.data.loading) return

    this.setData({ loading: true })
    showLoading('加载中...')

    try {
      // 并行加载所有数据
      const [markets, ai, positions, status] = await Promise.all([
        apiService.getMarkets(),
        apiService.getAIAnalysis('ETH-USDT-SWAP'),
        apiService.getPositions(),
        apiService.getAutoTradingStatus()
      ])

      // 处理行情数据
      const processedMarkets = markets.map((item: any) => ({
        ...item,
        price: formatPrice(item.last),
        change: formatPercent(calculateChange(item.last, item.open24h)),
        color: getPriceColor(item.last, item.open24h)
      }))

      this.setData({
        markets: processedMarkets.slice(0, 6), // 只显示前6个
        aiAnalysis: ai,
        positions: positions.slice(0, 3), // 只显示前3个
        autoTradingEnabled: status.enabled,
        loading: false
      })
    } catch (error: any) {
      console.error('加载数据失败:', error)
      showToast('加载失败，请重试')
      this.setData({ loading: false })
    } finally {
      hideLoading()
    }
  },

  formatTime(timestamp: number) {
    const date = new Date(timestamp * 1000)
    return date.toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })
  },

  async toggleAutoTrading(e: any) {
    const enabled = e.detail.value

    const confirmed = await this.showConfirm(
      enabled ? '确定要启用自动交易吗？AI将根据策略自动执行交易。' : '确定要禁用自动交易吗？',
      '确认操作'
    )

    if (!confirmed) {
      // 恢复开关状态
      this.setData({ autoTradingEnabled: !enabled })
      return
    }

    try {
      await apiService.toggleAutoTrading(enabled)
      this.setData({ autoTradingEnabled: enabled })
      showToast(enabled ? '已启用自动交易' : '已禁用自动交易', 'success')
    } catch (error) {
      showToast('操作失败', 'error')
      this.setData({ autoTradingEnabled: !enabled })
    }
  },

  showConfirm(content: string, title: string = '提示'): Promise<boolean> {
    return new Promise((resolve) => {
      wx.showModal({
        title,
        content,
        success: (res) => resolve(res.confirm),
        fail: () => resolve(false)
      })
    })
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
  },

  viewPosition(e: any) {
    const { id } = e.currentTarget.dataset
    wx.navigateTo({
      url: `/pages/trading/trading?positionId=${id}`
    })
  },

  onPullDownRefresh() {
    this.loadData().then(() => {
      wx.stopPullDownRefresh()
    })
  }
})
