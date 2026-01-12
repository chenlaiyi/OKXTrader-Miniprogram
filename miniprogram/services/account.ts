// 账号管理服务
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

  constructor() {
    this.loadAccounts()
  }

  // 从存储加载账号
  private loadAccounts() {
    try {
      const accountsData = wx.getStorageSync('accounts')
      if (accountsData) {
        this.accounts = accountsData
      }

      const currentIndex = wx.getStorageSync('current_account_index')
      if (currentIndex !== undefined && currentIndex !== null) {
        this.currentAccountIndex = currentIndex
      }

      // 如果没有账号，创建默认模拟账号
      if (this.accounts.length === 0) {
        this.createDefaultAccounts()
      }
    } catch (error) {
      console.error('加载账号失败:', error)
      this.createDefaultAccounts()
    }
  }

  // 创建默认账号
  private createDefaultAccounts() {
    this.accounts = [
      {
        id: '0',
        name: '模拟交易账号',
        apiKey: '',
        secretKey: '',
        passphrase: '',
        is_default: true,
        is_validated: true,
        isSimulation: true,
        displayName: '🎯 模拟交易账号 (模拟)'
      }
    ]
    this.saveAccounts()
  }

  // 保存账号到存储
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
      return true
    }
    return false
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

  // 添加账号
  addAccount(account: Omit<OKXAccount, 'id' | 'displayName'>): OKXAccount {
    const newAccount: OKXAccount = {
      ...account,
      id: Date.now().toString(),
      displayName: account.isSimulation
        ? `🎯 ${account.name} (模拟)`
        : `${account.name} (${account.api_key?.substring(0, 8)}...)`
    }
    this.accounts.push(newAccount)
    this.saveAccounts()
    return newAccount
  }

  // 更新账号
  updateAccount(id: string, updates: Partial<OKXAccount>): boolean {
    const index = this.accounts.findIndex(acc => acc.id === id)
    if (index !== -1) {
      this.accounts[index] = {
        ...this.accounts[index],
        ...updates,
        displayName: updates.name
          ? (updates.isSimulation
            ? `🎯 ${updates.name} (模拟)`
            : `${updates.name} (${this.accounts[index].apiKey.substring(0, 8)}...)`)
          : this.accounts[index].displayName
      }
      this.saveAccounts()
      return true
    }
    return false
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

  // 验证账号（调用后端API验证）
  async validateAccount(account: OKXAccount): Promise<{ valid: boolean, error?: string }> {
    try {
      if (account.isSimulation) {
        return { valid: true }
      }

      const response = await wx.request({
        url: 'https://ly.ddg.org.cn/api/accounts/validate',
        method: 'POST',
        data: {
          api_key: account.apiKey,
          secret_key: account.secretKey,
          passphrase: account.passphrase
        }
      })

      const result = response.data as any
      if (result.success) {
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
