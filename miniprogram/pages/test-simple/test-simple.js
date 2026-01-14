// pages/test-simple/test-simple.js
Page({
  data: {
    result: '等待测试...'
  },

  onLoad: function() {
    console.log('========== 简单测试页面加载 ==========');
    this.testWxRequest();
  },

  testWxRequest: function() {
    console.log('📌 步骤1: 准备调用wx.request');
    var that = this;

    that.setData({ result: '步骤1: 准备调用wx.request' });

    // 测试方案1: 使用百度API（HTTPS）
    console.log('========== 测试1: 百度API ==========');
    wx.request({
      url: 'https://www.baidu.com',
      method: 'GET',
      success: function(res) {
        console.log('✅✅✅ 百度API SUCCESS!', res.statusCode);
        that.setData({ result: '百度API成功! 状态码: ' + res.statusCode });
      },
      fail: function(err) {
        console.error('❌❌❌ 百度API FAIL!', err);
      },
      complete: function() {
        console.log('⚠️⚠️⚠ 百度API COMPLETE');
      }
    });

    // 测试方案2: 你的API（添加timeout）
    setTimeout(function() {
      console.log('========== 测试2: 你的API（带timeout） ==========');
      wx.request({
        url: 'https://ly.ddg.org.cn/api/markets?instType=SPOT',
        method: 'GET',
        dataType: 'json',
        timeout: 10000,
        header: {
          'content-type': 'application/json'
        },
        success: function(res) {
          console.log('✅✅✅ 你的API SUCCESS!', res);
          that.setData({
            result: '成功! 数据: ' + JSON.stringify(res.data).substring(0, 50) + '...'
          });
        },
        fail: function(err) {
          console.error('❌❌❌ 你的API FAIL!', err);
          that.setData({ result: '失败: ' + JSON.stringify(err) });
        },
        complete: function() {
          console.log('⚠️⚠️⚠ 你的API COMPLETE');
        }
      });
    }, 2000);
  }
});
