// pages/test/test.ts
import { apiService } from '../../services/api'

Page({
  data: {
    testResults: [] as any[],
    loading: false
  },

  onLoad() {
    this.runAllTests()
  },

  async runAllTests() {
    this.setData({ loading: true })
    const tests = [
      { name: '测试1: 获取行情列表', test: () => apiService.getMarkets() },
      { name: '测试2: 获取K线数据', test: () => apiService.getCandles('ETH-USDT-SWAP', 10) },
      { name: '测试3: 获取AI分析', test: () => apiService.getAIAnalysis('ETH-USDT-SWAP') },
      { name: '测试4: 获取持仓列表', test: () => apiService.getPositions() },
      { name: '测试5: 获取账户余额', test: () => apiService.getAccountBalance() },
      { name: '测试6: 获取自动交易状态', test: () => apiService.getAutoTradingStatus() },
      { name: '测试7: 获取策略列表', test: () => apiService.getStrategies() },
      { name: '测试8: 获取交易历史', test: () => apiService.getTradeHistory() },
      { name: '测试9: 获取聊天历史', test: () => apiService.getChatHistory() }
    ]

    const results = []

    for (const test of tests) {
      try {
        const startTime = Date.now()
        const data = await test.test()
        const duration = Date.now() - startTime

        results.push({
          name: test.name,
          status: 'success',
          duration: `${duration}ms`,
          data: data
        })

        console.log(`✅ ${test.name} - 成功 (${duration}ms)`)
      } catch (error: any) {
        results.push({
          name: test.name,
          status: 'error',
          error: error.message || '未知错误'
        })
        console.error(`❌ ${test.name} - 失败:`, error)
      }
    }

    this.setData({
      testResults: results,
      loading: false
    })

    wx.stopPullDownRefresh()
  },

  formatData(data: any): string {
    if (Array.isArray(data)) {
      return `数组 (${data.length}项)`
    } else if (typeof data === 'object') {
      return JSON.stringify(data).substring(0, 100) + '...'
    }
    return String(data)
  },

  onPullDownRefresh() {
    this.runAllTests()
  }
})
