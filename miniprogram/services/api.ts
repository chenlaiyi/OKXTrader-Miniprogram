// API服务
import { CONFIG } from '../utils/config'
import { MarketData, CandleData, Indicators, AIAnalysis, Position, StrategyConfig, TradeRecord, ChatMessage } from '../models/index'

class ApiService {
  private baseUrl: string = CONFIG.API_BASE

  // 通用请求方法 - 使用微信小程序的wx.request
  private request<T>(url: string, options?: { method?: string; data?: any }): Promise<T> {
    return new Promise((resolve, reject) => {
      wx.request({
        url: `${this.baseUrl}${url}`,
        method: (options?.method as any) || 'GET',
        data: options?.data,
        header: {
          'content-type': 'application/json',
        },
        success: (res: any) => {
          const result = res.data
          if (result.success) {
            resolve(result.data as T)
          } else {
            reject(new Error(result.error || '请求失败'))
          }
        },
        fail: (error: any) => {
          console.error('API请求失败:', error)
          reject(error)
        }
      })
    })
  }

  // 获取市场行情
  async getMarkets(instType: string = 'SPOT'): Promise<MarketData[]> {
    return this.request<MarketData[]>(`/markets?instType=${instType}`)
  }

  // 获取K线数据
  async getCandles(symbol: string, limit: number = 100): Promise<CandleData[]> {
    return this.request<CandleData[]>(`/candles?symbol=${symbol}&limit=${limit}`)
  }

  // 获取技术指标
  async getIndicators(symbol: string): Promise<Indicators> {
    return this.request<Indicators>(`/indicators?symbol=${symbol}`)
  }

  // 获取AI分析
  async getAIAnalysis(symbol?: string): Promise<AIAnalysis> {
    const url = symbol ? `/ai/analysis/latest?symbol=${symbol}` : '/ai/analysis/latest'
    return this.request<AIAnalysis>(url)
  }

  // 获取持仓列表
  async getPositions(): Promise<Position[]> {
    return this.request<Position[]>('/positions')
  }

  // 获取账户余额
  async getAccountBalance(): Promise<any> {
    return this.request<any>('/account/balance')
  }

  // 获取账户信息 (iOS风格)
  async getAccountInfo(): Promise<any> {
    return this.request<any>('/account/info')
  }

  // 获取资产余额列表
  async getBalances(): Promise<any[]> {
    return this.request<any[]>('/account/balances')
  }

  // 获取成交历史记录
  async getFillHistory(): Promise<any[]> {
    return this.request<any[]>('/fills')
  }

  // 执行交易
  async executeTrade(symbol: string, side: 'long' | 'short', size: number): Promise<any> {
    return this.request<any>('/trade', {
      method: 'POST',
      data: { symbol, side, size }
    })
  }

  // 平仓
  async closePosition(positionId: string): Promise<any> {
    return this.request<any>('/positions/close', {
      method: 'POST',
      data: { positionId }
    })
  }

  // 获取策略列表
  async getStrategies(): Promise<StrategyConfig[]> {
    return this.request<StrategyConfig[]>('/strategy')
  }

  // 获取单个策略
  async getStrategy(id: string): Promise<StrategyConfig> {
    return this.request<StrategyConfig>(`/strategy/${id}`)
  }

  // 创建策略
  async createStrategy(strategy: StrategyConfig): Promise<{ id: string }> {
    return this.request<{ id: string }>('/strategy', {
      method: 'POST',
      data: strategy
    })
  }

  // 更新策略
  async updateStrategy(id: string, strategy: Partial<StrategyConfig>): Promise<any> {
    return this.request<any>(`/strategy/${id}`, {
      method: 'PUT',
      data: strategy
    })
  }

  // 删除策略
  async deleteStrategy(id: string): Promise<any> {
    return this.request<any>(`/strategy/${id}`, {
      method: 'DELETE'
    })
  }

  // 获取交易历史
  async getTradeHistory(): Promise<TradeRecord[]> {
    return this.request<TradeRecord[]>('/trades')
  }

  // 获取账号列表
  async getAccounts(): Promise<any[]> {
    return this.request<any[]>('/accounts')
  }

  // 添加账号
  async addAccount(account: any): Promise<any> {
    return this.request<any>('/accounts', {
      method: 'POST',
      data: account
    })
  }

  // 切换账号
  async switchAccount(accountId: number): Promise<any> {
    return this.request<any>('/accounts/switch', {
      method: 'POST',
      data: { accountId }
    })
  }

  // 获取聊天历史
  async getChatHistory(): Promise<ChatMessage[]> {
    return this.request<ChatMessage[]>('/chat/history')
  }

  // 发送聊天消息
  async sendChatMessage(message: string): Promise<{ response: string }> {
    return this.request<{ response: string }>('/chat/send', {
      method: 'POST',
      data: { message }
    })
  }

  // 获取自动交易状态
  async getAutoTradingStatus(): Promise<{ enabled: boolean }> {
    return this.request<{ enabled: boolean }>('/autotrading/status')
  }

  // 切换自动交易
  async toggleAutoTrading(enabled: boolean): Promise<any> {
    return this.request<any>('/autotrading/toggle', {
      method: 'POST',
      data: { enabled }
    })
  }

  // AI分析请求
  async requestAIAnalysis(symbol: string, params?: any): Promise<AIAnalysis> {
    return this.request<AIAnalysis>('/ai/analyze', {
      method: 'POST',
      data: { symbol, ...params }
    })
  }
}

export const apiService = new ApiService()
