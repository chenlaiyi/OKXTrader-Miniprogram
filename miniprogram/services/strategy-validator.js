// 策略验证服务 - v0.0.156
// ✅ 纯SAR版：严格按照 SAR.md 实现
//    - 日线SAR方向可开关
//    - 15分钟SAR反转白点触发
//    - 使用上一根已完成K线

const API = require('./api')

class StrategyValidator {
  constructor() {
    this.indicatorCache = new Map()
    this.cacheTimeout = 60000 // 缓存1分钟
  }

  /**
   * 验证AI建议是否符合用户配置的策略（纯SAR）
   */
  async validateStrategy(strategyConfig, aiAnalysis, symbol) {
    console.log('🔍 开始SAR策略验证...')
    console.log('   策略名称:', strategyConfig.name)
    console.log('   AI建议:', aiAnalysis.signal_type)
    console.log('   置信度:', aiAnalysis.confidence)

    // 1. 获取技术指标数据
    const indicators = await this.getTechnicalIndicators(symbol)
    console.log('   📊 技术指标获取完成')

    // 2. 检查开仓条件
    const buyConfig = strategyConfig.buy_strategy
    if (!buyConfig || !buyConfig.conditions) {
      return {
        passed: false,
        reason: '策略配置无效',
        details: []
      }
    }

    const conditionResults = []
    const enabledConditions = buyConfig.conditions.filter(c => c && c.enabled !== false && c.isEnabled !== false)
    console.log(`   🔍 检查 ${enabledConditions.length} 个开仓条件...`)

    const requiredConditions = enabledConditions.filter(c => c.required)
    const optionalConditions = enabledConditions.filter(c => !c.required)

    for (const condition of enabledConditions) {
      const result = await this.checkCondition(condition, indicators, aiAnalysis)
      conditionResults.push(result)

      if (!result.passed) {
        console.log(`   ❌ ${result.conditionName}: ${result.reason}`)
      } else {
        console.log(`   ✅ ${result.conditionName}: 满足`)
      }
    }

    // 必选条件不满足则失败
    if (requiredConditions.length > 0) {
      const requiredPassed = conditionResults
        .filter(r => requiredConditions.find(c => c.id === r.conditionId))
        .every(r => r.passed)
      if (!requiredPassed) {
        return {
          passed: false,
          reason: '❌ 必选条件未满足',
          details: conditionResults
        }
      }
    }

    // 逻辑判断（默认 OR）
    const logicType = buyConfig.logicType || 'or'
    const optionalResults = conditionResults.filter(r => optionalConditions.find(c => c.id === r.conditionId))
    const passed = optionalResults.length === 0
      ? true
      : (logicType === 'and'
        ? optionalResults.every(r => r.passed)
        : optionalResults.some(r => r.passed))

    const reason = passed
      ? `✅ 策略验证通过 (${logicType.toUpperCase()}逻辑)`
      : `❌ 策略验证失败 (${logicType.toUpperCase()}逻辑)`

    console.log(`   ${reason}`)
    console.log('🔍 策略验证完成')

    return {
      passed,
      reason,
      details: conditionResults
    }
  }

  /**
   * 检查单个条件
   */
  async checkCondition(condition, indicators, aiAnalysis) {
    const { indicator } = condition

    if (indicator === 'sar') {
      return this.checkSARCondition(condition, indicators, aiAnalysis)
    }

    return {
      conditionId: condition.id,
      conditionName: condition.name,
      passed: false,
      reason: '不支持的指标类型',
      expected: 'sar',
      actual: indicator
    }
  }

  /**
   * ✅ 检查SAR条件（严格按照 SAR.md）
   */
  checkSARCondition(condition, indicators, aiAnalysis) {
    const { timeframe, operator } = condition
    const expectedDirection = this.resolveAiDirection(aiAnalysis)

    if (!expectedDirection) {
      return {
        conditionId: condition.id,
        conditionName: condition.name,
        passed: false,
        reason: '❌ AI信号方向未知，无法判断SAR方向',
        expected: 'long/short',
        actual: 'unknown'
      }
    }

    if (timeframe === '1D' || timeframe === 'daily') {
      const sar = indicators.dailySAR
      const passed = sar.signal === expectedDirection
      return {
        conditionId: condition.id,
        conditionName: `日线SAR (${condition.name})`,
        passed,
        reason: passed
          ? `✅ 日线SAR在${sar.signal === 'long' ? '下方（绿点/做多日）' : '上方（红点/做空日）'}`
          : `❌ 日线SAR在${sar.signal === 'long' ? '下方（做多日）' : '上方（做空日）'}，不能${expectedDirection === 'long' ? '做多' : '做空'}`,
        expected: expectedDirection,
        actual: sar.signal
      }
    }

    if (timeframe === '15m' || timeframe === '15M') {
      const sar = indicators.sar15m
      const requiresReversal = operator === 'reversal' || condition.reversal
      let passed = false
      let reason = ''

      if (requiresReversal) {
        passed = sar.isReversal && sar.signal === expectedDirection
        reason = passed
          ? `✅ 15分钟SAR反转到${expectedDirection === 'long' ? '多头' : '空头'}`
          : `❌ 15分钟SAR未反转到${expectedDirection === 'long' ? '多头' : '空头'}`
      } else {
        passed = sar.signal === expectedDirection
        reason = passed
          ? `✅ 15分钟SAR方向一致，确认${expectedDirection === 'long' ? '做多' : '做空'}`
          : `❌ 15分钟SAR方向不一致，不能${expectedDirection === 'long' ? '做多' : '做空'}`
      }

      return {
        conditionId: condition.id,
        conditionName: `15分钟SAR${requiresReversal ? '反转' : ''} (${condition.name})`,
        passed,
        reason,
        expected: expectedDirection,
        actual: sar.signal
      }
    }

    return {
      conditionId: condition.id,
      conditionName: condition.name,
      passed: false,
      reason: '不支持的SAR时间周期',
      expected: '1D/15m',
      actual: timeframe
    }
  }

  resolveAiDirection(aiAnalysis) {
    const aiSignal = (aiAnalysis && aiAnalysis.signal_type ? aiAnalysis.signal_type : '').toLowerCase()
    if (aiSignal === 'buy' || aiSignal === 'long') return 'long'
    if (aiSignal === 'sell' || aiSignal === 'short') return 'short'
    return null
  }

  /**
   * 获取技术指标数据
   */
  async getTechnicalIndicators(symbol) {
    const cacheKey = `${symbol}_indicators`
    const cached = this.indicatorCache.get(cacheKey)
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data
    }

    console.log(`📊 获取${symbol}技术指标...`)

    const candleRes = await API.getCandles(symbol, '15m', 120)
    if (!candleRes || !candleRes.success || !Array.isArray(candleRes.data)) {
      throw new Error('获取K线数据失败')
    }

    const candles15mRaw = candleRes.data
    const candles15m = this.ensureAscendingCandles(candles15mRaw)

    const dailySAR = this.calculateDailySARByDate(candles15m)
    const sar15m = this.calculateSARSignal(candles15m)

    const indicators = {
      dailySAR,
      sar15m
    }

    console.log(`   日线SAR: ${dailySAR.signal} (${dailySAR.signal === 'long' ? '做多日' : '做空日'})`)
    console.log(`   15分钟SAR: ${sar15m.signal} ${sar15m.isReversal ? '(反转)' : ''}`)

    this.indicatorCache.set(cacheKey, {
      data: indicators,
      timestamp: Date.now()
    })

    return indicators
  }

  ensureAscendingCandles(candles) {
    if (!Array.isArray(candles) || candles.length < 2) return candles || []
    const firstTs = this.readCandleTimestamp(candles[0])
    const lastTs = this.readCandleTimestamp(candles[candles.length - 1])
    if (!isNaN(firstTs) && !isNaN(lastTs) && firstTs > lastTs) {
      return candles.slice().reverse()
    }
    return candles
  }

  /**
   * ✅ 计算日线SAR（通过检测日期变化）
   */
  calculateDailySARByDate(candles15m) {
    if (!candles15m || candles15m.length < 50) {
      return { value: 0, signal: 'long', prevSignal: null, isReversal: false }
    }

    const dailyCandles = this.aggregateToDaily(candles15m)
    const dailySeries = this.calculateSARSeries(dailyCandles)
    return this.pickConfirmedSar(dailySeries)
  }

  /**
   * 将15分钟K线聚合为日线K线（通过检测日期变化）
   */
  aggregateToDaily(candles15m) {
    const dailyMap = new Map()

    for (const candle of candles15m) {
      const timestamp = this.readCandleTimestamp(candle)
      const date = new Date(timestamp)
      const dateKey = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`

      if (!dailyMap.has(dateKey)) {
        dailyMap.set(dateKey, {
          timestamp: timestamp,
          open: this.readCandleValue(candle, 'open', 1),
          high: this.readCandleValue(candle, 'high', 2),
          low: this.readCandleValue(candle, 'low', 3),
          close: this.readCandleValue(candle, 'close', 4),
          volume: this.readCandleValue(candle, 'volume', 5)
        })
      } else {
        const daily = dailyMap.get(dateKey)
        daily.high = Math.max(daily.high, this.readCandleValue(candle, 'high', 2))
        daily.low = Math.min(daily.low, this.readCandleValue(candle, 'low', 3))
        daily.close = this.readCandleValue(candle, 'close', 4)
        daily.volume += this.readCandleValue(candle, 'volume', 5)
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

  calculateSARSignal(candles) {
    const series = this.calculateSARSeries(candles)
    return this.pickConfirmedSar(series)
  }

  pickConfirmedSar(series) {
    if (!Array.isArray(series) || series.length === 0) {
      return { value: 0, signal: 'long', prevSignal: null, isReversal: false }
    }
    const index = series.length >= 2 ? series.length - 2 : series.length - 1
    return series[index] || { value: 0, signal: 'long', prevSignal: null, isReversal: false }
  }

  /**
   * 计算SAR序列
   */
  calculateSARSeries(candles) {
    if (!Array.isArray(candles) || candles.length < 2) return []

    const highs = candles.map(c => this.readCandleValue(c, 'high', 2))
    const lows = candles.map(c => this.readCandleValue(c, 'low', 3))
    const closes = candles.map(c => this.readCandleValue(c, 'close', 4))

    let isLong = closes[1] >= closes[0]
    let af = 0.02
    let ep = isLong ? highs[0] : lows[0]
    let sar = isLong ? lows[0] : highs[0]

    const series = []

    // 第一个点
    series.push({
      value: sar,
      signal: isLong ? 'long' : 'short',
      prevSignal: null,
      isReversal: false
    })

    for (let i = 1; i < highs.length; i++) {
      const wasLong = isLong

      if (isLong) {
        sar = sar + af * (ep - sar)
        if (lows[i] < sar) {
          isLong = false
          sar = ep
          ep = lows[i]
          af = 0.02
        } else {
          if (highs[i] > ep) {
            ep = highs[i]
            af = Math.min(af + 0.02, 0.2)
          }
        }
      } else {
        sar = sar + af * (ep - sar)
        if (highs[i] > sar) {
          isLong = true
          sar = ep
          ep = highs[i]
          af = 0.02
        } else {
          if (lows[i] < ep) {
            ep = lows[i]
            af = Math.min(af + 0.02, 0.2)
          }
        }
      }

      series.push({
        value: sar,
        signal: isLong ? 'long' : 'short',
        prevSignal: wasLong ? 'long' : 'short',
        isReversal: wasLong !== isLong
      })
    }

    return series
  }

  readCandleValue(candle, key, index) {
    if (Array.isArray(candle)) {
      return parseFloat(candle[index])
    }
    return parseFloat(candle[key])
  }

  readCandleTimestamp(candle) {
    if (Array.isArray(candle)) {
      return parseInt(candle[0])
    }
    if (candle && candle.time !== undefined) {
      return parseInt(candle.time)
    }
    if (candle && candle.timestamp !== undefined) {
      return parseInt(candle.timestamp)
    }
    return NaN
  }

  /**
   * 清除缓存
   */
  clearCache() {
    this.indicatorCache.clear()
    console.log('🗑️ 指标缓存已清除')
  }
}

// 导出单例
const strategyValidator = new StrategyValidator()

module.exports = {
  strategyValidator,
  StrategyValidator
}
