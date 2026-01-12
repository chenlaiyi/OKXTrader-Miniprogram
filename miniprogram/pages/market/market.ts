import { apiService } from '../../services/api'
Page({
  data: { markets: [] },
  onLoad() { this.loadMarkets() },
  async loadMarkets() {
    try {
      const markets = await apiService.getMarkets()
      this.setData({ markets })
    } catch (error) {
      wx.showToast({ title: '加载失败', icon: 'none' })
    }
  }
})
