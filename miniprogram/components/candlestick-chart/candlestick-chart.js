// components/candlestick-chart/candlestick-chart.js
Component({
  properties: {
    candles: {
      type: Array,
      value: []
    },
    sarData: {
      type: Array,
      value: []
    },
    macdData: {
      type: Array,
      value: []
    },
    rsiData: {
      type: Array,
      value: []
    },
    maData: {
      type: Object,
      value: { ma5: [], ma10: [], ma20: [], ma30: [] }
    },
    emaData: {
      type: Object,
      value: { ema12: [], ema26: [] }
    },
    bollData: {
      type: Array,
      value: []
    },
    tradeSignals: {
      type: Array,
      value: []
    },
    currentPrice: {
      type: String,
      value: '--'
    },
    height: {
      type: Number,
      value: 500
    },
    rightExtendCandles: {
      type: Number,
      value: 0
    },
    enabledIndicators: {
      type: Object,
      value: {
        sar: true,
        macd: true,
        rsi: false,
        ma: false,
        ema: false,
        boll: false
      }
    }
  },

  data: {
    canvasWidth: 0,
    canvasHeight: 0,
    canvasRect: null, // canvas 在页面中的位置信息
    ctx: null,
    // 十字线相关
    crosshair: {
      visible: false,
      x: 0,
      y: 0,
      candleIndex: -1,
      price: 0
    },
    // 性能优化：节流控制
    lastDrawTime: 0,
    drawThrottle: 50, // 50ms节流，约20fps，平衡性能和流畅度
    // 缓存绘图基础数据
    chartDataCache: null,
    priceRangeCache: null // 缓存价格范围计算
  },

  lifetimes: {
    attached() {
      this.updateCanvasSize();
    },
    ready() {
      // 确保组件布局完成后再校准一次尺寸
      this.updateCanvasSize(true);
    }
  },

  observers: {
    'candles, sarData, macdData, tradeSignals': function (candles, sarData, macdData, tradeSignals) {
      if (candles && candles.length > 0) {
        console.log('📈 开始绘制K线图，数据量:', candles.length);
        // 清除缓存，因为数据已更新
        this.setData({
          chartDataCache: null,
          priceRangeCache: null
        });
        this.safeDraw();
      }
    }
  },

  methods: {
    refresh: function () {
      this.safeDraw();
    },

    getRightExtendCandles: function (candlesLength) {
      const rawValue = this.properties.rightExtendCandles;
      const value = parseInt(rawValue, 10);
      if (!isNaN(value) && value > 0) {
        return value;
      }

      const length = typeof candlesLength === 'number' ? candlesLength : (this.properties.candles ? this.properties.candles.length : 0);
      if (!length) {
        return 0;
      }

      const autoExtend = Math.round(length * 0.18);
      const minExtend = 8;
      const maxExtend = 18;
      return Math.min(maxExtend, Math.max(minExtend, autoExtend));
    },

    initCanvas: function () {
      const that = this;
      try {
        const ctx = wx.createCanvasContext('candlestickCanvas', this);
        this.setData({ ctx: ctx }, () => {
          // Canvas准备好后，如果已有数据则立即绘制
          if (this.properties.candles && this.properties.candles.length > 0) {
            this.drawChart();
          }
        });
        console.log('✅ Canvas初始化完成');

        // 获取 canvas 在页面中的位置
        setTimeout(function () {
          that.getCanvasRect();
        }, 100);
      } catch (e) {
        console.error('❌ Canvas初始化失败:', e);
      }
    },

    updateCanvasSize: function (forceRedraw) {
      const that = this;
      let systemInfo;
      try {
        systemInfo = wx.getSystemInfoSync();
      } catch (e) {
        systemInfo = { windowWidth: 375 };
      }

      const screenWidth = systemInfo.windowWidth || 375;
      const heightPx = Math.max(1, Math.round(this.properties.height * (screenWidth / 750)));

      const applySize = function (widthPx) {
        const newWidth = Math.max(1, Math.round(widthPx || screenWidth));
        const newHeight = heightPx;
        const sizeChanged = newWidth !== that.data.canvasWidth || newHeight !== that.data.canvasHeight;

        that.setData({
          canvasWidth: newWidth,
          canvasHeight: newHeight
        }, () => {
          console.log('📐 Canvas尺寸:', { width: newWidth, height: newHeight, screenWidth: screenWidth });
          if (!that.data.ctx) {
            that.initCanvas();
          } else if (forceRedraw || sizeChanged) {
            that.drawChart();
          }
        });
      };

      try {
        const query = this.createSelectorQuery();
        query.select('#chartContainer').boundingClientRect(function (rect) {
          applySize(rect && rect.width ? rect.width : screenWidth);
        }).exec();
      } catch (e) {
        applySize(screenWidth);
      }
    },

    safeDraw: function () {
      if (!this.data.ctx || !this.data.canvasWidth || !this.data.canvasHeight) {
        this.updateCanvasSize();
        return;
      }

      if (wx.nextTick) {
        wx.nextTick(() => this.drawChart());
      } else {
        setTimeout(() => this.drawChart(), 0);
      }
    },

    getCanvasRect: function () {
      const that = this;
      const query = this.createSelectorQuery();
      query.select('#candlestickCanvas').boundingClientRect(function (rect) {
        if (rect) {
          console.log('📍 Canvas位置:', rect);
          that.setData({ canvasRect: rect });
        }
      }).exec();
    },

    drawChart: function () {
      const candles = this.properties.candles;
      if (!candles || candles.length === 0) {
        console.warn('⚠️ 没有K线数据');
        return;
      }

      const ctx = this.data.ctx;
      if (!ctx) {
        console.warn('⚠️ Canvas未初始化');
        return;
      }

      const width = this.data.canvasWidth;
      const height = this.data.canvasHeight;

      // 检查数据是否变化，如果没变化且只更新十字线，则跳过基础图表绘制
      const cacheKey = JSON.stringify({
        candlesLength: candles.length,
        sarLength: this.properties.sarData ? this.properties.sarData.length : 0,
        macdLength: this.properties.macdData ? this.properties.macdData.length : 0
      });

      const shouldRedrawBase = !this.data.chartDataCache || this.data.chartDataCache !== cacheKey;

      if (shouldRedrawBase) {
        this.setData({ chartDataCache: cacheKey });
      }

      // 计算价格范围
      let minPrice = Infinity;
      let maxPrice = -Infinity;
      const validCandles = [];

      for (let i = 0; i < candles.length; i++) {
        const candle = candles[i];
        const open = parseFloat(candle.open);
        const high = parseFloat(candle.high);
        const low = parseFloat(candle.low);
        const close = parseFloat(candle.close);

        if (isNaN(open) || isNaN(high) || isNaN(low) || isNaN(close)) {
          continue;
        }

        if (high < low) {
          continue;
        }

        validCandles.push(candle);
        minPrice = Math.min(minPrice, low);
        maxPrice = Math.max(maxPrice, high);
      }

      if (validCandles.length === 0) {
        console.error('❌ 没有有效的K线数据');
        return;
      }

      if (minPrice === maxPrice) {
        minPrice = minPrice * 0.999;
        maxPrice = maxPrice * 1.001;
      }

      const priceRange = maxPrice - minPrice;
      const padding = priceRange * 0.1;
      minPrice -= padding;
      maxPrice += padding;

      // MACD副图配置（纯SAR时不显示）
      const hasMacd = Array.isArray(this.properties.macdData) && this.properties.macdData.length > 0;
      const macdHeight = hasMacd ? 80 : 0; // 副图高度（减小到80px）
      const macdMargin = hasMacd ? 8 : 0; // 副图与主图间距

      const chartPadding = { top: 15, right: 10, bottom: 20, left: 10 };
      const chartWidth = width - chartPadding.left - chartPadding.right;
      // 主图高度 = 总高度 - MACD副图高度 - 间距 - 底部padding
      const chartHeight = height - chartPadding.top - chartPadding.bottom - macdHeight - macdMargin;

      console.log('📐 绘图区域:', {
        canvasWidth: width,
        canvasHeight: height,
        chartWidth: chartWidth,
        chartHeight: chartHeight,
        macdHeight: macdHeight,
        paddingRight: chartPadding.right
      });

      // 清空画布
      ctx.clearRect(0, 0, width, height);
      ctx.setFillStyle('#000000');
      ctx.fillRect(0, 0, width, height);

      // 绘制网格
      this.drawGrid(ctx, chartPadding, chartWidth, chartHeight);

      // 绘制K线
      const rightExtendCandles = this.getRightExtendCandles(validCandles.length);
      const slotCount = validCandles.length + rightExtendCandles;
      const candleWidth = chartWidth / slotCount;
      const candleGap = candleWidth * 0.08;
      const candleBodyWidth = Math.max(2, candleWidth - candleGap);

      for (let i = 0; i < validCandles.length; i++) {
        const candle = validCandles[i];
        const open = parseFloat(candle.open);
        const high = parseFloat(candle.high);
        const low = parseFloat(candle.low);
        const close = parseFloat(candle.close);

        const x = chartPadding.left + i * candleWidth + candleGap / 2;
        const wickX = x + candleBodyWidth / 2;

        const priceRangeForCalc = maxPrice - minPrice || 1;
        const highY = chartPadding.top + ((maxPrice - high) / priceRangeForCalc) * chartHeight;
        const lowY = chartPadding.top + ((maxPrice - low) / priceRangeForCalc) * chartHeight;
        const openY = chartPadding.top + ((maxPrice - open) / priceRangeForCalc) * chartHeight;
        const closeY = chartPadding.top + ((maxPrice - close) / priceRangeForCalc) * chartHeight;

        const isUp = close >= open;
        const color = isUp ? '#00C853' : '#FF1744';

        // 绘制影线
        ctx.setStrokeStyle(color);
        ctx.setLineWidth(1);
        ctx.beginPath();
        ctx.moveTo(wickX, highY);
        ctx.lineTo(wickX, lowY);
        ctx.stroke();

        // 绘制实体
        ctx.setFillStyle(color);
        const bodyTop = Math.min(openY, closeY);
        const bodyHeight = Math.max(1, Math.abs(closeY - openY));
        ctx.fillRect(x, bodyTop, candleBodyWidth, bodyHeight);
      }

      // 绘制价格标签
      this.drawPriceLabels(ctx, chartPadding, chartWidth, chartHeight, minPrice, maxPrice);

      // 获取指标开关状态
      const indicators = this.properties.enabledIndicators || {};

      // 绘制布林带BOLL（如果启用）
      if (indicators.boll) {
        this.drawBOLL(ctx, chartPadding, chartWidth, chartHeight, validCandles, minPrice, maxPrice, candleWidth);
      }

      // 绘制MA均线（如果启用）
      if (indicators.ma) {
        this.drawMA(ctx, chartPadding, chartWidth, chartHeight, validCandles, minPrice, maxPrice, candleWidth);
      }

      // 绘制EMA均线（如果启用）
      if (indicators.ema) {
        this.drawEMA(ctx, chartPadding, chartWidth, chartHeight, validCandles, minPrice, maxPrice, candleWidth);
      }

      // 绘制SAR指标（默认启用）
      if (indicators.sar !== false) {
        this.drawSAR(ctx, chartPadding, chartWidth, chartHeight, validCandles, minPrice, maxPrice, candleWidth);
      }

      // 绘制买卖点标记
      this.drawTradeSignals(ctx, chartPadding, chartWidth, chartHeight, validCandles, minPrice, maxPrice, candleWidth, candleGap);

      // 绘制MACD指标（副图）
      if (hasMacd) {
        this.drawMACD(ctx, width, validCandles, candleWidth, candleGap, chartHeight, macdHeight, macdMargin);
      }

      // 绘制十字线
      this.drawCrosshair(ctx, chartPadding, chartWidth, chartHeight);

      // 调用draw将Canvas内容绘制到屏幕
      ctx.draw();

      console.log('✅ K线图绘制完成');
    },

    // 绘制买卖信号标记
    drawTradeSignals: function (ctx, padding, chartWidth, chartHeight, candles, minPrice, maxPrice, candleWidth, candleGap) {
      const signals = this.properties.tradeSignals || [];
      if (!signals || signals.length === 0) return;

      const priceRangeForCalc = maxPrice - minPrice || 1;
      const triangleSize = Math.max(4, candleWidth * 0.35);

      for (let i = 0; i < signals.length; i++) {
        const signal = signals[i];
        if (!signal || signal.index === undefined) continue;
        const index = signal.index;
        if (index < 0 || index >= candles.length) continue;

        const candle = candles[index];
        const high = parseFloat(candle.high);
        const low = parseFloat(candle.low);

        const x = padding.left + index * candleWidth + candleGap / 2 + candleWidth / 2;
        const highY = padding.top + ((maxPrice - high) / priceRangeForCalc) * chartHeight;
        const lowY = padding.top + ((maxPrice - low) / priceRangeForCalc) * chartHeight;

        if (signal.type === 'buy') {
          const y = Math.min(padding.top + chartHeight - triangleSize - 2, lowY + triangleSize + 2);
          ctx.setFillStyle('#00C853');
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x - triangleSize / 2, y - triangleSize);
          ctx.lineTo(x + triangleSize / 2, y - triangleSize);
          ctx.closePath();
          ctx.fill();
        } else if (signal.type === 'sell') {
          const y = Math.max(padding.top + triangleSize + 2, highY - triangleSize - 2);
          ctx.setFillStyle('#FF1744');
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x - triangleSize / 2, y + triangleSize);
          ctx.lineTo(x + triangleSize / 2, y + triangleSize);
          ctx.closePath();
          ctx.fill();
        }
      }
    },

    drawGrid: function (ctx, padding, width, height) {
      ctx.setStrokeStyle('rgba(255, 255, 255, 0.1)');
      ctx.setLineWidth(0.5);

      // 水平线
      for (let i = 0; i <= 5; i++) {
        const y = padding.top + (height / 5) * i;
        ctx.beginPath();
        ctx.moveTo(padding.left, y);
        ctx.lineTo(padding.left + width, y);
        ctx.stroke();
      }

      // 垂直线
      for (let i = 0; i <= 6; i++) {
        const x = padding.left + (width / 6) * i;
        ctx.beginPath();
        ctx.moveTo(x, padding.top);
        ctx.lineTo(x, padding.top + height);
        ctx.stroke();
      }
    },

    drawPriceLabels: function (ctx, padding, width, height, minPrice, maxPrice) {
      ctx.setFillStyle('#8e8e93');
      ctx.setFontSize(10);
      ctx.setTextAlign('right');
      ctx.setTextBaseline('middle');

      const labelX = padding.left + width + padding.right - 6;
      for (let i = 0; i <= 5; i++) {
        const price = minPrice + (maxPrice - minPrice) * (1 - i / 5);
        const y = padding.top + (height / 5) * i;
        const priceText = this.formatPrice(price);
        ctx.fillText(priceText, labelX, y);
      }
    },

    formatPrice: function (price) {
      if (price < 0.01) {
        return price.toFixed(6);
      } else if (price < 1) {
        return price.toFixed(4);
      } else if (price < 100) {
        return price.toFixed(2);
      } else {
        return price.toFixed(1);
      }
    },

    // 格式化时间戳为可读时间
    formatTime: function (timestamp) {
      if (!timestamp) return '--';

      console.log('🔍 formatTime 输入:', timestamp, '类型:', typeof timestamp);

      // 处理不同格式的时间戳
      let date;
      let ts = timestamp;

      // 如果是字符串，转换为数字
      if (typeof timestamp === 'string') {
        ts = parseInt(timestamp, 10);
        if (isNaN(ts)) {
          console.warn('⚠️ 无法将字符串转换为数字:', timestamp);
          return '--';
        }
      }

      // 判断是秒还是毫秒（现在 ts 已经是数字了）
      if (ts < 10000000000) {
        // 10位时间戳（秒）
        date = new Date(ts * 1000);
      } else {
        // 13位时间戳（毫秒）
        date = new Date(ts);
      }

      console.log('📅 创建的Date对象:', date);

      // 更可靠的日期验证方式
      const time = date.getTime();
      // 检查是否是有效数字且在合理范围内（1970年到2100年）
      const isValid = !isNaN(time) && time > 0 && time < 4102444800000; // 2100年1月1日

      if (!isValid) {
        console.warn('⚠️ 无效的时间戳:', timestamp, 'getTime():', time);
        return '--';
      }

      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const day = date.getDate().toString().padStart(2, '0');
      const hours = date.getHours().toString().padStart(2, '0');
      const minutes = date.getMinutes().toString().padStart(2, '0');

      const result = `${month}-${day} ${hours}:${minutes}`;
      console.log('✅ 格式化结果:', result);

      return result;
    },

    // 绘制SAR指标（抛物线点）
    drawSAR: function (ctx, padding, chartWidth, chartHeight, candles, minPrice, maxPrice, candleWidth) {
      const sarData = this.properties.sarData;
      if (!sarData || sarData.length === 0) {
        return;
      }

      const priceRangeForCalc = maxPrice - minPrice || 1;

      for (let i = 0; i < Math.min(candles.length, sarData.length); i++) {
        const sar = sarData[i];
        if (!sar) continue;

        const x = padding.left + i * candleWidth + candleWidth / 2;
        const y = padding.top + ((maxPrice - sar.value) / priceRangeForCalc) * chartHeight;

        // SAR点的颜色：
        // - 反转点：白色
        // - 上升趋势：绿色（做多）
        // - 下降趋势：红色（做空）
        let color;
        if (sar.isReversal) {
          color = '#FFFFFF'; // 反转点白色
        } else if (sar.trend === 'up') {
          color = '#00C853'; // 上升趋势绿色
        } else {
          color = '#FF1744'; // 下降趋势红色
        }

        ctx.setFillStyle(color);
        ctx.beginPath();
        ctx.arc(x, y, 2, 0, 2 * Math.PI);
        ctx.fill();
      }

      console.log('✅ SAR指标绘制完成');
    },

    // 绘制MACD指标（副图）
    drawMACD: function (ctx, canvasWidth, candles, candleWidth, candleGap, mainChartHeight, macdHeight, macdMargin) {
      const macdData = this.properties.macdData;
      console.log('🔍 MACD数据检查:', {
        hasData: !!macdData,
        length: macdData ? macdData.length : 0,
        firstItem: macdData && macdData.length > 0 ? macdData[0] : null,
        lastItem: macdData && macdData.length > 0 ? macdData[macdData.length - 1] : null
      });

      if (!macdData || macdData.length === 0) {
        console.log('⚠️ MACD数据为空，跳过绘制');
        return;
      }

      // MACD副图区域（在主图下方）
      // macdTop = 主图高度 + 顶部padding + 间距
      const chartPadding = { top: 15, right: 10, bottom: 20, left: 10 };
      const macdTop = chartPadding.top + mainChartHeight + macdMargin;
      const macdPadding = { top: 10, right: 10, bottom: 20, left: 10 };
      const macdChartWidth = canvasWidth - macdPadding.left - macdPadding.right;
      const macdChartHeight = macdHeight - macdPadding.top - macdPadding.bottom;

      console.log('📐 MACD副图位置:', {
        macdTop: macdTop,
        macdHeight: macdHeight,
        mainChartHeight: mainChartHeight
      });

      // 绘制副图背景
      ctx.setFillStyle('#1c1c1e');
      ctx.fillRect(0, macdTop, canvasWidth, macdHeight);

      // 绘制主图和副图之间的分隔线
      const dividerY = macdTop - macdMargin / 2;
      ctx.setStrokeStyle('rgba(255, 255, 255, 0.2)');
      ctx.setLineWidth(1);
      ctx.beginPath();
      ctx.moveTo(0, dividerY);
      ctx.lineTo(canvasWidth, dividerY);
      ctx.stroke();

      // 绘制副图标题
      ctx.setFillStyle('#8e8e93');
      ctx.setFontSize(10);
      ctx.setTextAlign('left');
      ctx.fillText('MACD(12,26,9)', macdPadding.left, macdTop + 5);

      // 计算MACD数据范围
      let minValue = Infinity;
      let maxValue = -Infinity;

      for (let i = 0; i < macdData.length; i++) {
        const macd = macdData[i];
        minValue = Math.min(minValue, macd.histogram, macd.macd, macd.signal);
        maxValue = Math.max(maxValue, macd.histogram, macd.macd, macd.signal);
      }

      const valueRange = maxValue - minValue || 1;
      const zeroY = macdTop + macdPadding.top + (maxValue / valueRange) * macdChartHeight;

      // 绘制零线
      ctx.setStrokeStyle('rgba(255, 255, 255, 0.3)');
      ctx.setLineWidth(1);
      ctx.beginPath();
      ctx.moveTo(macdPadding.left, zeroY);
      ctx.lineTo(macdPadding.left + macdChartWidth, zeroY);
      ctx.stroke();

      // 绘制柱状图
      const barWidth = candleWidth * 0.6;
      const barScale = 1.7;

      for (let i = 0; i < Math.min(candles.length, macdData.length); i++) {
        const macd = macdData[i];
        if (!macd) continue;

        const x = macdPadding.left + i * candleWidth + candleGap / 2;
        const barHeight = Math.min(macdChartHeight, Math.abs(macd.histogram / valueRange) * macdChartHeight * barScale);

        // 柱状图颜色：正值为绿色，负值为红色
        ctx.setFillStyle(macd.histogram >= 0 ? 'rgba(0, 200, 83, 0.6)' : 'rgba(255, 23, 68, 0.6)');

        if (macd.histogram >= 0) {
          // 正值，从零线向上
          ctx.fillRect(x - barWidth / 2, zeroY - barHeight, barWidth, barHeight);
        } else {
          // 负值，从零线向下
          ctx.fillRect(x - barWidth / 2, zeroY, barWidth, barHeight);
        }
      }

      // 绘制MACD线和信号线
      this.drawMACDLine(ctx, macdData, macdPadding, macdTop, macdChartWidth, macdChartHeight, minValue, maxValue, 'macd', '#007aff', candleWidth, candleGap);
      this.drawMACDLine(ctx, macdData, macdPadding, macdTop, macdChartWidth, macdChartHeight, minValue, maxValue, 'signal', '#FF9500', candleWidth, candleGap);

      // 绘制金叉和死叉标记
      this.drawMACDCrosses(ctx, macdData, macdPadding, macdTop, macdChartWidth, macdChartHeight, minValue, maxValue, candleWidth, candleGap);

      console.log('✅ MACD指标绘制完成');
    },

    // 绘制MACD线条
    drawMACDLine: function (ctx, macdData, padding, top, width, height, minValue, maxValue, key, color, candleWidth, candleGap) {
      ctx.setStrokeStyle(color);
      ctx.setLineWidth(1);

      for (let i = 0; i < macdData.length; i++) {
        const macd = macdData[i];
        if (macd[key] === 0) continue;

        const x1 = padding.left + i * candleWidth + candleGap / 2;
        const y1 = top + padding.top + ((maxValue - macd[key]) / (maxValue - minValue)) * height;

        if (i < macdData.length - 1 && macdData[i + 1][key] !== 0) {
          const x2 = padding.left + (i + 1) * candleWidth + candleGap / 2;
          const y2 = top + padding.top + ((maxValue - macdData[i + 1][key]) / (maxValue - minValue)) * height;

          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.stroke();
        }
      }
    },

    // ✅ v0.0.154更新：绘制MACD金叉和死叉标记（只在交叉点显示）
    drawMACDCrosses: function (ctx, macdData, padding, top, width, height, minValue, maxValue, candleWidth, candleGap) {
      const valueRange = maxValue - minValue || 1;

      for (let i = 0; i < macdData.length; i++) {
        const macd = macdData[i];
        // ✅ 只在有crossType时才绘制标记
        if (!macd || !macd.crossType) continue;

        const x = padding.left + i * candleWidth + candleGap / 2;
        const y = top + padding.top + ((maxValue - macd.macd) / valueRange) * height;

        const radius = 4; // 圆圈半径

        // 金叉：绿色圆圈
        if (macd.crossType === 'golden') {
          ctx.setStrokeStyle('#00C853');
          ctx.setLineWidth(2);
          ctx.beginPath();
          ctx.arc(x, y, radius, 0, 2 * Math.PI);
          ctx.stroke();
        }
        // 死叉：红色圆圈
        else if (macd.crossType === 'death') {
          ctx.setStrokeStyle('#FF1744');
          ctx.setLineWidth(2);
          ctx.beginPath();
          ctx.arc(x, y, radius, 0, 2 * Math.PI);
          ctx.stroke();
        }
      }

      console.log('✅ MACD信号标记绘制完成（仅金叉/死叉）');
    },

    // 将页面坐标转换为 canvas 内坐标
    convertToCanvasCoordinates: function (pageX, pageY) {
      const rect = this.data.canvasRect;
      if (!rect) {
        // 如果还没获取到位置信息，使用原始坐标
        return { x: pageX, y: pageY };
      }
      return {
        x: pageX - rect.left,
        y: pageY - rect.top
      };
    },

    // 触摸开始
    handleTouchStart: function (e) {
      if (!e.touches || e.touches.length === 0) return;
      const touch = e.touches[0];

      // 优先使用 x/y（canvas 相对坐标），否则使用 clientX/clientY（页面坐标）并转换
      let x, y;
      if (touch.x !== undefined && touch.y !== undefined) {
        x = touch.x;
        y = touch.y;
      } else {
        const coords = this.convertToCanvasCoordinates(touch.clientX || 0, touch.clientY || 0);
        x = coords.x;
        y = coords.y;
      }

      console.log('👆 触摸开始:', { x, y, raw: { clientX: touch.clientX, clientY: touch.clientY, touchX: touch.x, touchY: touch.y } });
      this.updateCrosshair(x, y);
    },

    // 触摸移动
    handleTouchMove: function (e) {
      if (!e.touches || e.touches.length === 0) return;
      const touch = e.touches[0];

      let x, y;
      if (touch.x !== undefined && touch.y !== undefined) {
        x = touch.x;
        y = touch.y;
      } else {
        const coords = this.convertToCanvasCoordinates(touch.clientX || 0, touch.clientY || 0);
        x = coords.x;
        y = coords.y;
      }

      // 节流处理，避免过于频繁的重绘（增加到50ms，更流畅）
      const now = Date.now();
      if (now - this.data.lastDrawTime < this.data.drawThrottle) {
        return;
      }

      this.updateCrosshair(x, y);
      this.setData({ lastDrawTime: now });
    },

    // 触摸结束
    handleTouchEnd: function () {
      console.log('👆 触摸结束');
      this.setData({
        crosshair: {
          visible: false,
          x: 0,
          y: 0,
          candleIndex: -1,
          price: 0
        }
      });
      // 重新绘制（不显示十字线）
      this.drawChart();
    },

    // 更新十字线位置
    updateCrosshair: function (x, y) {
      const candles = this.properties.candles;
      if (!candles || candles.length === 0) return;

      const width = this.data.canvasWidth;
      const chartPadding = { top: 15, right: 10, bottom: 20, left: 10 };
      const hasMacd = Array.isArray(this.properties.macdData) && this.properties.macdData.length > 0;
      const macdHeight = hasMacd ? 80 : 0;
      const macdMargin = hasMacd ? 8 : 0;
      const chartWidth = width - chartPadding.left - chartPadding.right;
      const chartHeight = this.data.canvasHeight - chartPadding.top - chartPadding.bottom - macdHeight - macdMargin;

      // 限制在主图区域内
      if (x < chartPadding.left || x > chartPadding.left + chartWidth) return;
      if (y < chartPadding.top || y > chartPadding.top + chartHeight) return;

      // 计算对应的K线索引
      const rightExtendCandles = this.getRightExtendCandles(candles.length);
      const candleWidth = chartWidth / (candles.length + rightExtendCandles);
      const index = Math.floor((x - chartPadding.left) / candleWidth);

      if (index >= 0 && index < candles.length) {
        // 计算价格范围（优化：只计算一次）
        if (!this.data.priceRangeCache) {
          let minPrice = Infinity;
          let maxPrice = -Infinity;
          for (let i = 0; i < candles.length; i++) {
            const candle = candles[i];
            minPrice = Math.min(minPrice, parseFloat(candle.low));
            maxPrice = Math.max(maxPrice, parseFloat(candle.high));
          }

          const priceRange = maxPrice - minPrice || 1;
          const padding = priceRange * 0.1;
          minPrice -= padding;
          maxPrice += padding;

          this.setData({
            priceRangeCache: { minPrice, maxPrice, priceRangeForCalc: maxPrice - minPrice || 1 }
          });
        }

        const { maxPrice, priceRangeForCalc } = this.data.priceRangeCache;

        // 计算对应的价格
        const price = maxPrice - ((y - chartPadding.top) / chartHeight) * priceRangeForCalc;

        // 检查是否真的需要重绘（位置变化超过一定阈值才重绘）
        const prevCrosshair = this.data.crosshair;
        const needsRedraw = !prevCrosshair.visible ||
                           Math.abs(x - prevCrosshair.x) > candleWidth / 2 ||
                           Math.abs(y - prevCrosshair.y) > 5;

        this.setData({
          crosshair: {
            visible: true,
            x: x,
            y: y,
            candleIndex: index,
            price: price
          }
        });

        // 只有位置变化较大时才重绘
        if (needsRedraw) {
          this.drawChart();
        }
      }
    },

    // 绘制十字线
    drawCrosshair: function (ctx, chartPadding, chartWidth, chartHeight) {
      const crosshair = this.data.crosshair;
      if (!crosshair.visible) return;

      const x = crosshair.x;
      const y = crosshair.y;

      // 绘制十字线
      ctx.setStrokeStyle('rgba(255, 255, 255, 0.5)');
      ctx.setLineWidth(1);

      // 横线
      ctx.beginPath();
      ctx.moveTo(chartPadding.left, y);
      ctx.lineTo(chartPadding.left + chartWidth, y);
      ctx.stroke();

      // 竖线
      ctx.beginPath();
      ctx.moveTo(x, chartPadding.top);
      ctx.lineTo(x, chartPadding.top + chartHeight);
      ctx.stroke();

      // 绘制价格标签（右侧）
      const priceText = this.formatPrice(crosshair.price);
      ctx.setFillStyle('#007aff');
      ctx.setFontSize(10);
      ctx.setTextAlign('left');
      ctx.setTextBaseline('middle');

      // 标签背景
      const labelWidth = 55;
      const labelHeight = 16;
      const labelX = chartPadding.left + chartWidth + 3;
      const labelY = y - labelHeight / 2;

      ctx.setFillStyle('rgba(0, 122, 255, 0.8)');
      ctx.fillRect(labelX, labelY, labelWidth, labelHeight);

      // 标签文字
      ctx.setFillStyle('#ffffff');
      ctx.fillText(priceText, labelX + 3, y);

      // 绘制K线信息标签（左上角）
      const candles = this.properties.candles;
      if (crosshair.candleIndex >= 0 && crosshair.candleIndex < candles.length) {
        const candle = candles[crosshair.candleIndex];

        // 调试日志
        console.log('🕐 K线时间戳:', candle.timestamp, '类型:', typeof candle.timestamp);

        const timeText = this.formatTime(candle.timestamp);
        console.log('📅 格式化后的时间:', timeText);

        const infoText = `${timeText}  O:${this.formatPrice(candle.open)} H:${this.formatPrice(candle.high)} L:${this.formatPrice(candle.low)} C:${this.formatPrice(candle.close)}`;

        ctx.setFontSize(10);
        const textWidth = infoText.length * 6 + 10;

        // 信息背景（增加到两行高度）
        ctx.setFillStyle('rgba(0, 0, 0, 0.7)');
        ctx.fillRect(chartPadding.left, chartPadding.top, textWidth, 26);

        // 信息文字
        ctx.setFillStyle('#ffffff');
        ctx.setTextAlign('left');
        // 第一行：时间
        ctx.fillText(timeText, chartPadding.left + 3, chartPadding.top + 8);
        // 第二行：OHLC
        const priceText = `O:${this.formatPrice(candle.open)} H:${this.formatPrice(candle.high)} L:${this.formatPrice(candle.low)} C:${this.formatPrice(candle.close)}`;
        ctx.fillText(priceText, chartPadding.left + 3, chartPadding.top + 20);
      }
    },

    // 绘制布林带BOLL
    drawBOLL: function (ctx, padding, chartWidth, chartHeight, candles, minPrice, maxPrice, candleWidth) {
      const bollData = this.properties.bollData;
      if (!bollData || bollData.length === 0) return;

      const priceRangeForCalc = maxPrice - minPrice || 1;

      // 绘制上轨
      ctx.setStrokeStyle('rgba(255, 149, 0, 0.6)');
      ctx.setLineWidth(1);
      for (let i = 1; i < Math.min(candles.length, bollData.length); i++) {
        const boll = bollData[i];
        if (!boll || !boll.upper) continue;

        const x1 = padding.left + (i - 1) * candleWidth + candleWidth / 2;
        const y1 = padding.top + ((maxPrice - bollData[i - 1].upper) / priceRangeForCalc) * chartHeight;
        const x2 = padding.left + i * candleWidth + candleWidth / 2;
        const y2 = padding.top + ((maxPrice - boll.upper) / priceRangeForCalc) * chartHeight;

        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }

      // 绘制中轨
      ctx.setStrokeStyle('rgba(255, 255, 255, 0.4)');
      for (let i = 1; i < Math.min(candles.length, bollData.length); i++) {
        const boll = bollData[i];
        if (!boll || !boll.middle) continue;

        const x1 = padding.left + (i - 1) * candleWidth + candleWidth / 2;
        const y1 = padding.top + ((maxPrice - bollData[i - 1].middle) / priceRangeForCalc) * chartHeight;
        const x2 = padding.left + i * candleWidth + candleWidth / 2;
        const y2 = padding.top + ((maxPrice - boll.middle) / priceRangeForCalc) * chartHeight;

        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }

      // 绘制下轨
      ctx.setStrokeStyle('rgba(255, 149, 0, 0.6)');
      for (let i = 1; i < Math.min(candles.length, bollData.length); i++) {
        const boll = bollData[i];
        if (!boll || !boll.lower) continue;

        const x1 = padding.left + (i - 1) * candleWidth + candleWidth / 2;
        const y1 = padding.top + ((maxPrice - bollData[i - 1].lower) / priceRangeForCalc) * chartHeight;
        const x2 = padding.left + i * candleWidth + candleWidth / 2;
        const y2 = padding.top + ((maxPrice - boll.lower) / priceRangeForCalc) * chartHeight;

        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }

      console.log('✅ 布林带BOLL绘制完成');
    },

    // 绘制MA均线
    drawMA: function (ctx, padding, chartWidth, chartHeight, candles, minPrice, maxPrice, candleWidth) {
      const maData = this.properties.maData;
      if (!maData) return;

      const priceRangeForCalc = maxPrice - minPrice || 1;
      const maColors = {
        ma5: '#FF6B6B',
        ma10: '#4ECDC4',
        ma20: '#FFE66D',
        ma30: '#C7F464'
      };

      for (const maType in maData) {
        const maArray = maData[maType];
        if (!maArray || maArray.length === 0) continue;

        ctx.setStrokeStyle(maColors[maType] || '#ffffff');
        ctx.setLineWidth(1);

        for (let i = 1; i < Math.min(candles.length, maArray.length); i++) {
          const ma = maArray[i];
          const prevMa = maArray[i - 1];
          if (ma == null || prevMa == null) continue;

          const x1 = padding.left + (i - 1) * candleWidth + candleWidth / 2;
          const y1 = padding.top + ((maxPrice - prevMa) / priceRangeForCalc) * chartHeight;
          const x2 = padding.left + i * candleWidth + candleWidth / 2;
          const y2 = padding.top + ((maxPrice - ma) / priceRangeForCalc) * chartHeight;

          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.stroke();
        }
      }

      console.log('✅ MA均线绘制完成');
    },

    // 绘制EMA均线
    drawEMA: function (ctx, padding, chartWidth, chartHeight, candles, minPrice, maxPrice, candleWidth) {
      const emaData = this.properties.emaData;
      if (!emaData) return;

      const priceRangeForCalc = maxPrice - minPrice || 1;
      const emaColors = {
        ema12: '#64D2FF',
        ema26: '#BF5AF2'
      };

      for (const emaType in emaData) {
        const emaArray = emaData[emaType];
        if (!emaArray || emaArray.length === 0) continue;

        ctx.setStrokeStyle(emaColors[emaType] || '#ffffff');
        ctx.setLineWidth(1);

        for (let i = 1; i < Math.min(candles.length, emaArray.length); i++) {
          const ema = emaArray[i];
          const prevEma = emaArray[i - 1];
          if (ema == null || prevEma == null) continue;

          const x1 = padding.left + (i - 1) * candleWidth + candleWidth / 2;
          const y1 = padding.top + ((maxPrice - prevEma) / priceRangeForCalc) * chartHeight;
          const x2 = padding.left + i * candleWidth + candleWidth / 2;
          const y2 = padding.top + ((maxPrice - ema) / priceRangeForCalc) * chartHeight;

          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.stroke();
        }
      }

      console.log('✅ EMA均线绘制完成');
    }
  }
});
