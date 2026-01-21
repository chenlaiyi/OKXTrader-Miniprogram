// pages/trading/trading.js
const API = require('../../services/api.js');

// 默认用户ID（未登录时使用）
const DEFAULT_USER_ID = 'default';

function getCurrentUserId() {
  const userInfo = wx.getStorageSync('userInfo');
  if (userInfo && userInfo.id) {
    return userInfo.id;
  }
  // 未登录时使用默认用户ID
  return DEFAULT_USER_ID;
}

function getCurrentAccountId() {
  const account = wx.getStorageSync('currentAccount');
  if (!account || !account.id) return null;
  // 注意：accountId 不能是 'default'，因为服务器端按 id 字段查询
  // 真实的 accountId 格式如 'xiezong-default-001'
  if (account.id === 'default' || account.id === DEFAULT_USER_ID) return null;
  return account.id;
}

Page({
  data: {
    selectedTab: 0,
    currentAccountId: null,  // 当前账号ID
    currentUserId: null,     // 当前用户ID
    missingAccountNotified: false,

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

    // 状态
    refreshing: false,
    loading: true,

    // 数据
    fillHistory: [],
    positions: []
  },

  // 定时器
  autoRefreshTimer: null,

  onLoad() {
    this.syncAccountContext();
    this.loadData();
  },

  onShow() {
    // 页面显示时刷新数据
    if (!this.data.loading) {
      this.syncAccountContext();
      this.loadData();
    }

    // 启动自动刷新（每10秒刷新一次）
    if (!this.autoRefreshTimer) {
      console.log('🔄 启动交易页面自动刷新（10秒间隔）');
      this.autoRefreshTimer = setInterval(() => {
        console.log('📍 自动刷新交易数据...');
        this.loadData();
      }, 10000);
    }
  },

  onHide() {
    // 页面隐藏时清除定时器
    if (this.autoRefreshTimer) {
      clearInterval(this.autoRefreshTimer);
      this.autoRefreshTimer = null;
      console.log('⏹️ 页面隐藏，停止交易页面刷新');
    }
  },

  onUnload() {
    // 页面卸载时清除定时器
    if (this.autoRefreshTimer) {
      clearInterval(this.autoRefreshTimer);
      this.autoRefreshTimer = null;
    }
  },

  onPullDownRefresh() {
    this.loadData().finally(() => {
      wx.stopPullDownRefresh();
    });
  },

  /**
   * 同步当前账号/用户ID
   */
  syncAccountContext() {
    const accountId = getCurrentAccountId();
    const userId = getCurrentUserId();

    if (accountId) {
      console.log('✅ 使用当前账号:', accountId);
    } else if (userId) {
      console.log('✅ 未选择账号，使用用户ID加载:', userId);
    } else {
      console.warn('⚠️ 未登录或未选择账号，暂不请求交易数据');
    }

    this.setData({
      currentAccountId: accountId,
      currentUserId: userId,
      missingAccountNotified: accountId || userId ? false : this.data.missingAccountNotified
    });

    return { accountId, userId };
  },

  /**
   * 无有效账号/用户时的兜底处理
   */
  handleMissingAccount() {
    if (!this.data.missingAccountNotified) {
      this.setData({ missingAccountNotified: true });
      wx.showToast({
        title: '请先登录或选择账号',
        icon: 'none'
      });
    }
    this.setData({
      loading: false,
      fillHistory: [],
      positions: []
    });
  },

  /**
   * 加载数据
   */
  async loadData() {
    const { accountId, userId } = this.syncAccountContext();
    if (!accountId && !userId) {
      this.handleMissingAccount();
      return;
    }

    try {
      await Promise.all([
        this.loadFills(accountId, userId),
        this.loadPositions(accountId, userId)
      ]);
    } catch (error) {
      console.error('加载交易数据失败:', error);
    } finally {
      this.setData({ loading: false });
    }
  },

  /**
   * 加载成交记录
   */
  async loadFills(accountId, userId) {
    try {
      const resolvedAccountId = accountId || this.data.currentAccountId;
      const resolvedUserId = userId || this.data.currentUserId;
      if (!resolvedAccountId && !resolvedUserId) {
        this.handleMissingAccount();
        return;
      }
      console.log('📊 加载成交记录,账号/用户:', resolvedAccountId || resolvedUserId);

      const queryKey = resolvedAccountId ? 'accountId' : 'userId';
      const queryValue = resolvedAccountId || resolvedUserId;

      const res = await new Promise((resolve, reject) => {
        wx.request({
          url: `https://ly.ddg.org.cn/api/trading/fills?${queryKey}=${queryValue}&instType=SWAP&limit=50`,
          method: 'GET',
          header: { 'content-type': 'application/json' },
          success: (res) => resolve(res.data),
          fail: reject
        });
      });

      if (res.success && res.data) {
        const fills = res.data;

        // 格式化成交记录
        const fillHistory = fills.map(f => {
          // 判断操作类型
          let operationLabel = '';
          let operationClass = '';
          if (f.posSide === 'long') {
            operationLabel = f.side === 'buy' ? '开多' : '平多';
            operationClass = f.side === 'buy' ? 'open-long' : 'close-long';
          } else if (f.posSide === 'short') {
            operationLabel = f.side === 'sell' ? '开空' : '平空';
            operationClass = f.side === 'sell' ? 'open-short' : 'close-short';
          } else {
            operationLabel = f.side === 'buy' ? '买入' : '卖出';
            operationClass = f.side === 'buy' ? 'buy' : 'sell';
          }

          // 来源判断
          let source = '手动';
          let sourceClass = 'manual';
          if (f.ordType === 'market') {
            source = 'AI';
            sourceClass = 'ai';
          }

          return {
            id: f.id,
            symbol: f.symbol ? f.symbol.replace('-USDT-SWAP', '') : '',
            operationLabel,
            operationClass,
            source,
            sourceClass,
            leverage: f.leverage,
            time: this.formatTime(f.fillTime),
            rawTime: f.fillTime,  // 保留原始时间用于统计计算
            exitReason: f.exitReason || '',
            price: f.price,  // 成交价格
            priceDisplay: f.price ? f.price.toFixed(2) : '--',
            pnl: f.pnl,
            pnlDisplay: f.pnl ? f.pnl.toFixed(2) : '0.00',
            size: f.size,
            sizeDisplay: f.size ? f.size.toFixed(4) : '0',
            fee: Math.abs(f.fee || 0),
            feeDisplay: Math.abs(f.fee || 0).toFixed(4)
          };
        });

        // 计算盈亏统计
        this.calculatePnlStats(fillHistory);

        this.setData({ fillHistory });
      }
    } catch (error) {
      console.error('加载成交记录失败:', error);
    }
  },

  /**
   * 加载持仓
   */
  async loadPositions(accountId, userId) {
    try {
      const resolvedAccountId = accountId || this.data.currentAccountId;
      const resolvedUserId = userId || this.data.currentUserId;
      if (!resolvedAccountId && !resolvedUserId) {
        this.handleMissingAccount();
        return;
      }
      console.log('📊 加载持仓,账号/用户:', resolvedAccountId || resolvedUserId);

      const queryKey = resolvedAccountId ? 'accountId' : 'userId';
      const queryValue = resolvedAccountId || resolvedUserId;

      const res = await new Promise((resolve, reject) => {
        wx.request({
          url: `https://ly.ddg.org.cn/api/trading/positions?${queryKey}=${queryValue}`,
          method: 'GET',
          header: { 'content-type': 'application/json' },
          success: (res) => resolve(res.data),
          fail: reject
        });
      });

      if (res.success && res.data) {
        const positions = res.data.map(p => {
          const uplNum = p.unrealizedPnl || 0;
          const entryPrice = p.entryPrice || 0;
          const size = p.size || 0;
          // 计算盈亏百分比 = 盈亏金额 / (入场价格 * 数量) * 100
          const notional = entryPrice * Math.abs(size);
          const uplRatio = notional > 0 ? (uplNum / notional) * 100 : 0;

          return {
            posId: p.id,
            instId: p.symbol ? p.symbol.replace('-USDT-SWAP', '') : '',
            posSide: p.side,
            pos: p.size,
            avgPx: entryPrice ? entryPrice.toFixed(2) : '--',
            lever: p.leverage,
            uplNum: uplNum,
            uplDisplay: uplNum.toFixed(2),
            uplRatio: uplRatio,
            uplRatioDisplay: uplRatio.toFixed(2)
          };
        });

        this.setData({ positions });
      }
    } catch (error) {
      console.error('加载持仓失败:', error);
      this.setData({ positions: [] });
    }
  },

  /**
   * 计算盈亏统计
   */
  calculatePnlStats(fills) {
    const now = new Date();
    // 使用北京时间计算今日开始（UTC+8）
    const chinaOffset = 8 * 60 * 60 * 1000;
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const yesterdayStart = todayStart - 24 * 60 * 60 * 1000;
    const weekStart = todayStart - 7 * 24 * 60 * 60 * 1000;

    let totalPnl = 0;
    let totalCount = 0;
    let todayPnl = 0;
    let todayCount = 0;
    let yesterdayPnl = 0;
    let yesterdayCount = 0;
    let weekPnl = 0;
    let weekCount = 0;

    fills.forEach(f => {
      // 只统计有盈亏的交易（平仓交易）
      if (f.pnl && f.pnl !== 0) {
        totalPnl += f.pnl;
        totalCount++;

        // 使用原始时间进行统计
        const fillTime = f.rawTime ? new Date(f.rawTime).getTime() : 0;

        if (fillTime > 0) {
          if (fillTime >= todayStart) {
            todayPnl += f.pnl;
            todayCount++;
          } else if (fillTime >= yesterdayStart && fillTime < todayStart) {
            yesterdayPnl += f.pnl;
            yesterdayCount++;
          }

          if (fillTime >= weekStart) {
            weekPnl += f.pnl;
            weekCount++;
          }
        }
      }
    });

    console.log('盈亏统计:', {
      totalPnl, totalCount,
      todayPnl, todayCount,
      yesterdayPnl, yesterdayCount,
      weekPnl, weekCount
    });

    this.setData({
      totalPnl,
      totalPnlDisplay: this.formatPnl(totalPnl),
      totalTradeCount: totalCount,
      todayPnl,
      todayPnlDisplay: this.formatPnl(todayPnl),
      todayTradeCount: todayCount,
      yesterdayPnl,
      yesterdayPnlDisplay: this.formatPnl(yesterdayPnl),
      yesterdayTradeCount: yesterdayCount,
      weekPnl,
      weekPnlDisplay: this.formatPnl(weekPnl),
      weekTradeCount: weekCount
    });
  },

  /**
   * 格式化盈亏显示
   */
  formatPnl(pnl) {
    if (!pnl) return '0.00';
    const prefix = pnl >= 0 ? '+' : '';
    return prefix + pnl.toFixed(2);
  },

  /**
   * 格式化时间
   */
  formatTime(timestamp) {
    if (!timestamp) return '--';
    const date = new Date(timestamp);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const hour = date.getHours().toString().padStart(2, '0');
    const minute = date.getMinutes().toString().padStart(2, '0');
    return `${month}-${day} ${hour}:${minute}`;
  },

  /**
   * 切换Tab
   */
  switchTab(e) {
    const tab = parseInt(e.currentTarget.dataset.tab);
    this.setData({ selectedTab: tab });
  },

  /**
   * 刷新数据
   */
  onRefresh() {
    this.setData({ refreshing: true });
    this.loadData().then(() => {
      this.setData({ refreshing: false });
      wx.showToast({
        title: '刷新成功',
        icon: 'success'
      });
    });
  },

  /**
   * 下拉刷新
   */
  onPullDownRefresh() {
    this.loadData().finally(() => {
      wx.stopPullDownRefresh();
    });
  }
});
