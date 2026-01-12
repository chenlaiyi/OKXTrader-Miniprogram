import { apiService } from '../../services/api'
Page({
  data: { analysis: null },
  onLoad() { this.loadAnalysis() },
  async loadAnalysis() {
    try {
      const analysis = await apiService.getAIAnalysis('ETH-USDT-SWAP')
      this.setData({ analysis })
    } catch (error) {
      wx.showToast({ title: '加载失败', icon: 'none' })
    }
  }
})
