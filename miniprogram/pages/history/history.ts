import { apiService } from '../../services/api'
Page({
  data: { trades: [] },
  onLoad() { this.loadTrades() },
  async loadTrades() {
    try {
      const trades = await apiService.getTradeHistory()
      this.setData({ trades })
    } catch (error) {
      wx.showToast({ title: '加载失败', icon: 'none' })
    }
  }
})
