// pages/trading/trading.js
const API = require('../../services/api.js');

Page({
  data: {
    selectedTab: 0,
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
    refreshing: false,
    fillHistory: [],
    positions: []
  },

  onLoad() {
    this.loadData();
  },

  async loadData() {
    // TODO: 从API加载交易数据
    // 这里可以调用API获取真实的成交记录和持仓数据
  },

  switchTab(e) {
    const tab = parseInt(e.currentTarget.dataset.tab);
    this.setData({ selectedTab: tab });
  },

  onRefresh() {
    this.setData({ refreshing: true });
    this.loadData().then(() => {
      this.setData({ refreshing: false });
      wx.showToast({
        title: '刷新成功',
        icon: 'success'
      });
    });
  }
});
