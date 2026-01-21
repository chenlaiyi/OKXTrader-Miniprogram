// pages/history-detail/history-detail.js
Page({
  data: {
    time: '',
    symbol: '',
    signalText: '',
    signalClass: '',
    confidence: 0,
    strategyLabel: '',
    reasoning: '',
    positionAnalysis: '',
    suggestedPrice: '--',
    stopLoss: '--',
    takeProfit: '--'
  },

  onLoad(options) {
    console.log('📄 详情页 onLoad，options:', options);

    // ✅ 从 getApp().historyDetailData 获取数据
    const app = getApp();
    const detailData = app.historyDetailData;

    console.log('📊 从 app.historyDetailData 获取数据:', detailData);

    if (detailData) {
      this.setData({
        time: detailData.time,
        symbol: detailData.symbol,
        signalText: detailData.signalText,
        signalClass: detailData.signalClass,
        confidence: detailData.confidence,
        strategyLabel: detailData.strategyLabel || '',
        reasoning: detailData.reasoning,
        positionAnalysis: detailData.positionAnalysis,
        suggestedPrice: detailData.suggestedPrice,
        stopLoss: detailData.stopLoss,
        takeProfit: detailData.takeProfit
      });

      console.log('✅ 数据已设置到页面 data:', this.data);
    } else {
      console.error('❌ app.historyDetailData 不存在或为空');

      wx.showModal({
        title: '提示',
        content: '详情数据加载失败',
        showCancel: false
      });
    }
  },

  /**
   * 返回上一页
   */
  goBack() {
    wx.navigateBack();
  },

  /**
   * 复制内容
   */
  copyContent() {
    const content = `分析时间: ${this.data.time}\n` +
                   `品种: ${this.data.symbol}\n` +
                   `策略: ${this.data.strategyLabel || '未知'}\n` +
                   `信号: ${this.data.signalText}\n` +
                   `置信度: ${this.data.confidence}%\n\n` +
                   `分析理由:\n${this.data.reasoning}\n\n` +
                   `持仓分析:\n${this.data.positionAnalysis}`;

    wx.setClipboardData({
      data: content
    });

    wx.showToast({
      title: '已复制',
      icon: 'success'
    });
  }
});
