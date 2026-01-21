// pages/news-detail/news-detail.js
const API = require('../../services/api.js');

Page({
  data: {
    loading: true,
    error: false,
    news: null
  },

  onLoad(options) {
    if (options.id) {
      this.loadNewsDetail(options.id);
    } else {
      this.setData({
        loading: false,
        error: true
      });
    }
  },

  loadNewsDetail(id) {
    var that = this;
    this.setData({ loading: true, error: false });

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
          error: true
        });
      }
    }).catch(function(err) {
      console.error('加载新闻详情失败:', err);
      that.setData({
        loading: false,
        error: true
      });
    });
  },

  onRetry() {
    var options = this.options || {};
    if (options.id) {
      this.loadNewsDetail(options.id);
    }
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
