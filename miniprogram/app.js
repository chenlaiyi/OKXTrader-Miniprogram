// app.js
App({
  globalData: {
    userInfo: null,
    userId: 'default',  // 默认用户ID (对应数据库中的user_id)
    currentSymbol: 'ETH-USDT',
    autoTradingEnabled: false,
    isConnected: true,
    selectedPair: null,
    historyDetailData: null  // ✅ 添加历史详情数据属性
  },

  onLaunch() {
    console.log('🚀 OKly小程序启动')
    console.log('📡 API地址: https://ly.ddg.org.cn/api')

    // 检查登录状态
    this.checkLoginStatus()

    // 展示本地存储能力
    var logs = wx.getStorageSync('logs') || []
    logs.unshift(Date.now())
    wx.setStorageSync('logs', logs)

    // 检查更新
    this.checkUpdate()
  },

  onShow() {
    console.log('✅ 小程序显示')
  },

  onHide() {
    // 小程序隐藏时的逻辑
  },

  /**
   * 检查登录状态
   */
  checkLoginStatus() {
    const token = wx.getStorageSync('token')
    const userInfo = wx.getStorageSync('userInfo')

    // 验证token和userInfo的完整性
    if (token && userInfo && userInfo.id && userInfo.nickname) {
      console.log('✅ 用户已登录:', userInfo.nickname)

      // 保存到全局数据
      this.globalData.userInfo = userInfo
      this.globalData.userId = userInfo.id || 'default'

      // 跳转到账户页面（延迟一下，确保页面加载完成）
      setTimeout(() => {
        wx.switchTab({
          url: '/pages/account/account'
        })
      }, 500)
    } else {
      console.log('📝 用户未登录或信息不完整，停留在首页')
      if (userInfo) {
        console.log('userInfo信息:', userInfo)
      }
    }
  },

  checkUpdate() {
    if (wx.canIUse('getUpdateManager')) {
      var updateManager = wx.getUpdateManager()

      updateManager.onCheckForUpdate(function(res) {
        if (res.hasUpdate) {
          console.log('🆕 发现新版本')
        }
      })

      updateManager.onUpdateReady(function() {
        wx.showModal({
          title: '更新提示',
          content: '新版本已准备好，是否重启应用？',
          success: function(res) {
            if (res.confirm) {
              updateManager.applyUpdate()
            }
          }
        })
      })

      updateManager.onUpdateFailed(function() {
        wx.showModal({
          title: '更新失败',
          content: '新版本下载失败，请检查网络',
          showCancel: false
        })
      })
    }
  }
})
