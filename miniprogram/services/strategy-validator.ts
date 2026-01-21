// 策略验证服务 - v0.0.154
// 本地验证用户配置的策略条件，确保AI建议符合策略要求

import { apiService } from './api'
import { StrategyConfig, BuyCondition } from '../models/index'

/**
 * 策略验证结果
 */
export interface ValidationResult {
  passed: boolean              // 是否通过验证
  reason: string               // 未通过的原因
  details: ConditionCheck[]   // 每个条件的检查结果
}

/**
 * 单个条件的检查结果
 */
export interface ConditionCheck {
  conditionId: string         // 条件ID
  conditionName: string        // 条件名称
  passed: boolean              // 是否满足
  reason: string               // 原因说明
  expected: string             // 期望值
  actual: string               // 实际值
}

/**
 * 技术指标数据
 */
export interface TechnicalIndicators {
  // SAR指标
  dailySAR: {
    value: number
    signal: 'long' | 'short'  // 绿点=做多日，红点=做空日
    prevSignal?: 'long' | 'short' | null
    isReversal?: boolean
  }
  sar15m: {
    value: number
    signal: 'long' | 'short'  // 绿点=做多，红点=做空
    prevSignal?: 'long' | 'short' | null
    isReversal?: boolean
  }

  // MACD指标（15分钟）
  macd15m: {
    dif: number
    dea: number
    histogram: number
    crossType: 'golden' | 'death' | null
    alignmentType: 'bullish' | 'bearish' | null
  }
}

class StrategyValidator {
  private indicatorCache: Map<string, any> = new Map()
  private cacheTimeout: number = 60000 // 缓存1分钟

  /**
   * 验证AI建议是否符合用户配置的策略
   */
  async validateStrategy(
    strategyConfig: StrategyConfig,
    aiAnalysis: any,
    symbol: string
  ): Promise<ValidationResult> {
    console.log('🔍 开始本地策略验证...')
    console.log('   策略名称:', strategyConfig.name)
    console.log('   AI建议:', aiAnalysis.signal_type)
    console.log('   置信度:', aiAnalysis.confidence)

    // 1. 获取技术指标数据
    const indicators = await this.getTechnicalIndicators(symbol)

    // 2. 检查每个开仓条件
    const conditionResults: ConditionCheck[] = []
    const buyConfig = strategyConfig.buy_strategy

    if (!buyConfig || !buyConfig.conditions) {
      return {
        passed: false,
        reason: '策略配置无效',
        details: []
      }
    }

    // 获取启用的条件
    const enabledConditions = buyConfig.conditions.filter((c: BuyCondition) => c && c.enabled !== false && c.isEnabled !== false)
    console.log(`   检查 ${enabledConditions.length} 个开仓条件...`)

    const requiredConditions = enabledConditions.filter((c: any) => c.required)
    const optionalConditions = enabledConditions.filter((c: any) => !c.required)

    // 逐个检查条件
    for (const condition of enabledConditions) {
      const result = await this.checkCondition(condition, indicators, aiAnalysis)
      conditionResults.push(result)

      if (!result.passed) {
        console.log(`   ❌ ${result.conditionName}: ${result.reason}`)
      } else {
        console.log(`   ✅ ${result.conditionName}: 满足`)
      }
    }

    // 必选条件不满足则直接失败
    if (requiredConditions.length > 0) {
      const requiredPassed = conditionResults
        .filter(r => requiredConditions.find((c: any) => c.id === r.conditionId))
        .every(r => r.passed)

      if (!requiredPassed) {
        return {
          passed: false,
          reason: '❌ 必选条件未满足',
          details: conditionResults
        }
      }
    }

    // 3. 根据逻辑类型判断
    const logicType = buyConfig.logicType || 'or'
    const optionalResults = conditionResults.filter(r => optionalConditions.find((c: any) => c.id === r.conditionId))
    let passed = false

    if (optionalResults.length === 0) {
      passed = true
    } else if (logicType === 'and') {
      // AND逻辑：所有条件都必须满足
      passed = optionalResults.every(r => r.passed)
    } else {
      // OR逻辑：任一条件满足即可
      passed = optionalResults.some(r => r.passed)
    }

    const reason = passed
      ? `✅ 策略验证通过 (${logicType.toUpperCase()}逻辑)`
      : `❌ 策略验证失败 (${logicType.toUpperCase()}逻辑)`

    console.log(`   ${reason}`)
    console.log('🔍 本地策略验证完成')

    return {
      passed,
      reason,
      details: conditionResults
    }
  }

  /**
   * 检查单个条件
   */
  private async checkCondition(
    condition: BuyCondition,
    indicators: TechnicalIndicators,
    aiAnalysis: any
  ): Promise<ConditionCheck> {
    const { indicator, timeframe } = condition

    if (indicator === 'sar') {
      return this.checkSARCondition(condition, indicators, aiAnalysis)
    } else if (indicator === 'macd') {
      return this.checkMACDCondition(condition, indicators, aiAnalysis)
    } else {
      return {
        conditionId: condition.id,
        conditionName: condition.name,
        passed: false,
        reason: '不支持的指标类型',
        expected: 'sar或macd',
        actual: indicator
      }
    }
  }

  /**
   * 检查SAR条件
   */
  private checkSARCondition(
    condition: BuyCondition,
    indicators: TechnicalIndicators,
    aiAnalysis: any
  ): ConditionCheck {
    const { timeframe, direction, operator } = condition
    const aiSignal = (aiAnalysis && aiAnalysis.signal_type ? aiAnalysis.signal_type : '').toLowerCase()
    const aiDirection = (aiSignal === 'buy' || aiSignal === 'long')
      ? 'long'
      : ((aiSignal === 'sell' || aiSignal === 'short') ? 'short' : null)

    if (timeframe === '1D') {
      // 日线SAR：判断当天交易方向
      // 文档说明：日线SAR在价格下方=做多日（绿点），在价格上方=做空日（红点）
      const sar = indicators.dailySAR
      let expected: 'long' | 'short' | null = null

      if (direction && direction !== 'both') {
        expected = direction === 'long' ? 'long' : 'short'
      }

      if (!expected || operator === 'direction') {
        expected = aiDirection
      }

      if (!expected) {
        return {
          conditionId: condition.id,
          conditionName: `日线SAR (${condition.name})`,
          passed: false,
          reason: '❌ AI信号方向未知，无法判断日线SAR方向',
          expected: 'long/short',
          actual: sar.signal
        }
      }

      const passed = sar.signal === expected

      return {
        conditionId: condition.id,
        conditionName: `日线SAR (${condition.name})`,
        passed,
        reason: passed
          ? `✅ 日线SAR${sar.signal === 'long' ? '在价格下方（绿点/做多日）' : '在价格上方（红点/做空日）'}`
          : `❌ 日线SAR${sar.signal === 'long' ? '在价格下方（做多日），不能做空' : '在价格上方（做空日），不能做多'}`,
        expected: expected,
        actual: sar.signal
      }
    } else if (timeframe === '15m') {
      // 15分钟SAR：确认入场时机
      // 文档说明：做多需要15分钟SAR在价格下方（绿点），做空需要15分钟SAR在价格上方（红点）
      const sar = indicators.sar15m

      // 根据AI建议的方向判断
      const expectedDirection = (aiSignal === 'buy' || aiSignal === 'long') ? 'long' : 'short'

      if (operator === 'reversal' || condition.reversal) {
        const passed = !!sar.isReversal && sar.signal === expectedDirection
        return {
          conditionId: condition.id,
          conditionName: `15分钟SAR反转 (${condition.name})`,
          passed,
          reason: passed
            ? `✅ 15分钟SAR反转到${expectedDirection === 'long' ? '多头' : '空头'}`
            : `❌ 15分钟SAR未反转到${expectedDirection === 'long' ? '多头' : '空头'}`,
          expected: `reversal->${expectedDirection}`,
          actual: `reversal=${sar.isReversal}, signal=${sar.signal}`
        }
      }

      const passed = sar.signal === expectedDirection

      return {
        conditionId: condition.id,
        conditionName: `15分钟SAR (${condition.name})`,
        passed,
        reason: passed
          ? `✅ 15分钟SAR${sar.signal === 'long' ? '在价格下方（绿点）' : '在价格上方（红点）'}，确认${expectedDirection === 'long' ? '做多' : '做空'}信号`
          : `❌ 15分钟SAR${sar.signal === 'long' ? '在价格下方（绿点）' : '在价格上方（红点）'}，与AI建议${expectedDirection}不符`,
        expected: expectedDirection,
        actual: sar.signal
      }
    }

    return {
      conditionId: condition.id,
      conditionName: condition.name,
      passed: false,
      reason: '不支持的SAR时间周期',
      expected: '1D或15m',
      actual: timeframe
    }
  }

  /**
   * 检查MACD条件
   */
  private checkMACDCondition(
    condition: BuyCondition,
    indicators: TechnicalIndicators,
    aiAnalysis: any
  ): ConditionCheck {
    const macd = indicators.macd15m
    const aiSignal = (aiAnalysis && aiAnalysis.signal_type ? aiAnalysis.signal_type : '').toLowerCase()
    const isLongSignal = (aiSignal === 'buy' || aiSignal === 'long')
    const macdSignal = condition.macdSignal || condition.operator

    let passed = false
    let reason = ''
    let expected = ''

    if (macdSignal === 'cross') {
      expected = isLongSignal ? '金叉' : '死叉'
      if (isLongSignal) {
        if (macd.crossType === 'golden') {
          passed = true
          reason = '✅ MACD金叉（DIF从下方穿越DEA，强烈做多信号）'
        } else if (macd.crossType === 'death') {
          passed = false
          reason = '❌ MACD死叉（与做多信号冲突）'
        } else {
          passed = false
          reason = '⚠️ MACD未出现金叉'
        }
      } else {
        if (macd.crossType === 'death') {
          passed = true
          reason = '✅ MACD死叉（DIF从上方穿越DEA，强烈做空信号）'
        } else if (macd.crossType === 'golden') {
          passed = false
          reason = '❌ MACD金叉（与做空信号冲突）'
        } else {
          passed = false
          reason = '⚠️ MACD未出现死叉'
        }
      }
    } else if (macdSignal === 'goldenCross') {
      expected = '金叉'
      passed = macd.crossType === 'golden'
      reason = passed
        ? '✅ MACD金叉（DIF从下方穿越DEA，强烈做多信号）'
        : '❌ MACD未出现金叉'
    } else if (macdSignal === 'deathCross') {
      expected = '死叉'
      passed = macd.crossType === 'death'
      reason = passed
        ? '✅ MACD死叉（DIF从上方穿越DEA，强烈做空信号）'
        : '❌ MACD未出现死叉'
    } else if (macdSignal === 'bullishAlignment') {
      expected = '多头排列（DIF>DEA）'
      passed = macd.alignmentType === 'bullish'
      reason = passed
        ? '✅ MACD多头排列（DIF>DEA，做多信号）'
        : '❌ MACD未出现多头排列'
    } else if (macdSignal === 'bearishAlignment') {
      expected = '空头排列（DIF<DEA）'
      passed = macd.alignmentType === 'bearish'
      reason = passed
        ? '✅ MACD空头排列（DIF<DEA，做空信号）'
        : '❌ MACD未出现空头排列'
    } else {
      expected = isLongSignal ? '金叉或多头排列（DIF>DEA）' : '死叉或空头排列（DIF<DEA）'
      if (isLongSignal) {
        if (macd.crossType === 'golden') {
          passed = true
          reason = '✅ MACD金叉（DIF从下方穿越DEA，强烈做多信号）'
        } else if (macd.alignmentType === 'bullish') {
          passed = true
          reason = '✅ MACD多头排列（DIF>DEA，做多信号）'
        } else if (macd.crossType === 'death') {
          passed = false
          reason = '❌ MACD死叉（与做多信号冲突）'
        } else if (macd.alignmentType === 'bearish') {
          passed = false
          reason = '❌ MACD空头排列（DIF<DEA，与做多信号冲突）'
        } else {
          passed = false
          reason = '⚠️ MACD无明确做多信号'
        }
      } else {
        if (macd.crossType === 'death') {
          passed = true
          reason = '✅ MACD死叉（DIF从上方穿越DEA，强烈做空信号）'
        } else if (macd.alignmentType === 'bearish') {
          passed = true
          reason = '✅ MACD空头排列（DIF<DEA，做空信号）'
        } else if (macd.crossType === 'golden') {
          passed = false
          reason = '❌ MACD金叉（与做空信号冲突）'
        } else if (macd.alignmentType === 'bullish') {
          passed = false
          reason = '❌ MACD多头排列（DIF>DEA，与做空信号冲突）'
        } else {
          passed = false
          reason = '⚠️ MACD无明确做空信号'
        }
      }
    }

    return {
      conditionId: condition.id,
      conditionName: `15分钟MACD (${condition.name})`,
      passed,
      reason,
      expected: expected || (isLongSignal ? '金叉或多头排列（DIF>DEA）' : '死叉或空头排列（DIF<DEA）'),
      actual: `crossType=${macd.crossType}, alignmentType=${macd.alignmentType}, DIF${macd.dif > macd.dea ? '>' : '<'}DEA`
    }
  }

  /**
   * 获取技术指标数据
   */
  private async getTechnicalIndicators(symbol: string): Promise<TechnicalIndicators> {
    // 检查缓存
    const cacheKey = `${symbol}_indicators`
    const cached = this.indicatorCache.get(cacheKey)
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data
    }

    // 获取15分钟K线数据（用于聚合日线SAR）
    const candles15m = await apiService.getCandles(symbol, '15m', 100)

    // 日线SAR：通过检测日期变化计算
    const dailySAR = this.calculateDailySARByDate(candles15m)

    // 15分钟SAR
    const sar15m = this.calculateSAR(candles15m)

    // 计算MACD指标（15分钟）
    const macd15m = this.calculateMACD(candles15m)

    const indicators: TechnicalIndicators = {
      dailySAR,
      sar15m,
      macd15m
    }

    // 缓存结果
    this.indicatorCache.set(cacheKey, {
      data: indicators,
      timestamp: Date.now()
    })

    return indicators
  }

  /**
   * 计算日线SAR（通过检测日期变化）
   */
  private calculateDailySARByDate(candles15m: any[]): { value: number, signal: 'long' | 'short', prevSignal: 'long' | 'short' | null, isReversal: boolean } {
    if (!candles15m || candles15m.length < 100) {
      return { value: 0, signal: 'long', prevSignal: null, isReversal: false }
    }

    const dailyCandles = this.aggregateToDaily(candles15m)
    return this.calculateSAR(dailyCandles)
  }

  /**
   * 将15分钟K线聚合为日线K线（通过检测日期变化）
   */
  private aggregateToDaily(candles15m: any[]): any[] {
    const dailyMap = new Map<string, any>()

    for (const candle of candles15m) {
      const timestamp = parseInt(candle[0])
      const date = new Date(timestamp)
      const dateKey = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`

      if (!dailyMap.has(dateKey)) {
        dailyMap.set(dateKey, {
          timestamp: timestamp,
          open: parseFloat(candle[1]),
          high: parseFloat(candle[2]),
          low: parseFloat(candle[3]),
          close: parseFloat(candle[4]),
          volume: parseFloat(candle[5])
        })
      } else {
        const daily = dailyMap.get(dateKey)
        daily.high = Math.max(daily.high, parseFloat(candle[2]))
        daily.low = Math.min(daily.low, parseFloat(candle[3]))
        daily.close = parseFloat(candle[4])
        daily.volume += parseFloat(candle[5])
      }
    }

    return Array.from(dailyMap.values()).map(d => [
      d.timestamp,
      d.open,
      d.high,
      d.low,
      d.close,
      d.volume
    ])
  }

  /**
   * 计算SAR指标（简化版）
   */
  private calculateSAR(candles: any[]): { value: number, signal: 'long' | 'short', prevSignal: 'long' | 'short' | null, isReversal: boolean } {
    if (!candles || candles.length < 10) {
      return { value: 0, signal: 'long', prevSignal: null, isReversal: false }
    }

    const highs = candles.map(c => parseFloat(c[2]))
    const lows = candles.map(c => parseFloat(c[3]))
    const closes = candles.map(c => parseFloat(c[4]))

    let isLong = closes[1] > closes[0]
    let currentSignal: 'long' | 'short' = isLong ? 'long' : 'short'
    let prevSignal: 'long' | 'short' | null = null
    let af = 0.02
    let ep = isLong ? highs[0] : lows[0]
    let sar = isLong ? lows[0] : highs[0]

    for (let i = 1; i < highs.length; i++) {
      prevSignal = currentSignal
      if (isLong) {
        sar = sar + af * (ep - sar)
        if (lows[i] < sar) {
          isLong = false
          sar = ep
          ep = lows[i]
          af = 0.02
        } else {
          if (highs[i] > ep) ep = highs[i]
          af = Math.min(af + 0.02, 0.2)
        }
      } else {
        sar = sar + af * (ep - sar)
        if (highs[i] > sar) {
          isLong = true
          sar = ep
          ep = highs[i]
          af = 0.02
        } else {
          if (lows[i] < ep) ep = lows[i]
          af = Math.min(af + 0.02, 0.2)
        }
      }
      currentSignal = isLong ? 'long' : 'short'
    }

    return {
      value: sar,
      signal: currentSignal,
      prevSignal: prevSignal,
      isReversal: prevSignal ? prevSignal !== currentSignal : false
    }
  }

  /**
   * 计算MACD指标（15分钟）
   */
  private calculateMACD(candles: any[]): {
    dif: number
    dea: number
    histogram: number
    crossType: 'golden' | 'death' | null
    alignmentType: 'bullish' | 'bearish' | null
  } {
    if (!candles || candles.length < 35) {
      return {
        dif: 0,
        dea: 0,
        histogram: 0,
        crossType: null,
        alignmentType: null
      }
    }

    const closes = candles.map(c => parseFloat(c[4]))

    // 计算EMA
    const ema21 = this.calculateEMA(closes, 21)
    const ema30 = this.calculateEMA(closes, 30)

    // DIF
    const dif = ema21 - ema30

    // DEA (5日EMA of DIF)
    const dea = this.calculateEMAFromArray(
      closes.map((_, i) => {
        if (i < 29) return 0
        const e21 = this.calculateEMA(closes.slice(0, i + 1), 21)
        const e30 = this.calculateEMA(closes.slice(0, i + 1), 30)
        return e21 - e30
      }).slice(29),
      5
    )

    const histogram = dif - dea

    // 判断金叉/死叉
    const prevCloses = closes.slice(0, -1)
    const prevEma21 = this.calculateEMA(prevCloses, 21)
    const prevEma30 = this.calculateEMA(prevCloses, 30)
    const prevDif = prevEma21 - prevEma30
    const prevDea = dea // 简化处理

    let crossType: 'golden' | 'death' | null = null
    let alignmentType: 'bullish' | 'bearish' | null = null

    if (prevDif <= prevDea && dif > dea) {
      crossType = 'golden'  // 金叉
    } else if (prevDif >= prevDea && dif < dea) {
      crossType = 'death'   // 死叉
    } else {
      // 多头/空头排列
      if (dif > dea) {
        alignmentType = 'bullish'
      } else if (dif < dea) {
        alignmentType = 'bearish'
      }
    }

    return {
      dif,
      dea,
      histogram,
      crossType,
      alignmentType
    }
  }

  /**
   * 计算EMA
   */
  private calculateEMA(prices: number[], period: number): number {
    if (prices.length < period) {
      return prices[0] || 0
    }

    const k = 2 / (period + 1)
    let ema = prices[0]

    for (let i = 1; i < prices.length; i++) {
      ema = prices[i] * k + ema * (1 - k)
    }

    return ema
  }

  /**
   * 从数组计算EMA
   */
  private calculateEMAFromArray(values: number[], period: number): number {
    if (values.length < period) {
      return values[values.length - 1] || 0
    }

    const k = 2 / (period + 1)
    let ema = values[0]

    for (let i = 1; i < values.length; i++) {
      ema = values[i] * k + ema * (1 - k)
    }

    return ema
  }

  /**
   * 清除缓存
   */
  clearCache(): void {
    this.indicatorCache.clear()
    console.log('🗑️ 指标缓存已清除')
  }
}

// 导出单例
export const strategyValidator = new StrategyValidator()
