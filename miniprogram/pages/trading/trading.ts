// pages/trading/trading.ts
import { apiService } from '../../services/api'

interface FillData {
  id: string
  symbol: string
  instId: string
  instType: string
  side: string
  posSide?: string
  lever?: string
  fillSz: string
  fillPx: string
  fee: string
  pnl?: string
  fillPnl?: string
  ts: string
  clOrdId?: string
}

interface PositionData {
  posId: string
  instId: string
  posSide: string
  pos: string
  avgPx: string
  lever: string
  upl?: string
  uplNum?: number
  uplDisplay?: string
}

Page({
  data: {
    // Tab 状态
    selectedTab: 0,
    refreshing: false,

    // 盈亏统计
    totalPnl: 0,
    totalPnlDisplay: '0.00',
    totalTradeCount: 0,
    todayPnl: 0,
    todayPnlDisplay: '0.00',
    todayTradeCount: 0,
    yesterdayPnl: 0,
    yesterdayPnlDisplay: '0.00',
    yesterdayTradeCount: 0,
    weekPnl: 0,
    weekPnlDisplay: '0.00',
    weekTradeCount: 0,

    // 成交记录
    fillHistory: [] as any[],

    // 持仓列表
    positions: [] as PositionData[]
  },

  onLoad() {
    this.loadData()
  },

  onShow() {
    this.loadData()
  },

  // 加载所有数据
  async loadData() {
    await Promise.all([
      this.loadFillHistory(),
      this.loadPositions()
    ])
    this.calculatePnlStats()
  },

  // 加载成交记录
  async loadFillHistory() {
    try {
      const fills = await apiService.getFillHistory()
      const fillHistory = fills.map((fill: FillData) => this.formatFillData(fill))
      this.setData({ fillHistory })
    } catch (error) {
      console.error('加载成交记录失败:', error)
      // 使用模拟数据
      this.setData({ fillHistory: this.getMockFillHistory() })
    }
  },

  // 格式化成交数据
  formatFillData(fill: FillData) {
    const timestamp = parseFloat(fill.ts) / 1000
    const date = new Date(timestamp)
    const time = `${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`

    // 获取币种符号
    const parts = fill.instId.split('-')
    const symbol = parts[0] || fill.instId

    // 判断操作类型
    let operationLabel = fill.side === 'buy' ? '买入' : '卖出'
    let operationClass = fill.side === 'buy' ? 'buy' : 'sell'

    if (fill.instType === 'SWAP' && fill.posSide) {
      if (fill.posSide === 'long') {
        operationLabel = fill.side === 'buy' ? '开多' : '平多'
        operationClass = fill.side === 'buy' ? 'long' : 'close-long'
      } else {
        operationLabel = fill.side === 'sell' ? '开空' : '平空'
        operationClass = fill.side === 'sell' ? 'short' : 'close-short'
      }
    }

    // 判断交易来源
    const source = fill.clOrdId?.startsWith('OKXT') ? 'API' : '后台'
    const sourceClass = fill.clOrdId?.startsWith('OKXT') ? 'api' : 'manual'

    // 盈亏
    const pnlStr = fill.fillPnl || fill.pnl || '0'
    const pnl = parseFloat(pnlStr)
    const pnlDisplay = Math.abs(pnl).toFixed(2)

    // 数量
    const sizeDisplay = parseFloat(fill.fillSz).toFixed(4)

    // 手续费
    const fee = Math.abs(parseFloat(fill.fee))
    const feeDisplay = fee.toFixed(4)

    return {
      id: fill.ts,
      symbol,
      instId: fill.instId,
      instType: fill.instType,
      side: fill.side,
      posSide: fill.posSide,
      time,
      timestamp,
      operationLabel,
      operationClass,
      source,
      sourceClass,
      leverage: fill.instType === 'SWAP' ? fill.lever : null,
      exitReason: (fill as any).exitReason || '',
      pnl,
      pnlDisplay,
      sizeDisplay,
      feeDisplay
    }
  },

  // 获取模拟成交记录
  getMockFillHistory() {
    const now = Date.now()
    return [
      {
        id: '1',
        symbol: 'BTC',
        time: '01-12 14:30',
        timestamp: now - 3600000,
        operationLabel: '开多',
        operationClass: 'long',
        source: 'API',
        sourceClass: 'api',
        leverage: '3',
        pnl: 15.8,
        pnlDisplay: '15.80',
        sizeDisplay: '0.0100',
        feeDisplay: '0.0032'
      },
      {
        id: '2',
        symbol: 'ETH',
        time: '01-12 12:15',
        timestamp: now - 10800000,
        operationLabel: '平多',
        operationClass: 'close-long',
        source: 'API',
        sourceClass: 'api',
        leverage: '5',
        pnl: -8.5,
        pnlDisplay: '8.50',
        sizeDisplay: '0.1500',
        feeDisplay: '0.0158'
      },
      {
        id: '3',
        symbol: 'SOL',
        time: '01-11 22:45',
        timestamp: now - 50400000,
        operationLabel: '买入',
        operationClass: 'buy',
        source: '后台',
        sourceClass: 'manual',
        leverage: null,
        pnl: 0,
        pnlDisplay: '0.00',
        sizeDisplay: '2.5000',
        feeDisplay: '0.0250'
      }
    ]
  },

  // 加载持仓
  async loadPositions() {
    try {
      const positions = await apiService.getPositions()
      const formattedPositions = positions.map((pos: any) => {
        const uplNum = parseFloat(pos.upl || '0')
        return {
          ...pos,
          uplNum,
          uplDisplay: Math.abs(uplNum).toFixed(2)
        }
      })
      this.setData({ positions: formattedPositions })
    } catch (error) {
      console.error('加载持仓失败:', error)
      // 使用模拟数据
      this.setData({ positions: this.getMockPositions() })
    }
  },

  // 获取模拟持仓
  getMockPositions(): PositionData[] {
    return [
      {
        posId: '1',
        instId: 'BTC-USDT-SWAP',
        posSide: 'long',
        pos: '0.01',
        avgPx: '42500.00',
        lever: '3',
        uplNum: 125.5,
        uplDisplay: '125.50'
      },
      {
        posId: '2',
        instId: 'ETH-USDT-SWAP',
        posSide: 'short',
        pos: '0.5',
        avgPx: '2350.00',
        lever: '5',
        uplNum: -35.2,
        uplDisplay: '35.20'
      }
    ]
  },

  // 计算盈亏统计（净盈亏 = 已实现盈亏 + 手续费）
  calculatePnlStats() {
    const fills = this.data.fillHistory
    const now = new Date()

    // 今日开始时间
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() / 1000
    // 昨日开始时间
    const yesterdayStart = todayStart - 86400
    // 本周开始时间 (周一)
    const dayOfWeek = now.getDay() || 7
    const weekStart = todayStart - (dayOfWeek - 1) * 86400

    let totalPnl = 0
    let totalFee = 0
    let totalTradeCount = 0
    let todayPnl = 0
    let todayFee = 0
    let todayTradeCount = 0
    let yesterdayPnl = 0
    let yesterdayFee = 0
    let yesterdayTradeCount = 0
    let weekPnl = 0
    let weekFee = 0
    let weekTradeCount = 0

    fills.forEach((fill: any) => {
      const ts = fill.timestamp
      const pnl = fill.pnl || 0
      // 手续费是负数，直接累加即可
      const fee = parseFloat(fill.feeDisplay) ? -Math.abs(parseFloat(fill.feeDisplay)) : 0

      // 总计（累加所有交易的盈亏和手续费）
      totalPnl += pnl
      totalFee += fee
      totalTradeCount++

      // 今日
      if (ts >= todayStart) {
        todayPnl += pnl
        todayFee += fee
        todayTradeCount++
      }
      // 昨日
      else if (ts >= yesterdayStart && ts < todayStart) {
        yesterdayPnl += pnl
        yesterdayFee += fee
        yesterdayTradeCount++
      }

      // 本周
      if (ts >= weekStart) {
        weekPnl += pnl
        weekFee += fee
        weekTradeCount++
      }
    })

    // 计算净盈亏（已实现盈亏 + 手续费）
    const totalNetPnl = totalPnl + totalFee
    const todayNetPnl = todayPnl + todayFee
    const yesterdayNetPnl = yesterdayPnl + yesterdayFee
    const weekNetPnl = weekPnl + weekFee

    this.setData({
      totalPnl: totalNetPnl,
      totalPnlDisplay: totalNetPnl.toFixed(2),
      totalTradeCount,
      todayPnl: todayNetPnl,
      todayPnlDisplay: todayNetPnl.toFixed(2),
      todayTradeCount,
      yesterdayPnl: yesterdayNetPnl,
      yesterdayPnlDisplay: yesterdayNetPnl.toFixed(2),
      yesterdayTradeCount,
      weekPnl: weekNetPnl,
      weekPnlDisplay: weekNetPnl.toFixed(2),
      weekTradeCount
    })
  },

  // 切换Tab
  switchTab(e: any) {
    const tab = parseInt(e.currentTarget.dataset.tab)
    this.setData({ selectedTab: tab })
  },

  // 刷新数据
  async onRefresh() {
    this.setData({ refreshing: true })
    await this.loadData()
    this.setData({ refreshing: false })
    wx.showToast({ title: '刷新完成', icon: 'success' })
  }
})
