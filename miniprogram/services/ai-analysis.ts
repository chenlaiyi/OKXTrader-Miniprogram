// AI分析服务
import { AIAnalysis, Indicators, CandleData } from '../models/index'
import { apiService } from './api'

export interface AnalysisResult {
  success: boolean
  analysis?: AIAnalysis
  error?: string
}

export interface ContinuousAnalysisConfig {
  enabled: boolean
  symbol: string
  timeframe: string
  interval: number // 毫秒
  indicators: string[]
}

class AIAnalysisService {
  private analysisCache: Map<string, AIAnalysis> = new Map()
  private analysisHistory: AIAnalysis[] = []
  private config: ContinuousAnalysisConfig = {
    enabled: false,
    symbol: 'ETH-USDT-SWAP',
    timeframe: '5m',
    interval: 60000, // 1分钟
    indicators: ['SAR', 'MACD', 'RSI', 'BOLL']
  }

  private timer: number | null = null
  private lastAnalysisTime: number = 0

  // 获取最新AI分析
  async getLatestAnalysis(symbol?: string): Promise<AIAnalysis> {
    const targetSymbol = symbol || this.config.symbol
    const cacheKey = `${targetSymbol}_${this.config.timeframe}`

    // 检查缓存
    const cached = this.analysisCache.get(cacheKey)
    if (cached && Date.now() - cached.timestamp < 30000) { // 30秒内有效
      return cached
    }

    // 从API获取
    const analysis = await apiService.getAIAnalysis(targetSymbol)

    // 缓存结果
    this.analysisCache.set(cacheKey, analysis)
    this.addToHistory(analysis)

    return analysis
  }

  // 获取多周期分析
  async getMultiTimeframeAnalysis(symbol: string): Promise<{
    short: AIAnalysis
    medium: AIAnalysis
    long: AIAnalysis
  }> {
    const [short, medium, long] = await Promise.all([
      apiService.getAIAnalysis(symbol),
      apiService.getAIAnalysis(symbol),
      apiService.getAIAnalysis(symbol)
    ])

    return { short, medium, long }
  }

  // 添加到历史记录
  private addToHistory(analysis: AIAnalysis) {
    this.analysisHistory.unshift(analysis)
    if (this.analysisHistory.length > 100) {
      this.analysisHistory.pop()
    }
  }

  // 获取分析历史
  getHistory(limit: number = 20): AIAnalysis[] {
    return this.analysisHistory.slice(0, limit)
  }

  // 计算分析一致性
  calculateConsistency(limit: number = 10): {
    longConsensus: number
    shortConsensus: number
    avgConfidence: number
  } {
    const recent = this.getHistory(limit)
    if (recent.length === 0) {
      return { longConsensus: 0, shortConsensus: 0, avgConfidence: 0 }
    }

    const longSignals = recent.filter(a => a.signal_type.toLowerCase() === 'buy' || a.signal_type.toLowerCase() === 'long').length
    const shortSignals = recent.filter(a => a.signal_type.toLowerCase() === 'sell' || a.signal_type.toLowerCase() === 'short').length

    const avgConfidence = recent.reduce((sum, a) => sum + a.confidence, 0) / recent.length

    return {
      longConsensus: (longSignals / recent.length) * 100,
      shortConsensus: (shortSignals / recent.length) * 100,
      avgConfidence
    }
  }

  // 启动持续分析
  startContinuousAnalysis(): boolean {
    if (this.timer !== null) {
      return false
    }

    this.config.enabled = true

    // 立即执行一次
    this.performAnalysis()

    // 启动定时器
    this.timer = setInterval(() => {
      this.performAnalysis()
    }, this.config.interval)

    console.log('✅ 持续AI分析已启动')
    this.saveConfig()
    return true
  }

  // 停止持续分析
  stopContinuousAnalysis(): boolean {
    if (this.timer === null) {
      return false
    }

    clearInterval(this.timer)
    this.timer = null
    this.config.enabled = false

    console.log('⏹️ 持续AI分析已停止')
    this.saveConfig()
    return true
  }

  // 执行分析
  private async performAnalysis() {
    try {
      console.log(`🔄 执行AI分析: ${this.config.symbol}`)
      this.lastAnalysisTime = Date.now()

      const analysis = await this.getLatestAnalysis(this.config.symbol)

      console.log(`✅ 分析完成: ${analysis.signal_type}, 置信度: ${(analysis.confidence * 100).toFixed(0)}%`)

      // 可以在这里添加通知逻辑
      if (analysis.confidence >= 0.8) {
        console.log(`🚨 高置信度信号: ${analysis.signal_type}`)
      }

    } catch (error) {
      console.error('AI分析失败:', error)
    }
  }

  // 自定义分析请求
  async customAnalysis(symbol: string, timeframe: string): Promise<AnalysisResult> {
    try {
      const analysis = await apiService.getAIAnalysis(symbol)

      return {
        success: true,
        analysis
      }
    } catch (error: any) {
      return {
        success: false,
        error: error.message || '分析失败'
      }
    }
  }

  // 批量分析多个币种
  async batchAnalysis(symbols: string[]): Promise<Map<string, AIAnalysis>> {
    const results = new Map<string, AIAnalysis>()

    await Promise.all(
      symbols.map(async (symbol) => {
        try {
          const analysis = await this.getLatestAnalysis(symbol)
          results.set(symbol, analysis)
        } catch (error) {
          console.error(`分析 ${symbol} 失败:`, error)
        }
      })
    )

    return results
  }

  // 获取最佳交易机会
  async getBestOpportunity(symbols: string[]): Promise<{
    symbol: string
    analysis: AIAnalysis
    score: number
  } | null> {
    const analyses = await this.batchAnalysis(symbols)

    let best: any = null
    let bestScore = 0

    for (const [symbol, analysis] of analyses) {
      // 计算综合得分：置信度 * 信号强度
      const signalStrength = analysis.signal_type.toLowerCase() === 'buy' ? 1 : -1
      const score = analysis.confidence * Math.abs(signalStrength)

      if (score > bestScore) {
        best = { symbol, analysis, score }
        bestScore = score
      }
    }

    return best
  }

  // 更新配置
  updateConfig(updates: Partial<ContinuousAnalysisConfig>): void {
    this.config = { ...this.config, ...updates }

    // 如果正在运行，重启定时器
    if (this.timer !== null) {
      this.stopContinuousAnalysis()
      this.startContinuousAnalysis()
    }

    this.saveConfig()
  }

  // 获取配置
  getConfig(): ContinuousAnalysisConfig {
    return { ...this.config }
  }

  // 获取状态
  getStatus(): {
    isRunning: boolean
    lastAnalysisTime: number
    cacheSize: number
    historySize: number
  } {
    return {
      isRunning: this.timer !== null,
      lastAnalysisTime: this.lastAnalysisTime,
      cacheSize: this.analysisCache.size,
      historySize: this.analysisHistory.length
    }
  }

  // 清除缓存
  clearCache(symbol?: string) {
    if (symbol) {
      for (const key of this.analysisCache.keys()) {
        if (key.startsWith(symbol)) {
          this.analysisCache.delete(key)
        }
      }
    } else {
      this.analysisCache.clear()
    }
  }

  // 清除历史
  clearHistory() {
    this.analysisHistory = []
  }

  // 保存配置到存储
  private saveConfig() {
    try {
      wx.setStorageSync('ai_analysis_config', this.config)
    } catch (error) {
      console.error('保存AI分析配置失败:', error)
    }
  }

  // 从存储加载配置
  loadFromStorage() {
    try {
      const config = wx.getStorageSync('ai_analysis_config')
      if (config) {
        this.config = { ...this.config, ...config }
      }
    } catch (error) {
      console.error('加载AI分析配置失败:', error)
    }
  }

  // 初始化（在app启动时调用）
  init() {
    this.loadFromStorage()

    // 如果之前是运行状态，重新启动
    if (this.config.enabled && this.timer === null) {
      this.startContinuousAnalysis()
    }
  }

  // 分析信号强度
  getSignalStrength(analysis: AIAnalysis): {
    strength: 'strong' | 'medium' | 'weak'
    direction: 'bullish' | 'bearish' | 'neutral'
    confidence: 'high' | 'medium' | 'low'
  } {
    const confidence = analysis.confidence
    const signalType = analysis.signal_type.toLowerCase()

    let strength: 'strong' | 'medium' | 'weak'
    if (confidence >= 0.8) strength = 'strong'
    else if (confidence >= 0.6) strength = 'medium'
    else strength = 'weak'

    let direction: 'bullish' | 'bearish' | 'neutral'
    if (signalType === 'buy' || signalType === 'long') direction = 'bullish'
    else if (signalType === 'sell' || signalType === 'short') direction = 'bearish'
    else direction = 'neutral'

    let confidenceLevel: 'high' | 'medium' | 'low'
    if (confidence >= 0.75) confidenceLevel = 'high'
    else if (confidence >= 0.5) confidenceLevel = 'medium'
    else confidenceLevel = 'low'

    return {
      strength,
      direction,
      confidence: confidenceLevel
    }
  }
}

export const aiAnalysisService = new AIAnalysisService()
