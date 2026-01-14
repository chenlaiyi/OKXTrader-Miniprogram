// app.ts
import { CONFIG } from './utils/config'
import { accountService } from './services/account'
import { autoTradingEngine } from './services/auto-trading'
import { aiAnalysisService } from './services/ai-analysis'

App<IAppOption>({
  globalData: {
    userInfo: null,
    currentSymbol: 'ETH-USDT-SWAP',
    autoTradingEnabled: false
  },

  onLaunch() {
    console.log('OKXTrader小程序启动')
    console.log('API地址:', CONFIG.API_BASE)

    // 初始化服务
    this.initServices()

    // 检查更新
    this.checkUpdate()
  },

  // 初始化服务
  initServices() {
    // 初始化账号服务
    accountService.loadAccounts()
    console.log('✅ 账号服务已初始化')

    // 初始化自动交易引擎
    autoTradingEngine.init()
    console.log('✅ 自动交易引擎已初始化')

    // 初始化AI分析服务
    aiAnalysisService.init()
    console.log('✅ AI分析服务已初始化')

    console.log('当前账号:', accountService.getCurrentAccount().displayName)
    console.log('模拟模式:', accountService.isSimulationMode())
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
