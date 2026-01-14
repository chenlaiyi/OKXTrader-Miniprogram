// pages/market/market.js
const API = require('../../services/api.js');

Page({
  data: {
    loading: true,
    isConnected: false,
    // 当前选中交易对（默认ETH，与iOS保持一致）
    selectedPair: {
      instId: 'ETH-USDT',
      baseCcy: 'ETH',
      quoteCcy: 'USDT',
      displayName: 'ETH/USDT'
    },
    // 当前行情数据
    currentTicker: null,
    // 交易对列表（与iOS保持一致）
    pairs: [
      { instId: 'BTC-USDT', baseCcy: 'BTC', quoteCcy: 'USDT', displayName: 'BTC/USDT' },
      { instId: 'ETH-USDT', baseCcy: 'ETH', quoteCcy: 'USDT', displayName: 'ETH/USDT' },
      { instId: 'SOL-USDT', baseCcy: 'SOL', quoteCcy: 'USDT', displayName: 'SOL/USDT' },
      { instId: 'XRP-USDT', baseCcy: 'XRP', quoteCcy: 'USDT', displayName: 'XRP/USDT' },
      { instId: 'DOGE-USDT', baseCcy: 'DOGE', quoteCcy: 'USDT', displayName: 'DOGE/USDT' },
      { instId: 'ADA-USDT', baseCcy: 'ADA', quoteCcy: 'USDT', displayName: 'ADA/USDT' },
      { instId: 'AVAX-USDT', baseCcy: 'AVAX', quoteCcy: 'USDT', displayName: 'AVAX/USDT' },
      { instId: 'LINK-USDT', baseCcy: 'LINK', quoteCcy: 'USDT', displayName: 'LINK/USDT' }
    ],
    // 行情数据字典
    tickers: {},
    // K线数据
    candleData: [],
    // 指标数据
    sarData: [],
    macdData: [],
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
    filteredMarkets: []
  },

  onLoad() {
    this.connect();
  },

  /**
   * 连接并加载数据
   */
  connect: function() {
    console.log('🚀 开始加载行情数据...');
    this.setData({ loading: true });

    var that = this;

    wx.request({
      url: 'https://ly.ddg.org.cn/api/markets?instType=SPOT',
      method: 'GET',
      dataType: 'json',
      header: {
        'content-type': 'application/json'
      },
      success: function(res) {
        console.log('✅ 行情数据获取成功');
        that.setData({ loading: false });

        if (res.statusCode === 200 && res.data && res.data.success) {
          console.log('📊 收到 ' + res.data.data.length + ' 个交易对数据');
          that.processMarketData(res.data.data);
        } else {
          console.error('❌ 数据格式错误:', res);
          wx.showToast({
            title: '数据格式错误',
            icon: 'none'
          });
        }
      },
      fail: function(err) {
        console.error('❌ 行情数据获取失败:', err);
        that.setData({
          loading: false,
          isConnected: false
        });
        wx.showToast({
          title: '网络请求失败',
          icon: 'none'
        });
      }
    });
  },

  /**
   * 处理市场数据
   */
  processMarketData: function(markets) {
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

    // 使用tickerUpdates设置ETH
    var ethTicker = tickerUpdates['ETH-USDT'];
    console.log('🔍 检查ETH ticker:', {
      hasTicker: !!ethTicker,
      tickerKeys: Object.keys(tickerUpdates)
    });

    if (ethTicker) {
      console.log('✅ 找到ETH ticker，准备更新显示');
      this.setData({
        currentTicker: ethTicker
      }, function() {
        console.log('🔄 setData回调执行，开始更新显示数据');
        this.updateDisplayData();
        // 加载K线数据
        console.log('🔄 准备调用loadCandles');
        this.loadCandles();
      });
    } else {
      console.warn('⚠️ 未找到ETH ticker，无法加载K线');
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
  },

  /**
   * 加载K线数据
   */
  loadCandles: function() {
    var that = this;
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
        console.log('✅ 指标计算完成:', {
          sarCount: sarData.length,
          macdCount: macdData.length
        });

        // 输出第一条数据用于调试
        console.log('📊 第一条K线数据:', candles[0]);
        console.log('📊 最后一条K线数据:', candles[candles.length - 1]);

        that.setData({
          candleData: candles,
          sarData: sarData,
          macdData: macdData,
          loadingCandles: false
        });

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
   * 刷新数据
   */
  refresh: function() {
    console.log('🔄 刷新数据...');
    this.connect();
  },

  /**
   * 下拉刷新
   */
  onPullDownRefresh: function() {
    this.refresh();
    wx.stopPullDownRefresh();
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
   * 计算MACD指标
   */
  calculateMACD: function(candles) {
    if (candles.length < 26) return [];

    var closes = candles.map(function(c) { return parseFloat(c.close); });

    // 计算EMA12和EMA26
    var ema12 = this.calculateEMA(closes, 12);
    var ema26 = this.calculateEMA(closes, 26);

    // 计算MACD线 (DIF)
    var macdLine = [];
    var startIndex = 26 - 12; // 对齐数组

    for (var i = 0; i < ema26.length; i++) {
      macdLine.push(ema12[i + startIndex] - ema26[i]);
    }

    // 计算信号线 (DEA) - MACD的9日EMA
    var deaLine = this.calculateEMA(macdLine, 9);

    // 计算MACD柱状图 (MACD - DEA)
    var histogram = [];
    for (var i = 0; i < deaLine.length; i++) {
      histogram.push(macdLine[i + 8] - deaLine[i]); // 对齐数组
    }

    // 补齐数据，返回与candles长度相同的数组
    var result = [];
    for (var i = 0; i < candles.length; i++) {
      var histIndex = i - 34; // 26 + 9 - 1 = 34
      if (histIndex >= 0 && histIndex < histogram.length) {
        var currentMACD = macdLine[histIndex + 8] || 0;
        var currentSignal = deaLine[histIndex] || 0;

        // 检测金叉和死叉
        var crossType = null; // 'golden' (金叉) 或 'death' (死叉)

        if (histIndex > 0) {
          var prevMACD = macdLine[histIndex + 7] || 0;
          var prevSignal = deaLine[histIndex - 1] || 0;

          // 金叉：MACD线从下向上穿越信号线
          if (prevMACD <= prevSignal && currentMACD > currentSignal) {
            crossType = 'golden';
          }
          // 死叉：MACD线从上向下穿越信号线
          else if (prevMACD >= prevSignal && currentMACD < currentSignal) {
            crossType = 'death';
          }
        }

        result.push({
          macd: currentMACD,
          signal: currentSignal,
          histogram: histogram[histIndex] || 0,
          crossType: crossType
        });
      } else {
        result.push({ macd: 0, signal: 0, histogram: 0, crossType: null });
      }
    }

    return result;
  }
});
