// pages/ai/ai.js
const API = require('../../services/api.js');
const { autoTradingEngine } = require('../../services/auto-trading');

// 默认用户ID
const FALLBACK_USER_ID = 'default';

function getCurrentUserId() {
  const userInfo = wx.getStorageSync('userInfo');
  return (userInfo && userInfo.id) ? userInfo.id : FALLBACK_USER_ID;
}

Page({
  data: {
    // 策略状态
    currentStrategy: {
      emoji: '📈',
      name: 'SAR策略'
    },
    tradingStyle: 'conservative',

    // 当前交易对
    currentSymbol: 'ETH-USDT-SWAP',

    // 交易模式
    tradingMode: 'ai',
    isPureMode: false,

    // 核心参数
    takeProfitPercent: 5,
    stopLossPercent: 3,
    leverage: 10,
    confidenceThreshold: 70,
    analysisInterval: 5,
    positionSize: 0.4,

    // 自动交易状态
    autoTradeEnabled: false,
    autoAnalysisEnabled: false,
    isAnalyzing: false,
    lastManualAnalysisAt: 0,
    autoTradingStats: {
      totalTrades: 0,
      winTrades: 0,
      lossTrades: 0,
      winRate: 0
    },

    // 当前分析结果
    currentAnalysis: null,
    analysisTime: '',
    serverTimeOffset: 0,
    strategyConfigMissingNotified: false,
    strategyEnableMissingNotified: false,

    // 持仓数据
    apiPositions: [],

    // 分析历史
    historyList: [],
    buyCount: 0,
    sellCount: 0,
    holdCount: 0,

    // 分页信息
    pagination: null,

    // 加载状态
    loading: true
  },

  // 定时器
  autoAnalysisTimer: null,
  positionRefreshTimer: null, // 持仓刷新定时器

  onLoad(options) {
    this.initData();
  },

  onShow() {
    // 页面显示时刷新数据
    if (!this.data.loading) {
      this.refreshData();
    }

    // 启动整页自动刷新（每10秒刷新所有数据）
    if (!this.positionRefreshTimer) {
      console.log('🔄 启动AI分析页面自动刷新（10秒间隔）');
      this.positionRefreshTimer = setInterval(() => {
        console.log('📍 自动刷新页面数据...');
        this.refreshData();
      }, 10000);
    }
  },

  onUnload() {
    // 清除定时器
    if (this.autoAnalysisTimer) {
      clearInterval(this.autoAnalysisTimer);
      this.autoAnalysisTimer = null;
    }
    if (this.positionRefreshTimer) {
      clearInterval(this.positionRefreshTimer);
      this.positionRefreshTimer = null;
    }
  },

  onHide() {
    // 页面隐藏时清除定时器，节省资源
    if (this.autoAnalysisTimer) {
      clearInterval(this.autoAnalysisTimer);
      this.autoAnalysisTimer = null;
    }
    if (this.positionRefreshTimer) {
      clearInterval(this.positionRefreshTimer);
      this.positionRefreshTimer = null;
      console.log('⏹️ 页面隐藏，停止所有轮询');
    }
  },

  onPullDownRefresh() {
    this.refreshData().finally(() => {
      wx.stopPullDownRefresh();
    });
  },

  /**
   * 初始化数据
   */
  async initData() {
    this.setData({ loading: true });

    try {
      await Promise.all([
        this.loadAutoTradingConfig(),
        this.loadAutoTradingStatus(),
        this.loadLatestAnalysis(),
        this.loadPositions(),
        this.loadAnalysisHistory()
      ]);
    } catch (error) {
      console.error('初始化数据失败:', error);
    } finally {
      this.setData({ loading: false });
    }
  },

  /**
   * 刷新所有数据
   */
  async refreshData() {
    try {
      await Promise.all([
        this.loadAutoTradingConfig(),  // 重新加载配置以反映策略页面的修改
        this.loadAutoTradingStatus(),
        this.loadLatestAnalysis(),
        this.loadPositions(),
        this.loadAnalysisHistory()
      ]);
    } catch (error) {
      console.error('刷新数据失败:', error);
    }
  },

  /**
   * 加载自动交易配置
   */
  async loadAutoTradingConfig() {
    try {
      // ✅ 使用策略列表作为唯一来源，加载默认策略
      const listRes = await API.getStrategyList(getCurrentUserId());
      if (listRes.success && Array.isArray(listRes.data)) {
        const strategies = listRes.data || [];
        const enabledStrategies = strategies.filter(item => item.is_enabled);

        if (enabledStrategies.length === 0) {
          this.promptEnableStrategy();
          return;
        } else if (this.data.strategyEnableMissingNotified) {
          this.setData({ strategyEnableMissingNotified: false });
        }

        const activeStrategy = enabledStrategies.find(s => s.is_default) || enabledStrategies[0];
        const detailRes = await API.getStrategyDetail(activeStrategy.id);

        if (detailRes.success && detailRes.data) {
          const strategy = detailRes.data;

          const strategyName = (strategy.name || '').toLowerCase();
          const strategyEmojis = {
            sar: '📈',
            ai: '🤖'
          };
          const emojiKey = strategyName.includes('sar') ? 'sar' : 'sar';

          const tradingMode = strategy.trading_mode || 'ai';
          this.setData({
            currentStrategy: {
              emoji: strategyEmojis[emojiKey] || '📈',
              name: strategy.name || 'SAR策略'
            },
            tradingStyle: 'conservative',
            currentSymbol: strategy.symbol || this.data.currentSymbol,
            analysisInterval: 1,
            tradingMode: tradingMode,
            isPureMode: tradingMode === 'pure'
          });

          // 更新平仓参数（止盈止损）
          if (strategy.sell_strategy) {
            this.setData({
              stopLossPercent: strategy.sell_strategy.stopLossPercent || 2,
              takeProfitPercent: strategy.sell_strategy.takeProfitPercent || 5
            });
          }

          // 更新资金参数
          if (strategy.fund_config) {
            this.setData({
              leverage: strategy.fund_config.leverage || 5
            });
          }

          // 将策略配置设置到自动交易引擎（启用本地验证）
          if (strategy.buy_strategy && strategy.buy_strategy.conditions) {
            const strategyConfigForEngine = {
              id: strategy.id,
              name: strategy.name || '策略',
              description: strategy.description || '',
              direction_timeframe: strategy.direction_timeframe || '1D',
              entry_timeframe: strategy.entry_timeframe || '15m',
              fund_config: {
                mode: (strategy.fund_config && strategy.fund_config.mode) || 'accountBalance',
                fixedAmount: (strategy.fund_config && strategy.fund_config.fixedAmount) || 100,
                percentage: (strategy.fund_config && strategy.fund_config.percentage) || 40,
                leverage: (strategy.fund_config && strategy.fund_config.leverage) || 5,
                marginMode: (strategy.fund_config && strategy.fund_config.marginMode) || 'cross'
              },
              buy_strategy: {
                conditions: strategy.buy_strategy.conditions,
                logicType: strategy.buy_strategy.logicType || 'and'
              },
              sell_strategy: {
                takeProfitPercent: (strategy.sell_strategy && strategy.sell_strategy.takeProfitPercent) || 5,
                stopLossPercent: (strategy.sell_strategy && strategy.sell_strategy.stopLossPercent) || 2
              },
              risk_control: {
                cooldownSeconds: (strategy.risk_control && strategy.risk_control.cooldownSeconds) || 60,
                maxPositions: (strategy.risk_control && strategy.risk_control.maxPositions) || 3
              },
              is_enabled: true,
              is_default: true
            };

            autoTradingEngine.setStrategyConfig(strategyConfigForEngine, getCurrentUserId());
            console.log('✅ 策略配置已设置到自动交易引擎:', strategyConfigForEngine.name);
            console.log('   开仓条件数量:', strategyConfigForEngine.buy_strategy.conditions.length);
            console.log('   逻辑类型:', strategyConfigForEngine.buy_strategy.logicType);
          }
        }
      }
    } catch (error) {
      console.error('加载配置失败:', error);
    }
  },

  /**
   * 未启用策略提醒
   */
  promptEnableStrategy() {
    if (this.data.strategyEnableMissingNotified) {
      return;
    }
    this.setData({ strategyEnableMissingNotified: true });
    wx.showModal({
      title: '未启用策略',
      content: '当前没有启用策略，请新建或启用策略后再使用。',
      confirmText: '去处理',
      cancelText: '稍后',
      success: (res) => {
        if (res.confirm) {
          this.goToStrategyList();
        }
      }
    });
  },

  /**
   * 加载自动交易状态
   */
  async loadAutoTradingStatus() {
    try {
      const res = await API.getAutoTradingStatus(getCurrentUserId());
      if (res.success && res.data) {
        this.setData({
          autoTradeEnabled: res.data.enabled,
          autoAnalysisEnabled: res.data.autoAnalysisEnabled || false,
          analysisInterval: res.data.analysisInterval || 5,
          autoTradingStats: {
            totalTrades: res.data.totalTrades || 0,
            winTrades: res.data.winTrades || 0,
            lossTrades: res.data.lossTrades || 0,
            winRate: res.data.winRate || 0
          }
        });

        // ❌ 移除前端定时器 - 后端已有自动分析引擎
        // 后端每30秒自动分析并保存到数据库
        // 小程序只需要轮询获取最新分析结果即可

        // 如果自动交易已启用，启动轮询获取最新分析（降低频率到30秒）
        if (res.data.enabled && !this.autoAnalysisTimer && !this.data.isPureMode) {
          console.log('✅ 后端自动交易已启动，小程序开始30秒轮询获取最新分析');
          this.autoAnalysisTimer = setInterval(() => {
            this.loadLatestAnalysis(); // 只加载，不触发新的分析
          }, 30000); // 30秒轮询一次
        }
      }
    } catch (error) {
      console.error('加载自动交易状态失败:', error);
    }
  },

  /**
   * 加载最新AI分析
   */
  async loadLatestAnalysis() {
    if (this.data.isPureMode) {
      return;
    }
    try {
      const res = await API.getLatestAnalysis(this.data.currentSymbol, 1, false, getCurrentUserId());
      if (!res.success) {
        const hint = (res.data && res.data.strategyConfigHint) || res.error || 'AI分析暂不可用';
        if (!this.data.strategyConfigMissingNotified && hint) {
          this.setData({ strategyConfigMissingNotified: true });
          wx.showModal({
            title: 'AI分析未开启',
            content: hint,
            confirmText: '去配置',
            cancelText: '知道了',
            success: (modalRes) => {
              if (modalRes.confirm) {
                this.goToStrategyList();
              }
            }
          });
        }
        this.setData({
          currentAnalysis: null,
          analysisTime: ''
        });
        return;
      }
      if (res.data && res.data.analysisDisabled) {
        const hint = res.data.strategyConfigHint || 'AI分析暂不可用';
        if (!this.data.strategyConfigMissingNotified) {
          this.setData({ strategyConfigMissingNotified: true });
          wx.showModal({
            title: 'AI分析未开启',
            content: hint,
            confirmText: '去配置',
            cancelText: '知道了',
            success: (modalRes) => {
              if (modalRes.confirm) {
                this.goToStrategyList();
              }
            }
          });
        }
        this.setData({
          currentAnalysis: null,
          analysisTime: ''
        });
        return;
      }
      if (res.data) {
        const analysis = res.data;
        if (analysis.strategyConfigMissing && !this.data.strategyConfigMissingNotified) {
          this.setData({ strategyConfigMissingNotified: true });
          wx.showModal({
            title: '需要配置策略',
            content: analysis.strategyConfigHint || '未检测到策略配置，请先添加并保存策略。',
            confirmText: '去配置',
            cancelText: '知道了',
            success: (modalRes) => {
              if (modalRes.confirm) {
                this.goToStrategyList();
              }
            }
          });
        }
        const offset = this.resolveServerTimeOffset(analysis.timestamp);
        this.setData({
          currentAnalysis: this.formatAnalysis(analysis),
          analysisTime: this.formatTime(analysis.timestamp, offset)
        });
      }
    } catch (error) {
      console.error('加载最新分析失败:', error);
    }
  },

  /**
   * 加载持仓
   */
  async loadPositions() {
    try {
      const res = await API.getPositions({ userId: getCurrentUserId() });
      if (res.success && res.data) {
        const positions = res.data.map(pos => {
          // 格式化入场时间
          let entryTimeText = '';
          if (pos.entryTime) {
            const date = new Date(pos.entryTime);
            const now = new Date();
            const diffMs = now - date;
            const diffMins = Math.floor(diffMs / 60000);
            const diffHours = Math.floor(diffMs / 3600000);

            if (diffMins < 1) {
              entryTimeText = '刚刚';
            } else if (diffMins < 60) {
              entryTimeText = `${diffMins}分钟前`;
            } else if (diffHours < 24) {
              entryTimeText = `${diffHours}小时前`;
            } else {
              entryTimeText = date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
            }
          }

          return {
            instId: pos.symbol,
            side: pos.side,
            leverage: pos.leverage + 'x',
            quantity: pos.size,
            avgPrice: pos.entryPrice ? pos.entryPrice.toFixed(2) : '--',
            pnl: pos.unrealizedPnl ? pos.unrealizedPnl.toFixed(2) : '0.00',
            pnlPercent: pos.unrealizedPnl ? ((pos.unrealizedPnl / (pos.size * pos.entryPrice)) * 100).toFixed(2) + '%' : '0%',
            entryTime: entryTimeText
          };
        });
        this.setData({ apiPositions: positions });
      }
    } catch (error) {
      console.error('加载持仓失败:', error);
      this.setData({ apiPositions: [] });
    }
  },

  /**
   * 加载分析历史（分页）
   */
  async loadAnalysisHistory(page = 1, pageSize = 10) {
    try {
      console.log(`📄 加载分析历史... 页码: ${page}, 每页: ${pageSize}条`);

      // 计算需要获取的数据量
      // 简单分页：获取所有数据，前端切片
      const limit = 100; // 最大获取100条
      const res = await API.getAnalysisHistory(
        this.data.currentSymbol,
        limit,
        getCurrentUserId()
      );

      if (res.success && res.data) {
        // 兼容两种数据格式
        const dataList = Array.isArray(res.data) ? res.data : (res.data.data || []);

        console.log(`📊 后端返回 ${dataList.length} 条数据`);

        // ✅ 确保数据按时间戳降序排列（最新的在前）
        dataList.sort((a, b) => {
          const timeA = new Date(a.timestamp).getTime();
          const timeB = new Date(b.timestamp).getTime();
          return timeB - timeA; // 降序：新的在前
        });

        // 前端分页：计算切片
        const startIndex = (page - 1) * pageSize;
        const endIndex = startIndex + pageSize;
        const pageData = dataList.slice(startIndex, endIndex);
        const totalCount = dataList.length;
        const totalPages = Math.ceil(totalCount / pageSize);

        const offset = this.resolveServerTimeOffset(dataList);
        const historyList = pageData.map(item => {
          const signalType = item.signal_type;
          const strategyType = item.strategy_type || this.inferStrategyTypeFromReasoning(item);
          const strategyLabel = item.strategy_label || this.getStrategyLabel(strategyType);
          const strategyClass = this.getStrategyClass(strategyType);

          return {
            id: item.id,
            time: this.formatTime(item.timestamp, offset),
            symbol: item.inst_id ? item.inst_id.replace('-USDT-SWAP', '') : '',
            signalText: this.getSignalText(signalType),
            signalClass: this.getSignalClass(signalType),
            confidence: Math.round((item.confidence || 0) * 100),
            strategyLabel,
            strategyClass,
            strategyType,
            // 添加详细数据用于点击查看
            fullData: item
          };
        });

        // 统计买卖观望数量
        let buyCount = 0;
        let sellCount = 0;
        let holdCount = 0;
        dataList.forEach(item => {
          if (item.signal_type === 'buy') buyCount++;
          else if (item.signal_type === 'sell') sellCount++;
          else holdCount++;
        });

        this.setData({
          historyList,
          buyCount,
          sellCount,
          holdCount,
          // 分页信息
          pagination: {
            page: page,
            pageSize: pageSize,
            total: totalCount,
            totalPages: totalPages,
            hasMore: page < totalPages
          }
        });

        console.log(`✅ 加载完成，当前页 ${historyList.length} 条，总计 ${totalCount} 条，共 ${totalPages} 页`);
      }
    } catch (error) {
      console.error('❌ 加载分析历史失败:', error);
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      });
    }
  },

  /**
   * 格式化分析结果
   */
  formatAnalysis(analysis) {
    // 后端已经根据置信度阈值修正了signalType，直接使用即可
    const signalType = analysis.signal_type;
    const confidence = Math.round((parseFloat(analysis.confidence) || 0) * 100);
    const positionAnalysis = analysis.position_analysis || '';

    // 根据信号类型确定现货和合约信号
    let spotSignalText = '观望';
    let spotSignalClass = 'yellow';
    let contractSignalText = '观望';
    let contractSignalClass = 'yellow';

    // 后端已经处理了置信度阈值，直接使用返回的signalType
    if (signalType === 'buy') {
      spotSignalText = '买入';
      spotSignalClass = 'green';
      contractSignalText = '做多';
      contractSignalClass = 'green';
    } else if (signalType === 'sell') {
      spotSignalText = '卖出';
      spotSignalClass = 'red';
      contractSignalText = '做空';
      contractSignalClass = 'red';
    }
    // signalType === 'hold' 时，保持默认的'观望'

    // 从持仓分析中提取风险提示
    let risks = [];
    if (positionAnalysis) {
      // 检查是否是置信度不足
      if (positionAnalysis.includes('置信度') && positionAnalysis.includes('不足')) {
        risks.push(`当前置信度${confidence}%未达到交易阈值（需≥70%）`);
        risks.push('建议等待更明确的交易信号');
      }

      // 尝试提取其他风险点
      const riskPatterns = [
        /风险[：:]\s*(.+?)(?=\n|$)/g,
        /注意[：:]\s*(.+?)(?=\n|$)/g,
        /警告[：:]\s*(.+?)(?=\n|$)/g,
        /⚠️\s*(.+?)(?=\n|$)/g
      ];

      for (var i = 0; i < riskPatterns.length; i++) {
        var pattern = riskPatterns[i];
        var match;
        while ((match = pattern.exec(positionAnalysis)) !== null) {
          if (match[1] && match[1].trim()) {
            risks.push(match[1].trim());
          }
        }
      }

      // 如果没有提取到特定风险，根据信号生成默认风险提示
      if (risks.length === 0 && positionAnalysis.length > 0) {
        if (signalType === 'buy') {
          risks.push('市场波动可能导致短期回调');
          risks.push('注意控制仓位，建议分批建仓');
        } else if (signalType === 'sell') {
          risks.push('空头信号可能面临反弹风险');
          risks.push('严格执行止损策略');
        } else {
          risks.push('当前信号不明确，建议观望');
          risks.push('等待更明确的入场时机');
        }
      }
    }

    return {
      id: analysis.id,
      instId: analysis.inst_id,
      spotSignalText,
      spotSignalClass,
      contractSignalText,
      contractSignalClass,
      confidence: confidence,
      suggestedPrice: analysis.suggested_price ? parseFloat(analysis.suggested_price).toFixed(2) : null,
      stopLoss: analysis.stop_loss ? parseFloat(analysis.stop_loss).toFixed(2) : null,
      takeProfit: analysis.take_profit ? parseFloat(analysis.take_profit).toFixed(2) : null,
      reasoning: analysis.reasoning || '暂无分析理由',
      positionAnalysis: positionAnalysis,
      risks: risks
    };
  },

  /**
   * 获取信号文本
   */
  getSignalText(signalType) {
    switch (signalType) {
      case 'buy': return '做多';
      case 'sell': return '做空';
      case 'hold': return '观望';
      default: return '观望';
    }
  },

  /**
   * 获取信号样式类
   */
  getSignalClass(signalType) {
    switch (signalType) {
      case 'buy': return 'green';   // ✅ 做多 = 绿色
      case 'sell': return 'red';     // ✅ 做空 = 红色
      case 'hold': return 'yellow';  // ✅ 观望 = 黄色
      default: return 'yellow';
    }
  },

  getStrategyLabel(strategyType) {
    return 'SAR';
  },

  getStrategyClass(strategyType) {
    return 'sar';
  },

  inferStrategyTypeFromReasoning(item) {
    const reasoning = (item && item.reasoning) ? String(item.reasoning) : '';
    if (reasoning.includes('SAR')) return 'sar';
    return 'sar';
  },

  /**
   * 格式化时间
   */
  formatTime(timestamp) {
    if (!timestamp) return '--';
    const normalized = this.normalizeTimestampValue(timestamp);
    if (!normalized) return '--';
    const offset = typeof arguments[1] === 'number' ? arguments[1] : (this.data.serverTimeOffset || 0);
    const date = new Date(normalized - offset);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const hour = date.getHours().toString().padStart(2, '0');
    const minute = date.getMinutes().toString().padStart(2, '0');
    return `${month}-${day} ${hour}:${minute}`;
  },

  normalizeTimestampValue(timestamp) {
    if (!timestamp) return null;
    let value = timestamp;
    if (typeof value === 'string') {
      const numeric = Number(value);
      value = Number.isFinite(numeric) ? numeric : Date.parse(value);
    }
    if (!Number.isFinite(value)) return null;
    // 秒级时间戳转换为毫秒
    if (value < 1e12) {
      value = value * 1000;
    }
    return value;
  },

  resolveServerTimeOffset(dataList) {
    const now = Date.now();
    let newest = null;
    if (Array.isArray(dataList)) {
      dataList.forEach(item => {
        const normalized = this.normalizeTimestampValue(item && item.timestamp);
        if (normalized && (newest === null || normalized > newest)) {
          newest = normalized;
        }
      });
    } else {
      newest = this.normalizeTimestampValue(dataList);
    }

    if (!newest) return this.data.serverTimeOffset || 0;

    const diff = newest - now;
    const threshold = 5 * 60 * 1000;
    const offset = diff > threshold ? diff : 0;
    if (offset !== this.data.serverTimeOffset) {
      this.setData({ serverTimeOffset: offset });
    }
    return offset;
  },

  /**
   * 开始AI分析
   */
  async startAnalysis() {
    if (this.data.isPureMode) {
      wx.showToast({
        title: '纯策略模式不提供AI分析',
        icon: 'none'
      });
      return;
    }
    if (this.data.isAnalyzing) return;
    const now = Date.now();
    const lastAt = this.data.lastManualAnalysisAt || 0;
    if (now - lastAt < 15000) {
      wx.showToast({
        title: '操作过于频繁，请稍后再试',
        icon: 'none'
      });
      return;
    }

    this.setData({ isAnalyzing: true, lastManualAnalysisAt: now });
    wx.showLoading({ title: '分析中...' });

    try {
      // 调用AI分析API（强制刷新，触发新的分析）
      const res = await API.getLatestAnalysis(this.data.currentSymbol, 1, true, getCurrentUserId());

      if (!res.success) {
        const hint = (res.data && res.data.strategyConfigHint) || res.error || 'AI分析未开启';
        wx.showToast({
          title: hint,
          icon: 'none'
        });
        this.setData({ currentAnalysis: null, analysisTime: '' });
        return;
      }

      if (res.data && res.data.analysisDisabled) {
        const hint = res.data.strategyConfigHint || 'AI分析未开启';
        wx.showToast({
          title: hint,
          icon: 'none'
        });
        this.setData({ currentAnalysis: null, analysisTime: '' });
        return;
      }

      if (res.data) {
        const analysis = res.data;
        const offset = this.resolveServerTimeOffset(analysis.timestamp || Date.now());
        this.setData({
          currentAnalysis: this.formatAnalysis(analysis),
          analysisTime: this.formatTime(analysis.timestamp || Date.now(), offset)
        });

        wx.showToast({
          title: '分析完成',
          icon: 'success'
        });

        // 刷新历史
        await this.loadAnalysisHistory();
      }
    } catch (error) {
      console.error('AI分析失败:', error);
      const message = (error && error.message) ? error.message : 'AI分析失败';
      if (message.includes('并发') || message.includes('429')) {
        wx.showToast({
          title: '并发过高，请稍后再试',
          icon: 'none'
        });
        // 降级：尝试获取最近一次分析结果（不触发新分析）
        try {
          const fallback = await API.getLatestAnalysis(this.data.currentSymbol, 1, false, getCurrentUserId());
          if (fallback && fallback.success && fallback.data) {
            const analysis = fallback.data;
            const offset = this.resolveServerTimeOffset(analysis.timestamp || Date.now());
            this.setData({
              currentAnalysis: this.formatAnalysis(analysis),
              analysisTime: this.formatTime(analysis.timestamp || Date.now(), offset)
            });
          }
        } catch (fallbackError) {
          console.warn('降级获取最新分析失败:', fallbackError);
        }
      } else {
        wx.showToast({
          title: message,
          icon: 'none'
        });
      }
    } finally {
      wx.hideLoading();
      this.setData({ isAnalyzing: false });
    }
  },

  /**
   * 切换自动交易
   */
  async toggleAutoTrade(e) {
    const enabled = e.detail.value;

    wx.showLoading({ title: enabled ? '开启中...' : '关闭中...' });

    try {
      const res = await API.toggleAutoTrading({
        userId: getCurrentUserId(),
        enabled
      });

      if (res.success) {
        this.setData({ autoTradeEnabled: enabled });
        wx.showToast({
          title: enabled ? '自动交易已开启' : '自动交易已关闭',
          icon: 'success'
        });

        // 刷新状态
        await this.loadAutoTradingStatus();
      } else {
        throw new Error(res.error || '操作失败');
      }
    } catch (error) {
      console.error('切换自动交易失败:', error);
      // 恢复原状态
      this.setData({ autoTradeEnabled: !enabled });
      wx.showToast({
        title: error.message || '操作失败',
        icon: 'none'
      });
    } finally {
      wx.hideLoading();
    }
  },

  /**
   * 切换自动分析（控制后端自动交易引擎）
   */
  async toggleAutoAnalysis() {
    if (this.data.isPureMode) {
      wx.showToast({
        title: '纯策略模式不启用AI监控',
        icon: 'none'
      });
      return;
    }
    const enabled = !this.data.autoAnalysisEnabled;

    wx.showLoading({ title: enabled ? '开启中...' : '关闭中...' });

    try {
      // 调用后端 API 启动/停止自动交易引擎
      const res = await API.toggleAutoTrading({
        userId: getCurrentUserId(),
        enabled: enabled
      });

      if (res.success) {
        this.setData({ autoAnalysisEnabled: enabled });

        if (enabled) {
          // 开启后，启动30秒轮询获取最新分析
          if (!this.autoAnalysisTimer) {
            this.autoAnalysisTimer = setInterval(() => {
              this.loadLatestAnalysis();
            }, 30000);
          }

          wx.showToast({
            title: '自动交易已开启',
            icon: 'success'
          });

          // 立即加载一次最新分析
          await this.loadLatestAnalysis();
        } else {
          // 关闭后，清除轮询定时器
          if (this.autoAnalysisTimer) {
            clearInterval(this.autoAnalysisTimer);
            this.autoAnalysisTimer = null;
          }

          wx.showToast({
            title: '自动交易已停止',
            icon: 'success'
          });
        }

        // 刷新状态
        await this.loadAutoTradingStatus();
      } else {
        throw new Error(res.error || '操作失败');
      }
    } catch (error) {
      console.error('切换自动交易失败:', error);
      wx.showToast({
        title: error.message || '操作失败',
        icon: 'none'
      });
    } finally {
      wx.hideLoading();
    }
  },

  /**
   * 刷新持仓
   */
  async refreshPositions() {
    wx.showLoading({ title: '刷新中...' });
    await this.loadPositions();
    wx.hideLoading();
    wx.showToast({
      title: '刷新成功',
      icon: 'success'
    });
  },

  /**
   * 查看历史详情
   */
  viewHistoryDetail(e) {
    const item = e.currentTarget.dataset.item;
    const fullData = item.fullData;

    console.log('📊 准备跳转到详情页，数据:', fullData);

    // 将数据保存到应用实例
    const app = getApp();
    app.historyDetailData = {
      time: item.time,
      symbol: item.symbol,
      signalText: item.signalText,
      signalClass: item.signalClass,
      confidence: item.confidence,
      strategyLabel: item.strategyLabel,
      reasoning: fullData.reasoning || '暂无分析理由',
      positionAnalysis: fullData.position_analysis || '暂无持仓分析',
      suggestedPrice: fullData.suggested_price || '--',
      stopLoss: fullData.stop_loss || '--',
      takeProfit: fullData.take_profit || '--'
    };

    console.log('✅ 数据已保存到 app.historyDetailData:', app.historyDetailData);

    // 跳转到详情页
    wx.navigateTo({
      url: '/pages/history-detail/history-detail'
    });
  },

  /**
   * 显示策略列表弹窗
   */
  /**
   * 进入策略配置页面（修改后的方法）
   */
  goToStrategyEdit() {
    this.goToStrategyList();
  },

  goToStrategyList() {
    wx.navigateTo({
      url: '/pages/strategy-list/strategy-list'
    });
  },

  /**
   * 上一页
   */
  prevPage() {
    const pagination = this.data.pagination;
    if (!pagination || pagination.page <= 1) {
      return;
    }

    const newPage = pagination.page - 1;
    this.loadAnalysisHistory(newPage, pagination.pageSize);
  },

  /**
   * 下一页
   */
  nextPage() {
    const pagination = this.data.pagination;
    if (!pagination || !pagination.hasMore) {
      return;
    }

    const newPage = pagination.page + 1;
    this.loadAnalysisHistory(newPage, pagination.pageSize);
  }
});
