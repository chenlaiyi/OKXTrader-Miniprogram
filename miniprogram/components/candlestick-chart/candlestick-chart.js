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
    currentPrice: {
      type: String,
      value: '--'
    },
    height: {
      type: Number,
      value: 500
    }
  },

  data: {
    canvasWidth: 0,
    canvasHeight: 0,
    ctx: null,
    // 十字线相关
    crosshair: {
      visible: false,
      x: 0,
      y: 0,
      candleIndex: -1,
      price: 0
    }
  },

  lifetimes: {
    attached() {
      const systemInfo = wx.getSystemInfoSync();
      const screenWidth = systemInfo.windowWidth;

      // 直接使用屏幕宽度，不扣除padding（因为父容器已经处理了padding）
      const canvasWidth = screenWidth;
      const canvasHeight = this.properties.height * (screenWidth / 750);

      this.setData({
        canvasWidth: canvasWidth,
        canvasHeight: canvasHeight
      });

      console.log('📐 Canvas尺寸:', { width: canvasWidth, height: canvasHeight, screenWidth: screenWidth });

      // 使用旧版Canvas API
      this.initCanvas();
    }
  },

  observers: {
    'candles, sarData, macdData': function(candles, sarData, macdData) {
      if (candles && candles.length > 0) {
        console.log('📈 开始绘制K线图，数据量:', candles.length);
        this.drawChart();
      }
    }
  },

  methods: {
    initCanvas: function() {
      try {
        const ctx = wx.createCanvasContext('candlestickCanvas', this);
        this.setData({ ctx: ctx });
        console.log('✅ Canvas初始化完成');
      } catch(e) {
        console.error('❌ Canvas初始化失败:', e);
      }
    },

    drawChart: function() {
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

      // MACD副图配置
      const macdHeight = 80; // 副图高度（减小到80px）
      const macdMargin = 8; // 副图与主图间距

      const chartPadding = { top: 15, right: 60, bottom: 20, left: 10 };
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
      const candleWidth = chartWidth / validCandles.length;
      const candleGap = candleWidth * 0.2;
      const candleBodyWidth = Math.max(1, candleWidth - candleGap);

      for (let i = 0; i < validCandles.length; i++) {
        const candle = validCandles[i];
        const open = parseFloat(candle.open);
        const high = parseFloat(candle.high);
        const low = parseFloat(candle.low);
        const close = parseFloat(candle.close);

        const x = chartPadding.left + i * candleWidth + candleGap / 2;

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
        ctx.moveTo(x, highY);
        ctx.lineTo(x, lowY);
        ctx.stroke();

        // 绘制实体
        ctx.setFillStyle(color);
        const bodyTop = Math.min(openY, closeY);
        const bodyHeight = Math.max(1, Math.abs(closeY - openY));
        ctx.fillRect(x, bodyTop, candleBodyWidth, bodyHeight);
      }

      // 绘制价格标签
      this.drawPriceLabels(ctx, chartPadding, chartWidth, chartHeight, minPrice, maxPrice);

      // 绘制SAR指标
      this.drawSAR(ctx, chartPadding, chartWidth, chartHeight, validCandles, minPrice, maxPrice, candleWidth, candleGap);

      // 绘制MACD指标（副图）
      this.drawMACD(ctx, width, height, validCandles, candleWidth, candleGap, chartHeight, macdHeight, macdMargin);

      // 绘制十字线
      this.drawCrosshair(ctx, chartPadding, chartWidth, chartHeight, minPrice, maxPrice);

      // 调用draw将Canvas内容绘制到屏幕
      ctx.draw();

      console.log('✅ K线图绘制完成');
    },

    drawGrid: function(ctx, padding, width, height, minPrice, maxPrice) {
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

    drawPriceLabels: function(ctx, padding, width, height, minPrice, maxPrice) {
      ctx.setFillStyle('#8e8e93');
      ctx.setFontSize(10);
      ctx.setTextAlign('left');
      ctx.setTextBaseline('middle');

      for (let i = 0; i <= 5; i++) {
        const price = minPrice + (maxPrice - minPrice) * (1 - i / 5);
        const y = padding.top + (height / 5) * i;
        const priceText = this.formatPrice(price);
        ctx.fillText(priceText, padding.left + width + 3, y);
      }
    },

    formatPrice: function(price) {
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

    // 绘制SAR指标（抛物线点）
    drawSAR: function(ctx, padding, chartWidth, chartHeight, candles, minPrice, maxPrice, candleWidth, candleGap) {
      const sarData = this.properties.sarData;
      if (!sarData || sarData.length === 0) {
        return;
      }

      const priceRangeForCalc = maxPrice - minPrice || 1;

      for (let i = 0; i < Math.min(candles.length, sarData.length); i++) {
        const sar = sarData[i];
        if (!sar) continue;

        const x = padding.left + i * candleWidth + candleGap / 2 + candleWidth / 2;
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
    drawMACD: function(ctx, canvasWidth, canvasHeight, candles, candleWidth, candleGap, mainChartHeight, macdHeight, macdMargin) {
      const macdData = this.properties.macdData;
      if (!macdData || macdData.length === 0) {
        return;
      }

      // MACD副图区域（在主图下方）
      // macdTop = 主图高度 + 顶部padding + 间距
      const chartPadding = { top: 15, right: 60, bottom: 20, left: 10 };
      const macdTop = chartPadding.top + mainChartHeight + macdMargin;
      const macdPadding = { top: 10, right: 60, bottom: 20, left: 10 };
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

      for (let i = 0; i < Math.min(candles.length, macdData.length); i++) {
        const macd = macdData[i];
        if (!macd) continue;

        const x = macdPadding.left + i * candleWidth + candleGap / 2;
        const barHeight = Math.abs(macd.histogram / valueRange) * macdChartHeight;

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

      // 绘制主图和副图之间的分隔线
      const dividerY = macdTop - macdMargin / 2;
      ctx.setStrokeStyle('rgba(255, 255, 255, 0.2)');
      ctx.setLineWidth(1);
      ctx.beginPath();
      ctx.moveTo(0, dividerY);
      ctx.lineTo(canvasWidth, dividerY);
      ctx.stroke();

      console.log('✅ MACD指标绘制完成');
    },

    // 绘制MACD线条
    drawMACDLine: function(ctx, macdData, padding, top, width, height, minValue, maxValue, key, color, candleWidth, candleGap) {
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

    // 绘制MACD金叉和死叉标记
    drawMACDCrosses: function(ctx, macdData, padding, top, width, height, minValue, maxValue, candleWidth, candleGap) {
      const valueRange = maxValue - minValue || 1;

      for (let i = 0; i < macdData.length; i++) {
        const macd = macdData[i];
        if (!macd || !macd.crossType) continue;

        const x = padding.left + i * candleWidth + candleGap / 2;
        const y = top + padding.top + ((maxValue - macd.macd) / valueRange) * height;

        const radius = 4; // 圆圈半径

        if (macd.crossType === 'golden') {
          // 金叉：绿色圆圈
          ctx.setStrokeStyle('#00C853');
          ctx.setLineWidth(1.5);
          ctx.beginPath();
          ctx.arc(x, y, radius, 0, 2 * Math.PI);
          ctx.stroke();
        } else if (macd.crossType === 'death') {
          // 死叉：红色圆圈
          ctx.setStrokeStyle('#FF1744');
          ctx.setLineWidth(1.5);
          ctx.beginPath();
          ctx.arc(x, y, radius, 0, 2 * Math.PI);
          ctx.stroke();
        }
      }

      console.log('✅ 金叉死叉标记绘制完成');
    },

    // 触摸开始
    handleTouchStart: function(e) {
      const touch = e.touches[0];
      this.updateCrosshair(touch.x, touch.y);
    },

    // 触摸移动
    handleTouchMove: function(e) {
      const touch = e.touches[0];
      this.updateCrosshair(touch.x, touch.y);
    },

    // 触摸结束
    handleTouchEnd: function(e) {
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
    updateCrosshair: function(x, y) {
      const candles = this.properties.candles;
      if (!candles || candles.length === 0) return;

      const width = this.data.canvasWidth;
      const chartPadding = { top: 15, right: 60, bottom: 20, left: 10 };
      const macdHeight = 80;
      const macdMargin = 8;
      const chartWidth = width - chartPadding.left - chartPadding.right;
      const chartHeight = this.data.canvasHeight - chartPadding.top - chartPadding.bottom - macdHeight - macdMargin;

      // 限制在主图区域内
      if (x < chartPadding.left || x > chartPadding.left + chartWidth) return;
      if (y < chartPadding.top || y > chartPadding.top + chartHeight) return;

      // 计算对应的K线索引
      const candleWidth = chartWidth / candles.length;
      const candleGap = candleWidth * 0.2;
      const index = Math.floor((x - chartPadding.left) / candleWidth);

      if (index >= 0 && index < candles.length) {
        // 计算价格范围
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

        // 计算对应的价格
        const priceRangeForCalc = maxPrice - minPrice || 1;
        const price = maxPrice - ((y - chartPadding.top) / chartHeight) * priceRangeForCalc;

        this.setData({
          crosshair: {
            visible: true,
            x: x,
            y: y,
            candleIndex: index,
            price: price
          }
        });

        // 重新绘制（显示十字线）
        this.drawChart();
      }
    },

    // 绘制十字线
    drawCrosshair: function(ctx, chartPadding, chartWidth, chartHeight, minPrice, maxPrice) {
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
        const infoText = `O:${this.formatPrice(candle.open)} H:${this.formatPrice(candle.high)} L:${this.formatPrice(candle.low)} C:${this.formatPrice(candle.close)}`;

        ctx.setFontSize(10);
        const textWidth = infoText.length * 6 + 10;

        // 信息背景
        ctx.setFillStyle('rgba(0, 0, 0, 0.7)');
        ctx.fillRect(chartPadding.left, chartPadding.top, textWidth, 16);

        // 信息文字
        ctx.setFillStyle('#ffffff');
        ctx.setTextAlign('left');
        ctx.fillText(infoText, chartPadding.left + 3, chartPadding.top + 8);
      }
    }
  }
});
