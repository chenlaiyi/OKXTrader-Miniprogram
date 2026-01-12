// pages/trading/trading.ts
import { apiService } from '../../services/api'
import { formatPrice } from '../../utils/util'

Page({
  data: {
    currentSymbol: 'ETH-USDT-SWAP',
    currentPrice: '0.00',
    candles: [],
    positions: [],
    accountBalance: '0.00'
  },

  onLoad() {
    this.loadData()
  },

  async loadData() {
    try {
      const [markets, positions, balance] = await Promise.all([
        apiService.getMarkets(),
        apiService.getPositions(),
        apiService.getAccountBalance()
      ])

      const currentMarket = markets.find((m: any) => m.inst_id === this.data.currentSymbol)
      const price = currentMarket ? currentMarket.last : '0.00'

      this.setData({
        currentPrice: formatPrice(price),
        positions,
        accountBalance: balance.equity || '0.00'
      })
    } catch (error) {
      console.error('加载失败:', error)
    }
  },

  async executeTrade(e: any) {
    const side = e.currentTarget.dataset.side
    const action = side === 'long' ? '做多' : '做空'
    
    wx.showModal({
      title: '确认交易',
      content: `确定要${action} ${this.data.currentSymbol} 吗？`,
      success: async (res) => {
        if (res.confirm) {
          try {
            await apiService.executeTrade(this.data.currentSymbol, side, 1)
            wx.showToast({ title: '下单成功', icon: 'success' })
            this.loadData()
          } catch (error) {
            wx.showToast({ title: '下单失败', icon: 'none' })
          }
        }
      }
    })
  }
})
