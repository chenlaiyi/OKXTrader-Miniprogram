// pages/news-detail/news-detail.js
const API = require('../../services/api.js');

Page({
  data: {
    loading: true,
    error: false,
    errorMsg: '',
    news: null
  },

  onLoad(options) {
    if (options.id) {
      this.loadNewsDetail(options.id);
    } else {
      this.setData({
        loading: false,
        error: true,
        errorMsg: '缺少新闻ID'
      });
    }
  },

  loadNewsDetail(id) {
    var that = this;
    this.setData({ loading: true, error: false, errorMsg: '' });

    API.getNewsDetail(id).then(function(res) {
      if (res && res.success && res.data) {
        that.setData({
          news: res.data,
          loading: false
        });
        // 设置页面标题
        wx.setNavigationBarTitle({
          title: res.data.typeName || '新闻详情'
        });
      } else {
        that.setData({
          loading: false,
          error: true,
          errorMsg: '新闻不存在或已过期'
        });
      }
    }).catch(function(err) {
      console.error('加载新闻详情失败:', err);
      var msg = '加载失败';
      if (err && err.message) {
        if (err.message.indexOf('不存在') >= 0) {
          msg = '新闻不存在或已过期';
        } else {
          msg = err.message;
        }
      }
      that.setData({
        loading: false,
        error: true,
        errorMsg: msg
      });
    });
  },

  onRetry() {
    var options = this.options || {};
    if (options.id) {
      this.loadNewsDetail(options.id);
    }
  },

  onGoBack() {
    wx.navigateBack({
      fail: function() {
        // 如果无法返回，跳转到行情页
        wx.switchTab({
          url: '/pages/market/market'
        });
      }
    });
  },

  onCopyLink() {
    var news = this.data.news;
    if (news && news.url) {
      wx.setClipboardData({
        data: news.url,
        success: function() {
          wx.showToast({
            title: '链接已复制',
            icon: 'success'
          });
        }
      });
    }
  },

  onShareAppMessage() {
    var news = this.data.news;
    return {
      title: news ? news.title : '加密货币快讯',
      path: '/pages/news-detail/news-detail?id=' + (news ? news.id : '')
    };
  }
});
