// pages/account/account.ts
import { accountService } from '../../services/account'
import { autoTradingEngine } from '../../services/auto-trading'

Page({
  data: {
    accounts: [],
    currentAccountIndex: 0,
    accountStats: {
      total: 0,
      simulated: 0,
      real: 0,
      validated: 0
    },

    showModal: false,
    modalMode: 'add', // add, edit
    currentEditAccount: null,

    formData: {
      name: '',
      apiKey: '',
      secretKey: '',
      passphrase: '',
      isSimulation: false
    }
  },

  onLoad() {
    this.loadAccounts()
  },

  onShow() {
    this.loadAccounts()
  },

  // 加载账号列表
  loadAccounts() {
    const accounts = accountService.getAccounts()
    const currentIndex = accountService.getCurrentAccountIndex()
    const stats = accountService.getAccountStats()

    this.setData({
      accounts,
      currentAccountIndex: currentIndex,
      accountStats: stats
    })
  },

  // 切换账号
  switchAccount(e: any) {
    const { index } = e.currentTarget.dataset

    // 如果当前账号正在运行自动交易，需要先停止
    const tradingStats = autoTradingEngine.getStats()
    if (tradingStats.isRunning) {
      wx.showModal({
        title: '提示',
        content: '自动交易正在运行中，切换账号会停止自动交易，是否继续？',
        success: (res) => {
          if (res.confirm) {
            autoTradingEngine.stop()
            this.doSwitchAccount(index)
          }
        }
      })
      return
    }

    this.doSwitchAccount(index)
  },

  // 执行切换账号
  doSwitchAccount(index: number) {
    const success = accountService.switchAccount(index)
    if (success) {
      wx.showToast({
        title: '切换成功',
        icon: 'success'
      })
      this.loadAccounts()
    }
  },

  // 设置默认账号
  setDefaultAccount(e: any) {
    const { index } = e.currentTarget.dataset
    const success = accountService.setDefaultAccount(index)

    if (success) {
      wx.showToast({
        title: '已设置为默认账号',
        icon: 'success'
      })
      this.loadAccounts()
    }
  },

  // 显示添加账号模态框
  showAddModal() {
    this.setData({
      showModal: true,
      modalMode: 'add',
      formData: {
        name: '',
        apiKey: '',
        secretKey: '',
        passphrase: '',
        isSimulation: false
      }
    })
  },

  // 显示编辑账号模态框
  showEditModal(e: any) {
    const { index } = e.currentTarget.dataset
    const account = this.data.accounts[index]

    this.setData({
      showModal: true,
      modalMode: 'edit',
      currentEditAccount: index,
      formData: {
        name: account.name,
        apiKey: account.apiKey,
        secretKey: account.secretKey,
        passphrase: account.passphrase,
        isSimulation: account.isSimulation
      }
    })
  },

  // 关闭模态框
  closeModal() {
    this.setData({
      showModal: false,
      formData: {
        name: '',
        apiKey: '',
        secretKey: '',
        passphrase: '',
        isSimulation: false
      }
    })
  },

  // 表单输入
  onInputChange(e: any) {
    const { field } = e.currentTarget.dataset
    const value = e.detail.value

    this.setData({
      [`formData.${field}`]: value
    })
  },

  // 切换模拟模式
  onSimulationChange(e: any) {
    this.setData({
      'formData.isSimulation': e.detail.value
    })
  },

  // 保存账号
  async saveAccount() {
    const { formData, modalMode, currentEditAccount } = this.data

    // 验证表单
    if (!formData.name.trim()) {
      wx.showToast({
        title: '请输入账号名称',
        icon: 'none'
      })
      return
    }

    if (!formData.isSimulation) {
      if (!formData.apiKey.trim() || !formData.secretKey.trim() || !formData.passphrase.trim()) {
        wx.showToast({
          title: '请填写完整的API信息',
          icon: 'none'
        })
        return
      }
    }

    wx.showLoading({ title: '保存中...' })

    try {
      if (modalMode === 'add') {
        // 添加新账号
        accountService.addAccount({
          id: '',
          name: formData.name,
          api_key: formData.apiKey,
          secret_key: formData.secretKey,
          passphrase: formData.passphrase,
          is_default: false,
          is_validated: false,
          isSimulation: formData.isSimulation,
          displayName: ''
        })
      } else {
        // 编辑现有账号
        const account = this.data.accounts[currentEditAccount]
        accountService.updateAccount(account.id, {
          name: formData.name,
          apiKey: formData.apiKey,
          secretKey: formData.secretKey,
          passphrase: formData.passphrase,
          isSimulation: formData.isSimulation
        })
      }

      wx.hideLoading()
      wx.showToast({
        title: '保存成功',
        icon: 'success'
      })

      this.closeModal()
      this.loadAccounts()

    } catch (error) {
      wx.hideLoading()
      wx.showToast({
        title: '保存失败',
        icon: 'error'
      })
    }
  },

  // 验证账号
  async validateAccount(e: any) {
    const { index } = e.currentTarget.dataset
    const account = this.data.accounts[index]

    if (account.isSimulation) {
      wx.showToast({
        title: '模拟账号无需验证',
        icon: 'none'
      })
      return
    }

    wx.showLoading({ title: '验证中...' })

    try {
      const result = await accountService.validateAccount(account)

      wx.hideLoading()

      if (result.valid) {
        wx.showToast({
          title: '验证成功',
          icon: 'success'
        })
      } else {
        wx.showModal({
          title: '验证失败',
          content: result.error || '未知错误',
          showCancel: false
        })
      }

      this.loadAccounts()
    } catch (error) {
      wx.hideLoading()
      wx.showToast({
        title: '验证失败',
        icon: 'error'
      })
    }
  },

  // 删除账号
  deleteAccount(e: any) {
    const { index } = e.currentTarget.dataset
    const account = this.data.accounts[index]

    wx.showModal({
      title: '确认删除',
      content: `确定要删除账号"${account.name}"吗？`,
      success: (res) => {
        if (res.confirm) {
          // 如果是当前账号，需要先停止自动交易
          if (index === this.data.currentAccountIndex) {
            const tradingStats = autoTradingEngine.getStats()
            if (tradingStats.isRunning) {
              autoTradingEngine.stop()
            }
          }

          const success = accountService.deleteAccount(account.id)
          if (success) {
            wx.showToast({
              title: '删除成功',
              icon: 'success'
            })
            this.loadAccounts()
          }
        }
      }
    })
  },

  // 查看账号详情
  viewAccountDetail(e: any) {
    const { index } = e.currentTarget.dataset
    const account = this.data.accounts[index]

    const content = `
账号名称: ${account.name}
账号ID: ${account.id}
默认账号: ${account.is_default ? '是' : '否'}
验证状态: ${account.is_validated ? '已验证' : '未验证'}
模拟账号: ${account.isSimulation ? '是' : '否'}
API Key: ${account.apiKey ? account.apiKey.substring(0, 8) + '...' : '无'}
    `

    wx.showModal({
      title: '账号详情',
      content,
      showCancel: false
    })
  },

  // 去监控页面
  goToMonitor() {
    wx.switchTab({ url: '/pages/monitor/monitor' })
  },

  // 去策略页面
  goToStrategy() {
    wx.navigateTo({ url: '/pages/strategy/strategy' })
  }
})
