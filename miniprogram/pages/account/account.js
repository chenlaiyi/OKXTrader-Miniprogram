// pages/account/account.js
const API = require('../../services/api.js');

// 默认用户ID（实际应用中应该从登录状态获取）
const DEFAULT_USER_ID = 'default';

Page({
  data: {
    loading: true,
    refreshing: false,
    // 当前账号
    currentAccount: {
      name: 'xiezong',
      isSimulation: true
    },
    accountInfo: {
      uid: '--',
      level: '--',
      totalEquity: '0.00'
    },
    // 资产列表
    balances: [],
    // 持仓列表
    contractPositions: [],
    // 最近交易
    recentTrades: [],
    // 模态框状态
    showModal: false,
    modalMode: 'add',
    formData: {
      name: '',
      apiKey: '',
      secretKey: '',
      passphrase: '',
      isSimulation: true
    }
  },

  onLoad() {
    this.initData();
  },

  onShow() {
    // 页面显示时刷新数据
    if (!this.data.loading) {
      this.refreshData();
    }
  },

  /**
   * 初始化数据
   */
  async initData() {
    this.setData({ loading: true });

    try {
      // 并行请求所有数据
      await Promise.all([
        this.loadAccountInfo(),
        this.loadBalances(),
        this.loadPositions(),
        this.loadRecentTrades()
      ]);
    } catch (error) {
      console.error('加载账户数据失败:', error);
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      });
    } finally {
      this.setData({ loading: false });
    }
  },

  /**
   * 加载账户信息
   */
  async loadAccountInfo() {
    try {
      const res = await API.getAccounts(DEFAULT_USER_ID);

      if (res.success && res.data && res.data.length > 0) {
        const account = res.data[0];

        this.setData({
          currentAccount: {
            name: account.name,
            isSimulation: account.isSimulation
          },
          accountInfo: {
            uid: account.apiKey?.substring(0, 8) + '...',
            level: account.isSimulation ? '模拟' : '实盘',
            totalEquity: '0.00'
          }
        });
      }
    } catch (error) {
      console.error('加载账户信息失败:', error);
    }
  },

  /**
   * 加载资产列表
   */
  async loadBalances() {
    try {
      const res = await API.getBalance(DEFAULT_USER_ID);

      if (res.success && res.data) {
        const balances = res.data
          .filter(b => parseFloat(b.bal) > 0)
          .map(b => ({
            currency: b.ccy,
            totalDisplay: parseFloat(b.bal).toFixed(4),
            usdValueDisplay: (parseFloat(b.bal) * (b.eqUsd ? parseFloat(b.eqUsd) / parseFloat(b.bal) : 1)).toFixed(2)
          }));

        this.setData({ balances });
      }
    } catch (error) {
      console.error('加载资产失败:', error);
      // 使用模拟数据
      this.setData({
        balances: [
          { currency: 'USDT', totalDisplay: '10000.00', usdValueDisplay: '10000.00' }
        ]
      });
    }
  },

  /**
   * 加载持仓列表
   */
  async loadPositions() {
    try {
      const res = await API.getPositions(DEFAULT_USER_ID);

      if (res.success && res.data) {
        const positions = res.data.map(pos => ({
          posId: pos.posId,
          instId: pos.instId,
          posSide: pos.posSide,
          lever: pos.lever,
          pos: parseFloat(pos.pos).toFixed(4),
          avgPxDisplay: parseFloat(pos.avgPx).toFixed(2),
          upl: parseFloat(pos.upl).toFixed(2),
          uplNum: parseFloat(pos.upl),
          uplDisplay: (parseFloat(pos.upl) >= 0 ? '+' : '') + parseFloat(pos.upl).toFixed(2)
        }));

        this.setData({ contractPositions: positions });
      }
    } catch (error) {
      console.error('加载持仓失败:', error);
      this.setData({ contractPositions: [] });
    }
  },

  /**
   * 加载最近交易
   */
  async loadRecentTrades() {
    try {
      const res = await API.getTradeHistory(DEFAULT_USER_ID, 10);

      if (res.success && res.data) {
        const trades = res.data.map(trade => {
          // 确定操作类型和颜色
          let operationLabel = '';
          let operationClass = '';
          let pnl = 0;

          if (trade.posSide && trade.side === 'close') {
            operationLabel = trade.posSide === 'long' ? '平多' : '平空';
            operationClass = trade.posSide === 'long' ? 'close-long' : 'close-short';
          } else {
            operationLabel = trade.side === 'buy' ? '开多' : '开空';
            operationClass = trade.side === 'buy' ? 'long' : 'short';
          }

          return {
            id: trade.tradeId || trade.instId,
            symbol: trade.instId?.replace('-USDT-SWAP', '').replace('-USDT', ''),
            operationLabel,
            operationClass,
            pnl: parseFloat(trade.pnl || 0),
            pnlDisplay: trade.pnl ? (parseFloat(trade.pnl) >= 0 ? '+' : '') + parseFloat(trade.pnl).toFixed(2) : '0.00',
            sizeDisplay: parseFloat(trade.sz || trade.fillSz || 0).toFixed(4),
            time: this.formatTime(trade.ts || trade.cTime)
          };
        });

        this.setData({ recentTrades: trades });
      }
    } catch (error) {
      console.error('加载交易历史失败:', error);
      this.setData({ recentTrades: [] });
    }
  },

  /**
   * 刷新资产
   */
  async refreshAssets() {
    wx.showLoading({ title: '刷新中...' });
    await this.loadBalances();
    wx.hideLoading();
    wx.showToast({ title: '刷新成功', icon: 'success' });
  },

  /**
   * 刷新持仓
   */
  async refreshPositions() {
    wx.showLoading({ title: '刷新中...' });
    await this.loadPositions();
    wx.hideLoading();
    wx.showToast({ title: '刷新成功', icon: 'success' });
  },

  /**
   * 刷新所有数据
   */
  async refreshAll() {
    this.setData({ refreshing: true });

    try {
      await Promise.all([
        this.loadAccountInfo(),
        this.loadBalances(),
        this.loadPositions(),
        this.loadRecentTrades()
      ]);

      wx.showToast({
        title: '刷新成功',
        icon: 'success'
      });
    } catch (error) {
      console.error('刷新失败:', error);
    } finally {
      this.setData({ refreshing: false });
    }
  },

  /**
   * 下拉刷新
   */
  onPullDownRefresh() {
    this.refreshAll().finally(() => {
      wx.stopPullDownRefresh();
    });
  },

  /**
   * 跳转到交易监控
   */
  goToMonitor() {
    wx.showToast({
      title: '功能开发中',
      icon: 'none'
    });
  },

  /**
   * 跳转到策略管理
   */
  goToStrategy() {
    wx.showToast({
      title: '功能开发中',
      icon: 'none'
    });
  },

  /**
   * 查看更多历史
   */
  goToHistory() {
    wx.showToast({
      title: '功能开发中',
      icon: 'none'
    });
  },

  /**
   * 关闭模态框
   */
  closeModal() {
    this.setData({
      showModal: false
    });
  },

  /**
   * 输入框内容变化
   */
  onInputChange(e) {
    const field = e.currentTarget.dataset.field;
    const value = e.detail.value;

    this.setData({
      [`formData.${field}`]: value
    });
  },

  /**
   * 模拟账号切换
   */
  onSimulationChange(e) {
    const isSimulation = e.detail.value;
    this.setData({
      'formData.isSimulation': isSimulation
    });

    // 如果是模拟账号，清空API密钥
    if (isSimulation) {
      this.setData({
        'formData.apiKey': '',
        'formData.secretKey': '',
        'formData.passphrase': ''
      });
    }
  },

  /**
   * 保存账号
   */
  async saveAccount() {
    const { name, isSimulation, apiKey, secretKey, passphrase } = this.data.formData;

    if (!name.trim()) {
      wx.showToast({
        title: '请输入账号名称',
        icon: 'none'
      });
      return;
    }

    if (!isSimulation && (!apiKey || !secretKey || !passphrase)) {
      wx.showToast({
        title: '请填写完整的API信息',
        icon: 'none'
      });
      return;
    }

    try {
      wx.showLoading({ title: '保存中...' });

      const accountData = {
        userId: DEFAULT_USER_ID,
        name,
        isSimulation,
        apiKey,
        secretKey,
        passphrase,
        remarks: ''
      };

      const res = await API.addAccount(accountData);

      wx.hideLoading();

      if (res.success) {
        this.closeModal();
        wx.showToast({
          title: '账号保存成功',
          icon: 'success'
        });
        // 重新加载账户信息
        await this.loadAccountInfo();
      } else {
        wx.showToast({
          title: res.message || '保存失败',
          icon: 'none'
        });
      }
    } catch (error) {
      wx.hideLoading();
      console.error('保存账号失败:', error);
      wx.showToast({
        title: '保存失败',
        icon: 'none'
      });
    }
  },

  /**
   * 格式化时间
   */
  formatTime(timestamp) {
    if (!timestamp) return '--';

    const date = new Date(parseInt(timestamp));
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const hour = date.getHours().toString().padStart(2, '0');
    const minute = date.getMinutes().toString().padStart(2, '0');

    return `${month}-${day} ${hour}:${minute}`;
  }
});
