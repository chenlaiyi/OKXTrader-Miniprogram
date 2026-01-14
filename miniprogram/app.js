// app.js
App({
  globalData: {
    userInfo: null,
    currentSymbol: 'ETH-USDT',
    autoTradingEnabled: false,
    isConnected: true,
    selectedPair: null
  },

  onLaunch() {
    console.log('🚀 OKly小程序启动')
    console.log('📡 API地址: https://ly.ddg.org.cn/api')

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
