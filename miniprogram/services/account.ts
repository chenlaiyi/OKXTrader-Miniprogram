// 账号管理服务 - 从服务器API获取
import { Account } from '../models/index'

export interface OKXAccount extends Account {
  apiKey: string
  secretKey: string
  passphrase: string
  isSimulation: boolean
  displayName: string
}

class AccountService {
  private accounts: OKXAccount[] = []
  private currentAccountIndex: number = 0
  private userId: string = 'default'  // 默认用户ID

  constructor() {
    this.loadAccounts()
  }

  // 从服务器API加载账号
  private async loadAccounts() {
    try {
      // 先尝试从本地缓存加载
      const cachedAccounts = wx.getStorageSync('accounts')
      const cachedIndex = wx.getStorageSync('current_account_index')

      if (cachedAccounts && cachedAccounts.length > 0) {
        this.accounts = cachedAccounts
        this.currentAccountIndex = cachedIndex || 0
        console.log('✅ 从缓存加载账号:', this.accounts.length, '个')
      }

      // 从服务器获取最新账号列表
      await this.fetchAccountsFromServer()

    } catch (error) {
      console.error('加载账号失败:', error)
      // 如果服务器请求失败，使用默认账号
      this.createDefaultAccounts()
    }
  }

  // 从服务器获取账号列表
  private async fetchAccountsFromServer() {
    try {
      const response = await wx.request({
        url: 'https://ly.ddg.org.cn/api/accounts',
        method: 'GET',
        data: {
          userId: this.userId
        },
        header: {
          'content-type': 'application/json'
        }
      })

      const result = response.data as any

      if (result.success && result.data && result.data.length > 0) {
        // 转换为本地格式
        this.accounts = result.data.map((acc: any) => ({
          id: acc.id,
          name: acc.name,
          apiKey: '',  // 不在本地存储API密钥
          secretKey: '',
          passphrase: '',
          is_default: acc.is_default,
          is_validated: acc.is_validated,
          isSimulation: acc.is_simulation,
          displayName: acc.display_name
        }))

        // 找到默认账号
        const defaultIndex = this.accounts.findIndex(acc => acc.is_default)
        if (defaultIndex !== -1) {
          this.currentAccountIndex = defaultIndex
        }

        // 保存到本地缓存
        this.saveAccounts()

        console.log('✅ 从服务器加载账号:', this.accounts.length, '个')
        console.log('📌 当前账号:', this.getCurrentAccount().name)
      } else {
        console.log('⚠️ 服务器返回空账号列表，使用默认配置')
        this.createDefaultAccounts()
      }
    } catch (error) {
      console.error('从服务器加载账号失败:', error)
      // 服务器请求失败，使用本地默认配置
      if (this.accounts.length === 0) {
        this.createDefaultAccounts()
      }
    }
  }

  // 创建默认账号（降级方案）
  private createDefaultAccounts() {
    console.log('🔄 创建本地默认账号配置')
    this.accounts = [
      {
        id: 'xiezong-local-001',
        name: 'xiezong',
        apiKey: '67cb5f9a-b51e-4c14-aceb-1017d24db301',
        secretKey: 'BB4D1F2587932F1E640ECF9DA55E64D2',
        passphrase: 'Baofa2025!',
        is_default: true,
        is_validated: true,
        isSimulation: false,
        displayName: 'xiezong (本地配置)'
      },
      {
        id: 'simulation-local-001',
        name: '模拟交易账号',
        apiKey: '',
        secretKey: '',
        passphrase: '',
        is_default: false,
        is_validated: true,
        isSimulation: true,
        displayName: '🎯 模拟交易账号 (模拟)'
      }
    ]
    this.currentAccountIndex = 0
    this.saveAccounts()
  }

  // 保存账号到本地缓存
  private saveAccounts() {
    try {
      wx.setStorageSync('accounts', this.accounts)
      wx.setStorageSync('current_account_index', this.currentAccountIndex)
    } catch (error) {
      console.error('保存账号失败:', error)
    }
  }

  // 获取所有账号
  getAccounts(): OKXAccount[] {
    return this.accounts
  }

  // 获取当前账号
  getCurrentAccount(): OKXAccount {
    if (this.currentAccountIndex >= this.accounts.length) {
      this.currentAccountIndex = 0
    }
    return this.accounts[this.currentAccountIndex]
  }

  // 获取当前账号索引
  getCurrentAccountIndex(): number {
    return this.currentAccountIndex
  }

  // 切换账号
  switchAccount(index: number): boolean {
    if (index >= 0 && index < this.accounts.length) {
      this.currentAccountIndex = index
      this.saveAccounts()
      console.log('✅ 切换到账号:', this.accounts[index].name)
      return true
    }
    return false
  }

  // 刷新账号列表
  async refreshAccounts(): Promise<boolean> {
    try {
      await this.fetchAccountsFromServer()
      return true
    } catch (error) {
      console.error('刷新账号失败:', error)
      return false
    }
  }

  // 设置默认账号
  setDefaultAccount(index: number): boolean {
    if (index >= 0 && index < this.accounts.length) {
      this.accounts.forEach((acc, i) => {
        acc.is_default = i === index
      })
      this.saveAccounts()
      return true
    }
    return false
  }

  // 验证账号
  async validateAccount(account: OKXAccount): Promise<{ valid: boolean, error?: string }> {
    try {
      if (account.isSimulation) {
        return { valid: true }
      }

      const response = await wx.request({
        url: 'https://ly.ddg.org.cn/api/accounts/validate',
        method: 'POST',
        data: {
          userId: this.userId,
          accountId: account.id,
          apiKey: account.apiKey,
          secretKey: account.secretKey,
          passphrase: account.passphrase
        }
      })

      const result = response.data as any
      if (result.success) {
        // 更新本地账号状态
        this.updateAccount(account.id, {
          is_validated: true,
          validationDate: Date.now()
        })
        return { valid: true }
      } else {
        return { valid: false, error: result.error || '验证失败' }
      }
    } catch (error: any) {
      return { valid: false, error: error.message || '网络错误' }
    }
  }

  // 更新账号
  updateAccount(id: string, updates: Partial<OKXAccount>): boolean {
    const index = this.accounts.findIndex(acc => acc.id === id)
    if (index !== -1) {
      this.accounts[index] = {
        ...this.accounts[index],
        ...updates
      }
      this.saveAccounts()
      return true
    }
    return false
  }

  // 添加账号
  addAccount(account: Omit<OKXAccount, 'id' | 'displayName'>): OKXAccount {
    const newAccount: OKXAccount = {
      ...account,
      id: Date.now().toString(),
      displayName: account.isSimulation
        ? `🎯 ${account.name} (模拟)`
        : `${account.name} (${account.apiKey?.substring(0, 8)}...)`
    }
    this.accounts.push(newAccount)
    this.saveAccounts()
    return newAccount
  }

  // 删除账号
  deleteAccount(id: string): boolean {
    const index = this.accounts.findIndex(acc => acc.id === id)
    if (index !== -1) {
      // 如果删除的是当前账号，切换到第一个账号
      if (index === this.currentAccountIndex) {
        this.currentAccountIndex = 0
      } else if (index < this.currentAccountIndex) {
        this.currentAccountIndex--
      }
      this.accounts.splice(index, 1)
      this.saveAccounts()
      return true
    }
    return false
  }

  // 是否为模拟模式
  isSimulationMode(): boolean {
    return this.getCurrentAccount().isSimulation
  }

  // 获取账号统计信息
  getAccountStats(): {
    total: number
    simulated: number
    real: number
    validated: number
  } {
    return {
      total: this.accounts.length,
      simulated: this.accounts.filter(a => a.isSimulation).length,
      real: this.accounts.filter(a => !a.isSimulation).length,
      validated: this.accounts.filter(a => a.is_validated).length
    }
  }
}

export const accountService = new AccountService()
