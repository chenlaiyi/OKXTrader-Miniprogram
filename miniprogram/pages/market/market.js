// pages/market/market.js
const API = require('../../services/api.js');

const FALLBACK_USER_ID = 'default';

function getCurrentUserId() {
  const userInfo = wx.getStorageSync('userInfo');
  return (userInfo && userInfo.id) ? userInfo.id : FALLBACK_USER_ID;
}

Page({
  data: {
    loading: true,
    refreshing: false,
    isConnected: false,
    // 当前选中交易对（默认ETH，与iOS保持一致）
    selectedPair: {
      instId: 'ETH-USDT-SWAP',
      baseCcy: 'ETH',
      quoteCcy: 'USDT',
      displayName: 'ETH/USDT'
    },
    // 当前行情数据
    currentTicker: null,
    // 交易对列表（与iOS保持一致）
    pairs: [
      { instId: 'BTC-USDT-SWAP', baseCcy: 'BTC', quoteCcy: 'USDT', displayName: 'BTC/USDT' },
      { instId: 'ETH-USDT-SWAP', baseCcy: 'ETH', quoteCcy: 'USDT', displayName: 'ETH/USDT' },
      { instId: 'SOL-USDT-SWAP', baseCcy: 'SOL', quoteCcy: 'USDT', displayName: 'SOL/USDT' },
      { instId: 'XRP-USDT-SWAP', baseCcy: 'XRP', quoteCcy: 'USDT', displayName: 'XRP/USDT' },
      { instId: 'DOGE-USDT-SWAP', baseCcy: 'DOGE', quoteCcy: 'USDT', displayName: 'DOGE/USDT' },
      { instId: 'ADA-USDT-SWAP', baseCcy: 'ADA', quoteCcy: 'USDT', displayName: 'ADA/USDT' },
      { instId: 'AVAX-USDT-SWAP', baseCcy: 'AVAX', quoteCcy: 'USDT', displayName: 'AVAX/USDT' },
      { instId: 'LINK-USDT-SWAP', baseCcy: 'LINK', quoteCcy: 'USDT', displayName: 'LINK/USDT' }
    ],
    // 行情数据字典
    tickers: {},
    // K线数据
    candleData: [],
    // 指标数据
    sarData: [],
    macdData: [],
    rsiData: [],
    maData: { ma5: [], ma10: [], ma20: [], ma30: [] },
    emaData: { ema12: [], ema26: [] },
    bollData: [],
    // 当前显示的指标（新指标默认不显示）
    enabledIndicators: {
      sar: true,
      macd: true,
      rsi: false,
      ma: false,
      ema: false,
      boll: false
    },
    // 策略信号开关
    requireDailyTrend: true,
    enableSarReversal: true,
    tradeSignals: [],
    // K线时间周期
    timePeriod: '15m',
    loadingCandles: false,
    // 页面显示数据
    priceChangeClass: '',
    currentPrice: '--',
    priceChangeDisplay: '--',
    priceChangePercentDisplay: '--',
    high24h: '--',
    low24h: '--',
    volume24h: '--',
    // 市场列表（带格式化数据）
    filteredMarkets: [],
    // 新闻相关
    newsList: [],
    newsLoading: false,
    newsError: false,
    newsExpanded: true
  },

  onLoad() {
    this.connect();
    this.loadDefaultStrategy();
    this.loadNews();
  },

  onReady() {
    console.log('📱 页面onReady,确保K线图已渲染');
    // 确保K线图组件已渲染后再加载数据
    var that = this;
    setTimeout(function() {
      that.ensureCandles();
    }, 100);
  },

  onShow() {
    console.log('📱 页面onShow');
    this.startAutoRefresh();
    // 重新拉取策略开关，保证买卖点与策略联动
    this.loadDefaultStrategy();

    if (!this.data.loading) {
      this.ensureCandles();
    }

    if (!this.data.isConnected || !this.data.filteredMarkets || this.data.filteredMarkets.length === 0) {
      this.connect();
      return;
    }

    // 如果已有K线数据,强制刷新图表
    if (this.data.candleData && this.data.candleData.length > 0) {
      console.log('📊 已有K线数据,强制刷新图表');
      this.forceRefreshChart();
    }
  },

  /**
   * 加载默认策略配置，用于信号标记
   */
  loadDefaultStrategy: function() {
    var that = this;
    const userId = getCurrentUserId();

    API.getStrategyList(userId).then(function(res) {
      if (!(res && res.success && Array.isArray(res.data) && res.data.length > 0)) {
        return;
      }

      var defaultStrategy = res.data.find(function(s) { return s.is_default; }) || res.data[0];
      if (!defaultStrategy || !defaultStrategy.id) return;

      API.getStrategyDetail(defaultStrategy.id).then(function(detailRes) {
        if (!detailRes || !detailRes.success || !detailRes.data) return;

        var conditions = (detailRes.data.buy_strategy && detailRes.data.buy_strategy.conditions) || [];
        var flags = that.parseStrategySignalFlags(conditions);

        that.setData({
          requireDailyTrend: flags.requireDailyTrend,
          enableSarReversal: flags.enableSarReversal
        }, function() {
          if (that.data.candleData && that.data.candleData.length > 0) {
            var tradeSignals = that.generateTradeSignals(
              that.data.candleData,
              that.data.sarData
            );
            console.log('📌 策略开关更新后信号数:', tradeSignals.length);
            that.setData({ tradeSignals: tradeSignals });
            that.forceRefreshChart();
          }
        });
      });
    }).catch(function(err) {
      console.warn('⚠️ 加载默认策略失败:', err);
    });
  },

  /**
   * 解析策略信号开关
   */
  parseStrategySignalFlags: function(conditions) {
    var requireDailyTrend = false;
    var enableSarReversal = false;

    (conditions || []).forEach(function(cond) {
      if (!cond) return;
      var enabled = (cond.enabled !== undefined) ? cond.enabled : cond.isEnabled;
      if (enabled === false) return;
      if (cond.indicator === 'sar' && (cond.timeframe === '1D' || cond.timeframe === 'daily')) {
        requireDailyTrend = true;
      }
      if (cond.indicator === 'sar' && cond.timeframe === '15m' && (cond.operator === 'reversal' || cond.reversal)) {
        enableSarReversal = true;
      }
    });

    if (!enableSarReversal) {
      enableSarReversal = true;
    }

    return {
      requireDailyTrend: requireDailyTrend,
      enableSarReversal: enableSarReversal
    };
  },

  onHide() {
    this.stopAutoRefresh();
  },

  onUnload() {
    this.stopAutoRefresh();
  },

  /**
   * 连接并加载数据
   */
  connect: function() {
    console.log('🚀 开始加载行情数据...');
    this.loadMarkets({ silent: false, skipCandles: false });
  },

  /**
   * 加载市场行情
   */
  loadMarkets: function(options) {
    var that = this;
    var opts = options || {};
    var silent = !!opts.silent;

    if (!silent) {
      this.setData({ loading: true });
    }

    API.getMarkets('SWAP').then(function(res) {
      if (!silent) {
        that.setData({ loading: false });
      }

      if (res && res.success && Array.isArray(res.data)) {
        console.log('✅ 行情数据获取成功, 数量:', res.data.length);
        that.processMarketData(res.data, { skipCandles: !!opts.skipCandles });
      } else {
        console.error('❌ 数据格式错误:', res);
        if (!silent) {
          wx.showToast({
            title: '数据格式错误',
            icon: 'none'
          });
        }
        if (!opts.skipCandles) {
          that.loadCandles();
        }
      }
    }).catch(function(err) {
      console.error('❌ 行情数据获取失败:', err);
      if (!silent) {
        that.setData({
          loading: false,
          isConnected: false
        });
        wx.showToast({
          title: '网络请求失败',
          icon: 'none'
        });
      }
      if (!opts.skipCandles) {
        that.loadCandles();
      }
    });
  },

  /**
   * 自动刷新
   */
  startAutoRefresh: function() {
    this.stopAutoRefresh();
    var that = this;

    this._marketTimer = setInterval(function() {
      if (that.data.loading) return;
      that.loadMarkets({ silent: true, skipCandles: true });
    }, 5000);

    this._candleTimer = setInterval(function() {
      if (that.data.loadingCandles) return;
      that.loadCandles();
    }, 30000);
  },

  stopAutoRefresh: function() {
    if (this._marketTimer) {
      clearInterval(this._marketTimer);
      this._marketTimer = null;
    }
    if (this._candleTimer) {
      clearInterval(this._candleTimer);
      this._candleTimer = null;
    }
  },

  /**
   * 处理市场数据
   */
  processMarketData: function(markets, options) {
    var opts = options || {};
    console.log('📊 开始处理市场数据，数量:', markets.length);

    // 收集所有ticker更新
    var tickerUpdates = {};

    // 遍历我们的交易对列表，从API返回的数据中提取对应的行情
    for (var i = 0; i < this.data.pairs.length; i++) {
      var pair = this.data.pairs[i];
      var ticker = null;

      // 手动查找匹配的交易对
      for (var j = 0; j < markets.length; j++) {
        if (markets[j].instId === pair.instId) {
          ticker = markets[j];
          break;
        }
      }

      if (ticker) {
        var last = parseFloat(ticker.last);
        var open24h = parseFloat(ticker.open24h);
        var change24h = last - open24h;
        var changePercent = open24h > 0 ? (change24h / open24h) * 100 : 0;

        tickerUpdates[pair.instId] = {
          instId: ticker.instId,
          last: last,
          high24h: parseFloat(ticker.high24h),
          low24h: parseFloat(ticker.low24h),
          vol24h: parseFloat(ticker.vol24h || '0'),
          volCcy24h: parseFloat(ticker.volCcy24h || '0'),
          change24h: change24h,
          changePercent: changePercent,
          bidPx: parseFloat(ticker.bidPx || '0'),
          askPx: parseFloat(ticker.askPx || '0'),
          timestamp: new Date()
        };

        console.log('✅ ' + pair.instId + ' 行情获取成功:', tickerUpdates[pair.instId].last);
      } else {
        console.warn('⚠️ 未找到 ' + pair.instId + ' 的行情数据');
      }
    }

    // 一次性更新所有ticker
    console.log('📦 准备更新tickers:', Object.keys(tickerUpdates));
    this.setData({
      tickers: tickerUpdates,
      isConnected: true
    });

    var selectedInstId = (this.data.selectedPair && this.data.selectedPair.instId) ? this.data.selectedPair.instId : 'ETH-USDT-SWAP';
    var selectedTicker = tickerUpdates[selectedInstId] || this.data.currentTicker;

    console.log('🔍 检查当前交易对 ticker:', {
      instId: selectedInstId,
      hasTicker: !!selectedTicker,
      tickerKeys: Object.keys(tickerUpdates)
    });

    if (selectedTicker) {
      this.setData({
        currentTicker: selectedTicker
      }, function() {
        console.log('🔄 setData回调执行，开始更新显示数据');
        this.updateDisplayData();
        if (!opts.skipCandles) {
          console.log('🔄 准备调用loadCandles');
          if (wx.nextTick) {
            wx.nextTick(() => this.loadCandles());
          } else {
            setTimeout(() => this.loadCandles(), 0);
          }
        }
      });
    } else {
      console.warn('⚠️ 未找到当前交易对ticker');
      if (!opts.skipCandles) {
        this.loadCandles();
      }
    }
  },

  /**
   * 获取所有交易对的行情数据（与iOS端fetchAllTickers保持一致）
   */
  fetchAllTickers: function() {
    // 这个方法暂时不用，改用直接wx.request
  },

  /**
   * 选择交易对
   */
  selectPair: function(e) {
    var pair = e.currentTarget.dataset.pair;
    console.log('🔄 选择交易对:', pair.instId);

    // 切换到新交易对
    var ticker = this.data.tickers[pair.instId];

    this.setData({
      selectedPair: pair,
      currentTicker: ticker
    });

    // 更新显示数据
    if (ticker) {
      this.updateDisplayData();
    }

    // 加载K线数据
    this.loadCandles();
  },

  /**
   * 更新页面显示数据
   */
  updateDisplayData: function() {
    var ticker = this.data.currentTicker;
    if (!ticker) return;

    // 计算价格变化样式
    var isUp = ticker.change24h >= 0;
    var priceChangeClass = isUp ? '' : 'red';

    // 构建filteredMarkets数组
    var filteredMarkets = [];
    for (var i = 0; i < this.data.pairs.length; i++) {
      var pair = this.data.pairs[i];
      var t = this.data.tickers[pair.instId];

      if (!t) {
        filteredMarkets.push({
          instId: pair.instId,
          baseCcy: pair.baseCcy,
          quoteCcy: pair.quoteCcy,
          displayName: pair.displayName,
          last: '--',
          changeDisplay: '--',
          changeClass: ''
        });
      } else {
        var tIsUp = t.change24h >= 0;
        filteredMarkets.push({
          instId: pair.instId,
          baseCcy: pair.baseCcy,
          quoteCcy: pair.quoteCcy,
          displayName: pair.displayName,
          last: this.formatPrice(t.last),
          changeDisplay: this.formatChangePercent(t.changePercent),
          changeClass: tIsUp ? '' : 'red'
        });
      }
    }

    this.setData({
      priceChangeClass: priceChangeClass,
      currentPrice: this.formatPrice(ticker.last),
      priceChangeDisplay: (ticker.change24h >= 0 ? '+' : '') + this.formatPrice(ticker.change24h),
      priceChangePercentDisplay: this.formatChangePercent(ticker.changePercent),
      high24h: this.formatPrice(ticker.high24h),
      low24h: this.formatPrice(ticker.low24h),
      volume24h: this.formatVolume(ticker.volCcy24h),
      filteredMarkets: filteredMarkets
    });
    this.ensureCandles();
  },

  ensureCandles: function() {
    if (this.data.loadingCandles) return;
    if (!this.data.candleData || this.data.candleData.length === 0) {
      if (wx.nextTick) {
        wx.nextTick(() => this.loadCandles());
      } else {
        setTimeout(() => this.loadCandles(), 0);
      }
    }
  },

  /**
   * 加载K线数据
   */
  loadCandles: function() {
    var that = this;
    if (this.data.loadingCandles) return;
    if (!this.data.selectedPair || !this.data.selectedPair.instId) {
      console.warn('⚠️ 未设置交易对，无法加载K线');
      return;
    }
    var instId = this.data.selectedPair.instId;
    var period = this.data.timePeriod;

    console.log('📊 ========== 开始加载K线数据 ==========');
    console.log('📊 交易对:', instId);
    console.log('📊 周期:', period);
    console.log('📊 请求数量:', 100);

    this.setData({ loadingCandles: true });

    API.getCandles(instId, period, 100).then(function(res) {
      console.log('✅ API响应成功');
      console.log('📊 响应数据:', res);

      if (res.success && res.data && Array.isArray(res.data)) {
        console.log('📊 原始数据条数:', res.data.length);
        console.log('📊 第一条原始数据:', res.data[0]);

        // 转换K线数据格式，并过滤无效数据
        var candles = [];
        for (var i = 0; i < res.data.length; i++) {
          var item = res.data[i];

          // 数据格式是对象：{time, open, high, low, close, volume}
          var open = parseFloat(item.open);
          var high = parseFloat(item.high);
          var low = parseFloat(item.low);
          var close = parseFloat(item.close);

          // 验证数据有效性
          if (isNaN(open) || isNaN(high) || isNaN(low) || isNaN(close)) {
            console.warn('⚠️ 跳过NaN数据，索引:', i, item);
            continue;
          }

          if (high < low) {
            console.warn('⚠️ 跳过异常数据(high < low)，索引:', i, item);
            continue;
          }

          candles.push({
            timestamp: item.time,
            open: open,
            high: high,
            low: low,
            close: close,
            volume: parseFloat(item.volume) || 0
          });
        }

        console.log('✅ 有效K线数据量:', candles.length);

        if (candles.length === 0) {
          console.error('❌ 没有有效的K线数据');
          that.setData({ loadingCandles: false });
          wx.showToast({
            title: '暂无K线数据',
            icon: 'none'
          });
          return;
        }

        // 反转数组，让最新的在右边
        candles.reverse();

        // 计算技术指标
        console.log('📈 开始计算技术指标...');
        var sarData = that.calculateSAR(candles);
        var macdData = that.calculateMACD(candles);
        var rsiData = that.calculateRSI(candles);
        var maData = {
          ma5: that.calculateMA(candles, 5),
          ma10: that.calculateMA(candles, 10),
          ma20: that.calculateMA(candles, 20),
          ma30: that.calculateMA(candles, 30)
        };
        var emaData = {
          ema12: that.calculateEMAFull(candles, 12),
          ema26: that.calculateEMAFull(candles, 26)
        };
        var bollData = that.calculateBOLL(candles);

        console.log('✅ 指标计算完成:', {
          sarCount: sarData.length,
          macdCount: macdData.length,
          rsiCount: rsiData.length,
          ma5Count: maData.ma5.length,
          bollCount: bollData.length
        });

        // 输出第一条数据用于调试
        console.log('📊 第一条K线数据:', candles[0]);
        console.log('📊 最后一条K线数据:', candles[candles.length - 1]);

        // 仅显示最近N根K线，提升宽度观感
        var displayLimit = 60;
        var displayStart = Math.max(0, candles.length - displayLimit);
        var displayCandles = candles.slice(displayStart);
        var displaySar = sarData.slice(displayStart);
        var displayMacd = macdData.slice(displayStart);

        var tradeSignals = that.generateTradeSignals(displayCandles, displaySar);
        console.log('📌 K线信号数:', tradeSignals.length);

        that.setData({
          candleData: displayCandles,
          sarData: displaySar,
          macdData: displayMacd,
          rsiData: rsiData.slice(displayStart),
          maData: {
            ma5: maData.ma5.slice(displayStart),
            ma10: maData.ma10.slice(displayStart),
            ma20: maData.ma20.slice(displayStart),
            ma30: maData.ma30.slice(displayStart)
          },
          emaData: {
            ema12: emaData.ema12.slice(displayStart),
            ema26: emaData.ema26.slice(displayStart)
          },
          bollData: bollData.slice(displayStart),
          tradeSignals: tradeSignals,
          loadingCandles: false
        });

        that.forceRefreshChart();

        console.log('✅ ========== K线数据处理完成 ==========');
      } else {
        console.error('❌ K线数据格式错误:', res);
        that.setData({ loadingCandles: false });
        wx.showToast({
          title: 'K线数据格式错误',
          icon: 'none'
        });
      }
    }).catch(function(err) {
      console.error('❌ ========== K线数据获取失败 ==========');
      console.error('❌ 错误信息:', err);
      that.setData({ loadingCandles: false });
      wx.showToast({
        title: 'K线数据加载失败',
        icon: 'none'
      });
    });
  },

  forceRefreshChart: function(retry) {
    var attempt = typeof retry === 'number' ? retry : 0;
    var chart = this.selectComponent('#candlestickChart');

    console.log('🔄 尝试刷新K线图组件, 尝试次数:', attempt);

    if (chart && chart.refresh) {
      console.log('✅ K线图组件找到,执行刷新');
      chart.refresh();
      return;
    }

    if (attempt < 15) {
      console.log('⏳ K线图组件未就绪,200ms后重试...');
      setTimeout(() => this.forceRefreshChart(attempt + 1), 200);
    } else {
      console.error('❌ K线图组件初始化超时');
    }
  },

  /**
   * 切换时间周期
   */
  switchTimePeriod: function(e) {
    var period = e.currentTarget.dataset.period;
    console.log('🔄 切换时间周期:', period);

    if (period === this.data.timePeriod) {
      return;
    }

    this.setData({ timePeriod: period });
    this.loadCandles();
  },

  /**
   * 切换指标显示
   */
  toggleIndicator: function(e) {
    var indicator = e.currentTarget.dataset.indicator;
    console.log('🔄 切换指标:', indicator);

    var enabledIndicators = this.data.enabledIndicators;
    enabledIndicators[indicator] = !enabledIndicators[indicator];

    this.setData({
      enabledIndicators: enabledIndicators
    });

    // 刷新K线图
    this.forceRefreshChart();
  },

  /**
   * 刷新数据（带科技感动画）
   */
  refresh: function() {
    var that = this;
    console.log('🔄 刷新数据...');

    // 显示科技感刷新动画
    this.setData({ refreshing: true });

    // 加载数据
    setTimeout(function() {
      that.connect();

      // 1.5秒后隐藏动画
      setTimeout(function() {
        that.setData({ refreshing: false });
      }, 1500);
    }, 100);
  },

  /**
   * 下拉刷新
   */
  onPullDownRefresh: function() {
    this.refresh();
    setTimeout(function() {
      wx.stopPullDownRefresh();
    }, 1500);
  },

  /**
   * 格式化价格显示（与iOS端formatPrice保持一致）
   */
  formatPrice(price) {
    if (price === null || price === undefined) {
      return '--';
    }

    const num = parseFloat(price);

    if (num < 0.001) {
      return num.toFixed(8);
    } else if (num < 1) {
      return num.toFixed(4);
    } else {
      return num.toFixed(2);
    }
  },

  /**
   * 格式化涨跌幅显示
   */
  formatChangePercent(percent) {
    if (percent === null || percent === undefined) {
      return '--';
    }

    const num = parseFloat(percent);
    const sign = num >= 0 ? '+' : '';
    return `${sign}${num.toFixed(2)}%`;
  },

  /**
   * 格式化成交量显示
   */
  formatVolume(vol) {
    if (!vol) return '--';

    const num = parseFloat(vol);

    if (num >= 100000000) {
      return (num / 100000000).toFixed(2) + '亿';
    } else if (num >= 10000) {
      return (num / 10000).toFixed(2) + '万';
    } else {
      return num.toFixed(2);
    }
  },

  /**
   * 计算SAR指标（抛物线转向）
   */
  calculateSAR: function(candles) {
    if (candles.length < 5) return [];

    var sar = [];
    var isUpTrend = true;
    var af = 0.02; // 加速因子
    var ep = candles[0].high; // 极值点
    var sarValue = candles[0].low; // SAR值

    for (var i = 0; i < candles.length; i++) {
      var high = parseFloat(candles[i].high);
      var low = parseFloat(candles[i].low);

      // 记录趋势变化前的状态
      var wasUpTrend = isUpTrend;

      if (isUpTrend) {
        sarValue = sarValue + af * (ep - sarValue);

        if (low < sarValue) {
          // 反转：从上升趋势转为下降趋势
          isUpTrend = false;
          sarValue = ep;
          ep = low;
          af = 0.02;
        } else {
          if (high > ep) {
            ep = high;
            af = Math.min(af + 0.02, 0.2);
          }
        }
      } else {
        sarValue = sarValue + af * (ep - sarValue);

        if (high > sarValue) {
          // 反转：从下降趋势转为上升趋势
          isUpTrend = true;
          sarValue = ep;
          ep = high;
          af = 0.02;
        } else {
          if (low < ep) {
            ep = low;
            af = Math.min(af + 0.02, 0.2);
          }
        }
      }

      // 检测是否是反转点（趋势发生了变化）
      var isReversal = (wasUpTrend !== isUpTrend);

      sar.push({
        value: sarValue,
        trend: isUpTrend ? 'up' : 'down',
        isReversal: isReversal
      });
    }

    return sar;
  },

  /**
   * 计算EMA（指数移动平均）
   */
  calculateEMA: function(data, period) {
    if (data.length < period) return [];

    var ema = [];
    var multiplier = 2 / (period + 1);

    // 第一个EMA使用SMA
    var sum = 0;
    for (var i = 0; i < period; i++) {
      sum += parseFloat(data[i]);
    }
    ema.push(sum / period);

    // 后续使用EMA公式
    for (var i = period; i < data.length; i++) {
      var currentEMA = (parseFloat(data[i]) - ema[ema.length - 1]) * multiplier + ema[ema.length - 1];
      ema.push(currentEMA);
    }

    return ema;
  },

  /**
   * 生成买卖信号（纯SAR策略）
   * - 日线方向可开关
   * - 仅使用SAR反转白点
   * - 回看一根K线避免闪烁
   */
  generateTradeSignals: function(candles, sarData) {
    var signals = [];
    if (!candles || !sarData) return signals;

    var length = Math.min(candles.length, sarData.length);
    if (length < 2) return signals;

    var requireDailyTrend = this.data.requireDailyTrend;
    var enableSarReversal = this.data.enableSarReversal;
    var dailySarMap = requireDailyTrend ? this.buildDailySarMap(candles) : null;

    // 回看一根K线：使用上一根信号
    for (var i = 1; i < length; i++) {
      var idx = i - 1;
      var sar = sarData[idx];
      if (!sar) continue;

      var signalType = null;

      // SAR反转（白点）
      if (enableSarReversal && sar.isReversal) {
        signalType = sar.trend === 'up' ? 'buy' : 'sell';
      }

      if (!signalType) continue;

      // 日线方向过滤（冲突时忽略）
      if (requireDailyTrend && dailySarMap) {
        var dayKey = this.getDateKey(candles[idx].timestamp);
        var dailyTrend = dailySarMap[dayKey];
        if (dailyTrend) {
          var allowed = dailyTrend === 'up' ? 'buy' : 'sell';
          if (signalType !== allowed) {
            continue;
          }
        }
      }

      signals.push({ index: idx, type: signalType });
    }

    return signals;
  },

  /**
   * 构建日线SAR方向映射（按日期）
   */
  buildDailySarMap: function(candles) {
    var dailyCandles = [];
    var dailyKeys = [];

    for (var i = 0; i < candles.length; i++) {
      var candle = candles[i];
      var ts = this.normalizeTimestamp(candle.timestamp);
      var dateKey = this.getDateKey(ts);

      if (dailyKeys.length === 0 || dailyKeys[dailyKeys.length - 1] !== dateKey) {
        dailyKeys.push(dateKey);
        dailyCandles.push({
          timestamp: ts,
          open: parseFloat(candle.open),
          high: parseFloat(candle.high),
          low: parseFloat(candle.low),
          close: parseFloat(candle.close)
        });
      } else {
        var last = dailyCandles[dailyCandles.length - 1];
        last.high = Math.max(last.high, parseFloat(candle.high));
        last.low = Math.min(last.low, parseFloat(candle.low));
        last.close = parseFloat(candle.close);
      }
    }

    var dailySar = this.calculateSAR(dailyCandles);
    var map = {};
    for (var j = 0; j < dailyCandles.length; j++) {
      var key = dailyKeys[j];
      var sarPoint = dailySar[j];
      if (sarPoint) {
        map[key] = sarPoint.trend;
      }
    }

    return map;
  },

  normalizeTimestamp: function(ts) {
    var num = parseInt(ts, 10);
    if (isNaN(num)) return 0;
    if (num < 10000000000) {
      return num * 1000;
    }
    return num;
  },

  getDateKey: function(ts) {
    var num = this.normalizeTimestamp(ts);
    if (!num) return '';
    var date = new Date(num);
    var month = (date.getMonth() + 1).toString().padStart(2, '0');
    var day = date.getDate().toString().padStart(2, '0');
    return date.getFullYear() + '-' + month + '-' + day;
  },

  /**
   * 计算MACD指标（专业版）
   * 参数：快线12，慢线26，信号线9
   */
  calculateMACD: function(candles) {
    if (candles.length < 26) return [];

    // 提取收盘价数组
    var closes = [];
    for (var i = 0; i < candles.length; i++) {
      closes.push(parseFloat(candles[i].close));
    }

    // 计算EMA(12) - 快线
    var ema12 = this.calculateEMAArray(closes, 12);

    // 计算EMA(26) - 慢线
    var ema26 = this.calculateEMAArray(closes, 26);

    // 计算DIF = EMA(12) - EMA(26)
    var dif = [];
    for (var i = 0; i < ema12.length && i < ema26.length; i++) {
      dif.push(ema12[i] - ema26[i]);
    }

    // 计算DEA = EMA(DIF, 9) - 信号线
    var dea = this.calculateEMAArray(dif, 9);

    // 计算MACD柱 = (DIF - DEA) * 2
    var macd = [];
    for (var i = 0; i < dif.length && i < dea.length; i++) {
      macd.push({
        macd: dif[i],
        signal: dea[i],
        histogram: (dif[i] - dea[i]) * 2,
        crossType: null // 用于标记金叉/死叉
      });
    }

    // 检测金叉和死叉
    for (var j = 1; j < macd.length; j++) {
      var prev = macd[j - 1];
      var curr = macd[j];

      // 金叉：DIF从下方穿越DEA
      if (prev.macd <= prev.signal && curr.macd > curr.signal) {
        curr.crossType = 'golden';
      }
      // 死叉：DIF从上方穿越DEA
      else if (prev.macd >= prev.signal && curr.macd < curr.signal) {
        curr.crossType = 'death';
      }
    }

    // 前置填充，使MACD数组长度与K线数组长度一致
    var result = [];
    var startIndex = candles.length - macd.length;
    for (var k = 0; k < candles.length; k++) {
      if (k < startIndex) {
        result.push({ macd: 0, signal: 0, histogram: 0, crossType: null });
      } else {
        result.push(macd[k - startIndex]);
      }
    }

    return result;
  },

  /**
   * 计算EMA数组（优化版）
   */
  calculateEMAArray: function(data, period) {
    if (data.length < period) return [];

    var ema = [];
    var multiplier = 2 / (period + 1);

    // 第一个EMA使用SMA
    var sum = 0;
    for (var i = 0; i < period; i++) {
      sum += data[i];
    }
    ema.push(sum / period);

    // 后续使用EMA公式
    for (var i = period; i < data.length; i++) {
      var currentEMA = (data[i] - ema[ema.length - 1]) * multiplier + ema[ema.length - 1];
      ema.push(currentEMA);
    }

    return ema;
  },

  /**
   * 计算RSI指标（相对强弱指标）
   * period: 14
   */
  calculateRSI: function(candles, period) {
    if (!period) period = 14;
    if (candles.length < period + 1) return [];

    var rsi = [];
    var gains = [];
    var losses = [];

    // 计算价格变化
    for (var i = 1; i < candles.length; i++) {
      var change = parseFloat(candles[i].close) - parseFloat(candles[i - 1].close);
      gains.push(change > 0 ? change : 0);
      losses.push(change < 0 ? Math.abs(change) : 0);
    }

    // 初始平均增益和损失
    var avgGain = 0;
    var avgLoss = 0;
    for (var i = 0; i < period; i++) {
      avgGain += gains[i];
      avgLoss += losses[i];
    }
    avgGain = avgGain / period;
    avgLoss = avgLoss / period;

    // 前置填充，使RSI数组长度与K线数组一致
    for (var k = 0; k < period; k++) {
      rsi.push(null);
    }

    // 计算第一个RSI值
    var rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    rsi.push(100 - (100 / (1 + rs)));

    // 后续使用平滑方法
    for (var j = period; j < gains.length; j++) {
      avgGain = (avgGain * (period - 1) + gains[j]) / period;
      avgLoss = (avgLoss * (period - 1) + losses[j]) / period;

      rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
      rsi.push(100 - (100 / (1 + rs)));
    }

    // 添加最后一个null以保持长度一致
    rsi.push(null);

    return rsi;
  },

  /**
   * 计算MA（简单移动平均线）
   */
  calculateMA: function(candles, period) {
    if (candles.length < period) return [];

    var ma = [];

    // 前置填充null
    for (var i = 0; i < period - 1; i++) {
      ma.push(null);
    }

    // 计算MA
    for (var j = period - 1; j < candles.length; j++) {
      var sum = 0;
      for (var k = 0; k < period; k++) {
        sum += parseFloat(candles[j - k].close);
      }
      ma.push(sum / period);
    }

    return ma;
  },

  /**
   * 计算完整的EMA数组（与K线长度一致）
   */
  calculateEMAFull: function(candles, period) {
    if (candles.length < period) return [];

    var closes = [];
    for (var i = 0; i < candles.length; i++) {
      closes.push(parseFloat(candles[i].close));
    }

    var emaValues = this.calculateEMAArray(closes, period);
    var ema = [];

    // 前置填充null
    for (var i = 0; i < period - 1; i++) {
      ema.push(null);
    }

    // 添加EMA值
    for (var j = 0; j < emaValues.length; j++) {
      ema.push(emaValues[j]);
    }

    return ema;
  },

  /**
   * 计算BOLL（布林带）
   * period: 20, multiplier: 2
   */
  calculateBOLL: function(candles, period, multiplier) {
    if (!period) period = 20;
    if (!multiplier) multiplier = 2;

    if (candles.length < period) return [];

    var boll = [];

    // 前置填充null
    for (var i = 0; i < period - 1; i++) {
      boll.push(null);
    }

    // 计算布林带
    for (var j = period - 1; j < candles.length; j++) {
      var sum = 0;
      var sumSquared = 0;

      for (var k = 0; k < period; k++) {
        var close = parseFloat(candles[j - k].close);
        sum += close;
        sumSquared += close * close;
      }

      var ma = sum / period;
      var variance = (sumSquared / period) - (ma * ma);
      var stdDev = Math.sqrt(Math.max(0, variance));

      boll.push({
        upper: ma + multiplier * stdDev,
        middle: ma,
        lower: ma - multiplier * stdDev
      });
    }

    return boll;
  },

  // ==================== 新闻相关方法 ====================

  /**
   * 加载新闻列表
   */
  loadNews: function() {
    var that = this;
    if (this.data.newsLoading) return;

    this.setData({ newsLoading: true, newsError: false });

    API.getNews(null, 1, 5).then(function(res) {
      if (res && res.success && Array.isArray(res.data)) {
        that.setData({
          newsList: res.data,
          newsLoading: false
        });
        console.log('📰 新闻加载成功，数量:', res.data.length);
      } else {
        that.setData({
          newsLoading: false,
          newsError: true
        });
        console.warn('⚠️ 新闻数据格式错误:', res);
      }
    }).catch(function(err) {
      console.error('❌ 加载新闻失败:', err);
      that.setData({
        newsLoading: false,
        newsError: true
      });
    });
  },

  /**
   * 刷新新闻
   */
  refreshNews: function() {
    this.loadNews();
  },

  /**
   * 展开/收起新闻列表
   */
  toggleNewsExpand: function() {
    this.setData({
      newsExpanded: !this.data.newsExpanded
    });
  },

  /**
   * 点击新闻项
   */
  onNewsTap: function(e) {
    var news = e.currentTarget.dataset.news;
    if (news && news.id) {
      // 跳转到新闻详情页
      wx.navigateTo({
        url: '/pages/news-detail/news-detail?id=' + news.id
      });
    }
  }
});
