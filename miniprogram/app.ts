// app.ts
import { CONFIG } from './utils/config'

App<IAppOption>({
  globalData: {
    userInfo: null,
    currentSymbol: 'ETH-USDT-SWAP',
    autoTradingEnabled: false
  },

  onLaunch() {
    console.log('OKXTrader小程序启动')
    console.log('API地址:', CONFIG.API_BASE)

    // 检查更新
    this.checkUpdate()
  },

  onShow() {
    // 小程序显示时的逻辑
  },

  onHide() {
    // 小程序隐藏时的逻辑
  },

  checkUpdate() {
    if (wx.canIUse('getUpdateManager')) {
      const updateManager = wx.getUpdateManager()

      updateManager.onCheckForUpdate((res) => {
        if (res.hasUpdate) {
          console.log('发现新版本')
        }
      })

      updateManager.onUpdateReady(() => {
        wx.showModal({
          title: '更新提示',
          content: '新版本已准备好，是否重启应用？',
          success: (res) => {
            if (res.confirm) {
              updateManager.applyUpdate()
            }
          }
        })
      })

      updateManager.onUpdateFailed(() => {
        wx.showModal({
          title: '更新失败',
          content: '新版本下载失败，请检查网络',
          showCancel: false
        })
      })
    }
  }
})
