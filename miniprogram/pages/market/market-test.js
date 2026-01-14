// 简单测试页面 - 直接调用API
Page({
  data: {
    loading: true,
    result: null,
    error: null
  },

  onLoad() {
    this.testAPI();
  },

  async testAPI() {
    console.log('=== 开始测试API ===');
    const that = this;
    const startTime = Date.now();

    // 设置超时检测
    const timeoutId = setTimeout(() => {
      console.error('❌ 请求超时（10秒无响应）');
      that.setData({
        loading: false,
        error: '请求超时，请检查网络或域名配置'
      });
    }, 10000);

    // 直接使用wx.request
    wx.request({
      url: 'https://ly.ddg.org.cn/api/markets?instType=SPOT',
      method: 'GET',
      timeout: 15000,
      success: (res) => {
        clearTimeout(timeoutId);
        const duration = Date.now() - startTime;
        console.log('✅ wx.request成功，耗时:' + duration + 'ms');
        console.log('✅ 状态码:', res.statusCode);
        console.log('✅ 数据条数:', res.data?.data?.length || 0);
        that.setData({
          loading: false,
          result: '请求成功！\n状态码: ' + res.statusCode + '\n数据条数: ' + (res.data?.data?.length || 0) + '\n耗时: ' + duration + 'ms'
        });
      },
      fail: (err) => {
        clearTimeout(timeoutId);
        console.error('❌ wx.request失败:', err);
        that.setData({
          loading: false,
          error: '请求失败: ' + JSON.stringify(err)
        });
      },
      complete: (res) => {
        console.log('⚪ complete回调执行，结果:', res);
      }
    });

    console.log('=== wx.request已调用 ===');
  }
});
