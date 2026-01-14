// pages/ai/ai.js
Page({

  /**
   * 页面的初始数据
   */
  data: {
    // 策略状态
    currentStrategy: {
      emoji: '🚀',
      name: '趋势跟踪策略'
    },
    tradingStyle: 'conservative', // 'aggressive' or 'conservative'

    // 核心参数
    takeProfitPercent: 5,
    stopLossPercent: 3,
    leverage: 10,
    confidenceThreshold: 80,
    analysisInterval: 5,

    // 自动交易设置
    autoTradeEnabled: false,
    autoAnalysisEnabled: false,
    isAnalyzing: false,

    // 当前分析结果
    currentAnalysis: null,
    analysisTime: '',

    // 持仓数据
    apiPositions: [],

    // 分析历史
    historyList: [],
    buyCount: 0,
    sellCount: 0,
    holdCount: 0
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
    this.loadData();
  },

  /**
   * 加载数据
   */
  async loadData() {
    // TODO: 从API加载真实数据
    // 这里清空所有演示数据，初始状态为空
    this.setData({
      apiPositions: [],
      historyList: [],
      currentAnalysis: null,
      buyCount: 0,
      sellCount: 0,
      holdCount: 0
    });
  },

  /**
   * 生命周期函数--监听页面初次渲染完成
   */
  onReady() {

  },

  /**
   * 生命周期函数--监听页面显示
   */
  onShow() {

  },

  /**
   * 生命周期函数--监听页面隐藏
   */
  onHide() {

  },

  /**
   * 生命周期函数--监听页面卸载
   */
  onUnload() {
    // 清除定时器
    if (this.autoAnalysisInterval) {
      clearInterval(this.autoAnalysisInterval);
    }
  },

  /**
   * 页面相关事件处理函数--监听用户下拉动作
   */
  onPullDownRefresh() {
    this.loadData().then(() => {
      wx.stopPullDownRefresh();
    });
  },

  /**
   * 页面上拉触底事件的处理函数
   */
  onReachBottom() {

  },

  /**
   * 用户点击右上角分享
   */
  onShareAppMessage() {

  },

  /**
   * 切换自动交易
   */
  toggleAutoTrade(e) {
    const enabled = e.detail.value;
    this.setData({
      autoTradeEnabled: enabled
    });
    if (enabled) {
      wx.showToast({
        title: '自动交易已开启',
        icon: 'success'
      });
    }
  },

  /**
   * 开始AI分析
   */
  startAnalysis() {
    if (this.data.isAnalyzing) return;

    this.setData({
      isAnalyzing: true
    });

    // TODO: 调用真实的AI分析API
    wx.showLoading({
      title: '分析中...'
    });

    // 模拟API调用延迟
    setTimeout(() => {
      wx.hideLoading();

      // 暂时显示提示，等待真实API
      wx.showToast({
        title: 'AI分析功能开发中',
        icon: 'none'
      });

      this.setData({
        isAnalyzing: false
      });
    }, 1500);
  },

  /**
   * 切换自动分析
   */
  toggleAutoAnalysis() {
    const enabled = !this.data.autoAnalysisEnabled;
    this.setData({
      autoAnalysisEnabled: enabled
    });

    wx.showToast({
      title: enabled ? '自动分析已开启' : '自动分析已停止',
      icon: 'success'
    });

    if (enabled) {
      // 开始定时分析
      this.autoAnalysisInterval = setInterval(() => {
        this.startAnalysis();
      }, this.data.analysisInterval * 60 * 1000);
    } else {
      // 清除定时器
      if (this.autoAnalysisInterval) {
        clearInterval(this.autoAnalysisInterval);
        this.autoAnalysisInterval = null;
      }
    }
  },

  /**
   * 刷新持仓
   */
  refreshPositions() {
    wx.showLoading({
      title: '刷新中...'
    });

    // TODO: 从API刷新持仓数据
    setTimeout(() => {
      wx.hideLoading();
      wx.showToast({
        title: '刷新成功',
        icon: 'success'
      });
    }, 1000);
  },

  /**
   * 查看历史详情
   */
  viewHistoryDetail(e) {
    const item = e.currentTarget.dataset.item;
    wx.showModal({
      title: '分析详情',
      content: `时间: ${item.time}\n品种: ${item.symbol}\n信号: ${item.signalText}\n置信度: ${item.confidence}%`,
      showCancel: false
    });
  }
})