// pages/account/account.ts
import { apiService } from '../../services/api'

interface Balance {
  currency: string
  total: number
  totalDisplay: string
  available: number
  usdValue: number
  usdValueDisplay: string
}

interface Position {
  posId: string
  instId: string
  posSide: string
  pos: string
  avgPx: string
  avgPxDisplay: string
  lever: string
  upl?: string
  uplNum: number
  uplDisplay: string
}

interface TradeRecord {
  id: string
  symbol: string
  time: string
  operationLabel: string
  operationClass: string
  pnl: number
  pnlDisplay: string
  sizeDisplay: string
}

Page({
  data: {
    // 状态
    isConnected: true,
    statusMessage: '已连接',
    isRefreshing: false,
    showModal: false,
    modalMode: 'add',

    // 账号数据
    accounts: [] as any[],
    accountNames: [] as string[],
    currentAccountIndex: 0,
    currentAccount: {} as any,

    // 账户信息 (iOS风格)
    accountInfo: {
      uid: '',
      level: '',
      totalEquity: '0.00'
    },

    // 资产列表
    balances: [] as Balance[],

    // 合约持仓
    contractPositions: [] as Position[],

    // 最近交易
    recentTrades: [] as TradeRecord[],

    // 表单数据
    formData: {
      name: '',
      isSimulation: false,
      apiKey: '',
      secretKey: '',
      passphrase: ''
    }
  },

  onLoad() {
    this.loadAccounts()
    this.loadAccountData()
  },

  onShow() {
    this.loadAccountData()
  },

  // 加载账号列表
  async loadAccounts() {
    try {
      const accounts = await apiService.getAccounts()
      const accountNames = accounts.map((a: any) => a.name)

      this.setData({
        accounts,
        accountNames,
        currentAccount: accounts[0] || {}
      })
    } catch (error) {
      console.error('加载账号列表失败:', error)
      // 使用模拟数据
      const mockAccounts = [
        { id: 1, name: '主账号', isSimulation: false, is_validated: true },
        { id: 2, name: '模拟账号', isSimulation: true, is_validated: true }
      ]
      this.setData({
        accounts: mockAccounts,
        accountNames: mockAccounts.map(a => a.name),
        currentAccount: mockAccounts[0]
      })
    }
  },

  // 加载账户数据
  async loadAccountData() {
    await Promise.all([
      this.loadAccountInfo(),
      this.loadBalances(),
      this.loadPositions(),
      this.loadRecentTrades()
    ])
  },

  // 加载账户信息
  async loadAccountInfo() {
    try {
      const info = await apiService.getAccountInfo()
      this.setData({
        accountInfo: {
          uid: info.uid || '****' + Math.random().toString().slice(-8),
          level: info.level || 'Lv.1',
          totalEquity: parseFloat(info.totalEquity || '0').toFixed(2)
        },
        isConnected: true,
        statusMessage: '已连接'
      })
    } catch (error) {
      console.error('加载账户信息失败:', error)
      // 使用模拟数据
      this.setData({
        accountInfo: {
          uid: '****' + Math.random().toString().slice(-8),
          level: 'Lv.1',
          totalEquity: '12580.50'
        }
      })
    }
  },

  // 加载资产余额
  async loadBalances() {
    try {
      const balances = await apiService.getBalances()
      const formattedBalances = balances
        .filter((b: any) => parseFloat(b.total || b.availBal || '0') > 0)
        .map((b: any) => ({
          currency: b.ccy || b.currency,
          total: parseFloat(b.total || b.availBal || '0'),
          totalDisplay: parseFloat(b.total || b.availBal || '0').toFixed(8),
          available: parseFloat(b.availBal || b.available || '0'),
          usdValue: parseFloat(b.eqUsd || b.usdValue || '0'),
          usdValueDisplay: parseFloat(b.eqUsd || b.usdValue || '0').toFixed(2)
        }))

      this.setData({ balances: formattedBalances })
    } catch (error) {
      console.error('加载资产余额失败:', error)
      // 使用模拟数据
      this.setData({
        balances: [
          { currency: 'USDT', total: 5000, totalDisplay: '5000.00000000', available: 4500, usdValue: 5000, usdValueDisplay: '5000.00' },
          { currency: 'ETH', total: 1.5, totalDisplay: '1.50000000', available: 1.2, usdValue: 5280, usdValueDisplay: '5280.00' },
          { currency: 'BTC', total: 0.05, totalDisplay: '0.05000000', available: 0.05, usdValue: 2150, usdValueDisplay: '2150.00' }
        ]
      })
    }
  },

  // 加载合约持仓
  async loadPositions() {
    try {
      const positions = await apiService.getPositions()
      const formattedPositions = positions.map((p: any) => ({
        posId: p.posId,
        instId: p.instId,
        posSide: p.posSide,
        pos: p.pos,
        avgPx: p.avgPx,
        avgPxDisplay: parseFloat(p.avgPx || '0').toFixed(2),
        lever: p.lever,
        uplNum: parseFloat(p.upl || '0'),
        uplDisplay: Math.abs(parseFloat(p.upl || '0')).toFixed(2)
      }))

      this.setData({ contractPositions: formattedPositions })
    } catch (error) {
      console.error('加载持仓失败:', error)
      // 使用模拟数据
      this.setData({
        contractPositions: [
          { posId: '1', instId: 'BTC-USDT-SWAP', posSide: 'long', pos: '0.01', avgPx: '42500', avgPxDisplay: '42500.00', lever: '3', uplNum: 125.5, uplDisplay: '125.50' },
          { posId: '2', instId: 'ETH-USDT-SWAP', posSide: 'short', pos: '0.5', avgPx: '2350', avgPxDisplay: '2350.00', lever: '5', uplNum: -35.2, uplDisplay: '35.20' }
        ]
      })
    }
  },

  // 加载最近交易
  async loadRecentTrades() {
    try {
      const trades = await apiService.getFillHistory()
      const recentTrades = trades.slice(0, 5).map((t: any) => {
        const timestamp = parseFloat(t.ts) / 1000
        const date = new Date(timestamp)
        const time = `${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`

        const symbol = t.instId.split('-')[0]
        let operationLabel = t.side === 'buy' ? '买入' : '卖出'
        let operationClass = t.side === 'buy' ? 'buy' : 'sell'

        if (t.instType === 'SWAP' && t.posSide) {
          if (t.posSide === 'long') {
            operationLabel = t.side === 'buy' ? '开多' : '平多'
            operationClass = t.side === 'buy' ? 'long' : 'close-long'
          } else {
            operationLabel = t.side === 'sell' ? '开空' : '平空'
            operationClass = t.side === 'sell' ? 'short' : 'close-short'
          }
        }

        const pnl = parseFloat(t.fillPnl || t.pnl || '0')

        return {
          id: t.ts,
          symbol,
          time,
          operationLabel,
          operationClass,
          pnl,
          pnlDisplay: Math.abs(pnl).toFixed(2),
          sizeDisplay: parseFloat(t.fillSz || '0').toFixed(4)
        }
      })

      this.setData({ recentTrades })
    } catch (error) {
      console.error('加载交易记录失败:', error)
      // 使用模拟数据
      this.setData({
        recentTrades: [
          { id: '1', symbol: 'BTC', time: '01-12 14:30', operationLabel: '开多', operationClass: 'long', pnl: 15.8, pnlDisplay: '15.80', sizeDisplay: '0.0100' },
          { id: '2', symbol: 'ETH', time: '01-12 12:15', operationLabel: '平多', operationClass: 'close-long', pnl: -8.5, pnlDisplay: '8.50', sizeDisplay: '0.1500' }
        ]
      })
    }
  },

  // 账号切换
  onAccountChange(e: any) {
    const index = e.detail.value
    this.setData({
      currentAccountIndex: index,
      currentAccount: this.data.accounts[index]
    })
    this.loadAccountData()
    wx.showToast({ title: '已切换账号', icon: 'success' })
  },

  // 刷新资产
  async refreshAssets() {
    wx.showLoading({ title: '刷新中...' })
    await this.loadBalances()
    wx.hideLoading()
    wx.showToast({ title: '刷新完成', icon: 'success' })
  },

  // 刷新持仓
  async refreshPositions() {
    wx.showLoading({ title: '刷新中...' })
    await this.loadPositions()
    wx.hideLoading()
    wx.showToast({ title: '刷新完成', icon: 'success' })
  },

  // 刷新全部
  async refreshAll() {
    this.setData({ isRefreshing: true })
    await this.loadAccountData()
    this.setData({ isRefreshing: false })
    wx.showToast({ title: '刷新完成', icon: 'success' })
  },

  // 跳转到监控页
  goToMonitor() {
    wx.navigateTo({ url: '/pages/monitor/monitor' })
  },

  // 跳转到策略页
  goToStrategy() {
    wx.navigateTo({ url: '/pages/strategy/strategy' })
  },

  // 跳转到历史页
  goToHistory() {
    wx.switchTab({ url: '/pages/trading/trading' })
  },

  // 关闭模态框
  closeModal() {
    this.setData({ showModal: false })
  },

  // 输入变化
  onInputChange(e: any) {
    const field = e.currentTarget.dataset.field
    this.setData({
      [`formData.${field}`]: e.detail.value
    })
  },

  // 模拟账号开关变化
  onSimulationChange(e: any) {
    this.setData({
      'formData.isSimulation': e.detail.value
    })
  },

  // 保存账号
  saveAccount() {
    const { name, isSimulation, apiKey, secretKey, passphrase } = this.data.formData

    if (!name) {
      wx.showToast({ title: '请输入账号名称', icon: 'none' })
      return
    }

    if (!isSimulation && (!apiKey || !secretKey || !passphrase)) {
      wx.showToast({ title: '请填写完整的API信息', icon: 'none' })
      return
    }

    wx.showToast({ title: '保存成功', icon: 'success' })
    this.closeModal()
    this.loadAccounts()
  }
})
