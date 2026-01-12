import { apiService } from '../../services/api'
Page({
  data: { strategies: [] },
  onLoad() { this.loadStrategies() },
  async loadStrategies() {
    try {
      const strategies = await apiService.getStrategies()
      this.setData({ strategies })
    } catch (error) {
      wx.showToast({ title: '加载失败', icon: 'none' })
    }
  }
})
