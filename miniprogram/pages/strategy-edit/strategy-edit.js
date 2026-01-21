// pages/strategy-edit/strategy-edit.js
const API = require('../../services/api.js');

const FALLBACK_USER_ID = 'default';

function getCurrentUserId() {
  const userInfo = wx.getStorageSync('userInfo');
  return (userInfo && userInfo.id) ? userInfo.id : FALLBACK_USER_ID;
}

Page({
  data: {
    loading: true,
    saving: false,
    isCreateMode: false,  // ✅ 添加：是否为创建模式
    strategyId: null,     // ✅ 添加：策略ID
    strategyEnabled: false, // ✅ 当前策略是否启用

    // 当前标签页
    currentTab: 0,
    tabs: ['基础设置', '开仓条件', '平仓条件', '资金管理'],

    // ==================== 基础设置 ====================
    basicConfig: {
      strategyName: 'SAR标准策略',
      description: '日线SAR方向(可开关)，15分钟SAR反转白点触发',
      symbol: 'ETH-USDT-SWAP',
      strategyType: 'sar',  // 策略类型
      tradingStyle: 'conservative',  // 交易风格 aggressive/conservative
      tradeDirection: 'both',  // 交易方向 long/short/both
      directionTimeframe: 'daily',  // 方向判断周期 daily/15m
      entryTimeframe: '15m',  // 入场确认周期
      analysisInterval: 30,  // 分析间隔（秒）
      cooldownSeconds: 60,  // 冷却时间
      minHoldSeconds: 60,  // ✅ 新增：最短持仓时间（秒）
      tradingMode: 'pure'  // ✅ 默认纯策略（可切换AI）
    },

    // 选项列表
    symbolList: ['ETH-USDT-SWAP', 'BTC-USDT-SWAP', 'SOL-USDT-SWAP', 'DOGE-USDT-SWAP'],
    strategyTypes: [
      // ✅ 纯SAR策略模板
      {
        value: 'sar',
        name: 'SAR策略',
        desc: '📈 日线SAR方向(可开关)，15分钟SAR反转白点触发入场',
        default: true,
        params: {
          directionTimeframe: 'daily',
          entryTimeframe: '15m',
          tradingMode: 'pure',
          stopLoss: 0.5,
          takeProfit: 1.0,
          leverage: 3,
          fixedAmount: 50
        }
      }
    ],
    templateOptions: [],
    styleList: [
      { value: 'conservative', name: '稳健', desc: '更高置信度要求，减少频繁交易' },
      { value: 'aggressive', name: '激进', desc: '更积极开仓，抓住更多机会' }
    ],
    directionList: [
      { value: 'both', name: '多空双向', desc: '根据市场情况做多或做空' },
      { value: 'long', name: '只做多', desc: '只开多仓，不做空' },
      { value: 'short', name: '只做空', desc: '只开空仓，不做多' }
    ],
    // ✅ 交易模式选项（保留AI辅助）
    allowAiMode: true,
    tradingModeList: [
      { value: 'ai', name: 'AI辅助模式', desc: '🤖 AI智能分析，考虑更多因素（适合策略验证）' },
      { value: 'pure', name: '纯策略模式', desc: '⚡ 直接基于技术指标，快速响应，零AI成本' }
    ],

    // ==================== 开仓条件 ====================
    buyConfig: {
      logicType: 'or',  // and/or
      conditions: [
        { id: 'sar_daily', name: '日线SAR', desc: '日线SAR方向(可开关)', enabled: true, indicator: 'sar', timeframe: '1D', operator: 'direction', required: true },
        { id: 'sar_15m_reversal', name: '15分钟SAR反转', desc: 'SAR反转白点(回看一根K线)', enabled: true, indicator: 'sar', timeframe: '15m', operator: 'reversal' }
      ]
    },

    // ==================== 平仓条件 ====================
    sellConfig: {
      logicType: 'or',  // and/or
      stopLossEnabled: true,
      takeProfitEnabled: true,
      stopLossPercent: 0.5,  // 止损百分比
      takeProfitPercent: 1.0,  // 止盈百分比
      conditions: [
        { id: 'sar_reversal', name: '15分钟SAR反转', desc: 'SAR反转白点(回看一根K线)', enabled: true, indicator: 'sar', timeframe: '15m', reversal: true },
        { id: 'stop_loss', name: '百分比止损', desc: '亏损超过阈值平仓', enabled: true },
        { id: 'take_profit', name: '百分比止盈', desc: '盈利达到目标平仓', enabled: true }
      ]
    },

    // ==================== 资金管理 ====================
    fundConfig: {
      mode: 'fixed',  // fixed/balance
      fixedAmount: 50,  // 固定金额（USDT）
      balancePercent: 10,  // 账户余额百分比
      leverage: 5,  // 杠杆倍数
      marginMode: 'cross',  // cross/isolated
      maxPositions: 3  // 最大持仓数
    },

    modeList: [
      { value: 'fixed', name: '固定金额', desc: '每次交易使用固定金额' },
      { value: 'balance', name: '账户比例', desc: '使用账户余额的百分比' }
    ],
    marginModeList: [
      { value: 'cross', name: '全仓模式', desc: '账户余额共享，风险共担' },
      { value: 'isolated', name: '逐仓模式', desc: '固定保证金，风险隔离' }
    ]
  },

  async onLoad(options) {
    console.log('🚀 策略编辑页面加载，参数:', options);
    console.log('📊 初始 data.strategyId:', this.data.strategyId);
    console.log('📊 初始 data.isCreateMode:', this.data.isCreateMode);

    // 判断是创建模式还是编辑模式
    if (options.mode === 'create') {
      const templateOptions = this.data.strategyTypes || [];
      // 创建模式：固定使用纯SAR模板
      console.log('📝 进入创建模式（纯SAR）');
      this.setData({
        isCreateMode: true,
        strategyId: null,
        strategyEnabled: false,
        pageTitle: '创建新策略',
        loading: false,
        templateOptions
      });

      this.applySAR_Default();
    } else if (options.strategyId) {
      this.setData({
        templateOptions: this.data.strategyTypes
      });
      // 编辑模式：加载指定策略
      console.log('📝 进入编辑模式，strategyId:', options.strategyId);
      this.setData({
        strategyId: options.strategyId,  // ✅ 使用 setData
        isCreateMode: false,
        pageTitle: '编辑策略'
      });
      this.loadStrategyById(options.strategyId);
    } else {
      // 默认：加载默认配置
      console.log('📝 进入默认配置模式');
      // ✅ 先设置 loading 状态，防止渲染默认值
      this.setData({
        isCreateMode: false,
        pageTitle: '策略配置',
        loading: true,  // ✅ 保持 loading 状态
        templateOptions: this.data.strategyTypes
      });
      // ✅ 等待加载完成后再隐藏 loading
      await this.loadStrategyConfig();
    }

    console.log('✅ onLoad 完成，data.strategyId:', this.data.strategyId);
    console.log('✅ onLoad 完成，data.isCreateMode:', this.data.isCreateMode);
  },

  /**
   * 页面显示时重新加载配置（解决缓存问题）
   */
  onShow() {
    console.log('🔄 页面显示，重新加载配置...');
    // ✅ 防止在保存过程中重新加载
    if (this.data.saving) {
      console.log('⚠️  正在保存中，跳过重新加载');
      return;
    }
    if (this.data.isCreateMode) {
      return;
    }
    // 重新加载配置以确保显示最新数据
    if (this.data.strategyId) {
      this.loadStrategyById(this.data.strategyId, false);
    } else {
      this.loadStrategyConfig();
    }
  },

  /**
   * 根据ID加载策略
   */
  async loadStrategyById(strategyId, showToast = true) {
    wx.showLoading({ title: '加载中...' });

    try {
      const res = await API.getStrategyDetail(strategyId);
      if (res.success && res.data) {
        const strategy = res.data;
        console.log('加载策略数据:', strategy);

        // 将策略数据转换为表单数据
        const formData = this.convertStrategyToFormData(strategy);
        this.setData(formData);

        if (showToast) {
          wx.showToast({
            title: '策略已加载',
            icon: 'success'
          });
        }
      } else {
        if (showToast) {
          wx.showToast({
            title: '加载失败',
            icon: 'none'
          });
        }
      }
    } catch (error) {
      console.error('加载策略失败:', error);
      if (showToast) {
        wx.showToast({
          title: '加载失败',
          icon: 'none'
        });
      }
    } finally {
      this.setData({ loading: false });
      wx.hideLoading();
    }
  },

  /**
   * 将策略数据转换为表单数据
   */
  convertStrategyToFormData(strategy) {
    // 映射策略类型（优先用名称推断，避免依赖id格式）
    const strategyName = (strategy.name || '').toLowerCase();
    let inferredStrategyType = 'sar';
    if (strategyName.includes('sar')) {
      inferredStrategyType = 'sar';
    }
    const stopLossPercentRaw = parseFloat((strategy.sell_strategy && strategy.sell_strategy.stopLossPercent) || 0);
    const takeProfitPercentRaw = parseFloat((strategy.sell_strategy && strategy.sell_strategy.takeProfitPercent) || 0);
    const stopLossEnabled = stopLossPercentRaw > 0;
    const takeProfitEnabled = takeProfitPercentRaw > 0;

    const fundModeRaw = (strategy.fund_config && strategy.fund_config.mode) || 'balance';
    const fundMode = fundModeRaw === 'accountBalance' ? 'balance' : fundModeRaw;

    // 映射时间周期
    const timeframeMap = {
      '1D': 'daily',
      '1H': '1h',
      '15m': '15m',
      '5m': '5m'
    };

    // 完整的条件模板（包含所有可能的条件）
    var allConditionTemplates = [
      { id: 'sar_daily', name: '日线SAR', desc: '日线SAR方向(可开关)', enabled: true, indicator: 'sar', timeframe: '1D', operator: 'direction', required: true },
      { id: 'sar_15m_reversal', name: '15分钟SAR反转', desc: 'SAR反转白点(回看一根K线)', enabled: true, indicator: 'sar', timeframe: '15m', operator: 'reversal' }
    ];

    // 获取服务端返回的条件
    var serverConditions = (strategy.buy_strategy && strategy.buy_strategy.conditions) || [];
    // 根据开仓条件补充推断（避免名称被用户改掉）
    var hasSar = serverConditions.some(function(c) { return c && c.indicator === 'sar'; });
    if (hasSar) {
      inferredStrategyType = 'sar';
    }

    const strategyNameMap = {
      sar: 'SAR标准策略'
    };
    const fallbackStrategyName = strategyNameMap[inferredStrategyType] || 'SAR标准策略';

    // 根据服务端条件构建最终条件列表
    var mergedConditions = serverConditions.map(function(serverCond) {
      // 找到对应的模板，补充 name 和 desc
      var template = allConditionTemplates.find(function(t) { return t.id === serverCond.id; });
      if (template) {
        // 使用模板为基础，用服务端数据覆盖
        var result = Object.assign({}, template);
        result.enabled = serverCond.enabled !== undefined ? serverCond.enabled : template.enabled;
        result.timeframe = serverCond.timeframe || template.timeframe;
        if (serverCond.macdSignal) {
          result.macdSignal = serverCond.macdSignal;
        }
        if (serverCond.operator) {
          result.operator = serverCond.operator;
        }
        if (serverCond.required !== undefined) {
          result.required = serverCond.required;
        }
        return result;
      }
      // 如果没有模板，直接返回服务端数据（防止丢失自定义条件）
      return serverCond;
    });

    return {
      strategyId: strategy.id,
      strategyEnabled: !!strategy.is_enabled,

      // 基础配置
      basicConfig: {
        strategyId: strategy.id,
        strategyName: strategy.name || fallbackStrategyName,
        description: strategy.description || '',
        symbol: strategy.symbol || 'ETH-USDT-SWAP',
        strategyType: inferredStrategyType,
        tradingStyle: 'conservative',
        tradeDirection: strategy.trade_direction || 'both',
        directionTimeframe: timeframeMap[strategy.direction_timeframe] || 'daily',
        entryTimeframe: strategy.entry_timeframe || '15m',
        analysisInterval: strategy.analysis_interval || 30,
        tradingMode: strategy.trading_mode || 'pure',
        cooldownSeconds: (strategy.risk_control && strategy.risk_control.cooldownSeconds) || 60,
        minHoldSeconds: (strategy.risk_control && strategy.risk_control.minHoldSeconds) || 60  // ✅ 新增
      },

      // 开仓条件
      buyConfig: {
        conditions: mergedConditions,
        logicType: (strategy.buy_strategy && strategy.buy_strategy.logicType) || 'or'
      },

      // 平仓条件（从服务端获取或使用默认值）
      sellConfig: (() => {
        // 默认的卖出条件模板（纯SAR）
        var defaultSellConditions = [
          { id: 'sar_reversal', name: '15分钟SAR反转', desc: 'SAR反转白点(回看一根K线)', enabled: true, indicator: 'sar', timeframe: '15m', reversal: true },
          { id: 'stop_loss', name: '百分比止损', desc: '亏损超过阈值平仓', enabled: true },
          { id: 'take_profit', name: '百分比止盈', desc: '盈利达到目标平仓', enabled: true }
        ];

        // 获取服务端返回的卖出条件
        var serverSellConditions = (strategy.sell_strategy && strategy.sell_strategy.conditions) || [];

        // 如果服务端有卖出条件，使用服务端的；否则使用默认值
        var finalSellConditions = serverSellConditions.length > 0
          ? serverSellConditions.map(function(serverCond) {
              var template = defaultSellConditions.find(function(t) { return t.id === serverCond.id; });
              if (template) {
                return Object.assign({}, template, serverCond);
              }
              return serverCond;
            })
          : defaultSellConditions;

        return {
          logicType: 'or',
          stopLossEnabled: stopLossEnabled,
          takeProfitEnabled: takeProfitEnabled,
          takeProfitPercent: takeProfitPercentRaw,
          stopLossPercent: stopLossPercentRaw,
          trailingStopPercent: 0.5,
          conditions: finalSellConditions
        };
      })(),

      // 资金配置
      fundConfig: {
        mode: fundMode,
        fixedAmount: (strategy.fund_config && strategy.fund_config.fixedAmount) || 100,
        balancePercent: (strategy.fund_config && strategy.fund_config.percentage) || 40,
        leverage: (strategy.fund_config && strategy.fund_config.leverage) || 5,
        marginMode: (strategy.fund_config && strategy.fund_config.marginMode) || 'cross',
        maxPositions: (strategy.risk_control && strategy.risk_control.maxPositions) || 3
      }
    };
  },

  /**
   * 加载策略配置
   */
  async loadStrategyConfig() {
    wx.showLoading({ title: '加载中...' });

    try {
      console.log('📥 开始加载默认策略配置...');
      const userId = getCurrentUserId();
      const listRes = await API.getStrategyList(userId);

      if (listRes.success && Array.isArray(listRes.data) && listRes.data.length > 0) {
        const defaultStrategy = listRes.data.find(s => s.is_default) || listRes.data[0];
        const detailRes = await API.getStrategyDetail(defaultStrategy.id);

        if (detailRes.success && detailRes.data) {
          const formData = this.convertStrategyToFormData(detailRes.data);
          this.setData({
            ...formData,
            strategyId: detailRes.data.id,
            isCreateMode: false
          });
          console.log('✅ 默认策略已加载:', detailRes.data.name || detailRes.data.id);
        } else {
          console.warn('⚠️ 默认策略详情加载失败，使用本地默认配置');
          this.applySAR_Default();
        }
      } else {
        console.warn('⚠️ 未找到策略列表，使用本地默认配置');
        this.applySAR_Default();
      }
    } catch (error) {
      console.error('❌ 加载默认策略失败:', error);
      this.applySAR_Default();
    } finally {
      this.setData({ loading: false });
      wx.hideLoading();
    }
  },

  /**
   * 切换标签页
   */
  switchTab(e) {
    const index = e.currentTarget.dataset.index;
    this.setData({ currentTab: index });
  },

  // ==================== 基础设置事件 ====================

  onSymbolChange(e) {
    const index = e.detail.value;
    this.setData({
      'basicConfig.symbol': this.data.symbolList[index]
    });
  },

  onStrategyTypeChange(e) {
    const index = e.detail.value;
    const optionList = (this.data.templateOptions && this.data.templateOptions.length > 0)
      ? this.data.templateOptions
      : this.data.strategyTypes;
    const nextType = optionList[index].value;
    if (this.data.isCreateMode) {
      this.applySAR_Default();
      return;
    }
    const strategyNameMap = {
      sar: 'SAR标准策略'
    };
    const currentName = this.data.basicConfig.strategyName || '';
    const currentType = this.data.basicConfig.strategyType;
    const currentDefault = strategyNameMap[currentType] || '';
    const nextDefault = strategyNameMap[nextType] || '';
    const shouldUpdateName = !currentName || currentName === currentDefault;

    this.setData({
      'basicConfig.strategyType': nextType,
      ...(shouldUpdateName ? { 'basicConfig.strategyName': nextDefault } : {})
    });
  },

  onStyleChange(e) {
    const index = e.detail.value;
    this.setData({
      'basicConfig.tradingStyle': this.data.styleList[index].value
    });
  },

  onDirectionChange(e) {
    const index = e.detail.value;
    this.setData({
      'basicConfig.tradeDirection': this.data.directionList[index].value
    });
  },

  onStrategyNameInput(e) {
    this.setData({
      'basicConfig.strategyName': e.detail.value
    });
  },

  onAnalysisIntervalChange(e) {
    this.setData({
      'basicConfig.analysisInterval': e.detail.value
    });
  },

  // ✅ 新增：最短持仓时间变更
  onMinHoldSecondsChange(e) {
    this.setData({
      'basicConfig.minHoldSeconds': e.detail.value
    });
  },

  // ✅ 新增：交易模式切换
  onTradingModeChange(e) {
    const index = e.detail.value;
    const mode = this.data.tradingModeList[index].value;
    this.setData({
      'basicConfig.tradingMode': mode
    });

    console.log(`✅ 交易模式已切换为: ${mode}`);
    if (mode === 'pure') {
      console.log('   ⚡ 纯策略模式：直接基于技术指标，快速响应，零AI成本');
    } else {
      console.log('   🤖 AI辅助模式：AI智能分析，考虑更多因素');
    }
  },

  onTradingModeSelect(e) {
    const mode = e.currentTarget.dataset.mode;
    if (!mode || mode === this.data.basicConfig.tradingMode) {
      return;
    }
    this.setData({
      'basicConfig.tradingMode': mode
    });

    console.log(`✅ 交易模式已切换为: ${mode}`);
  },

  // ==================== 开仓条件事件 ====================

  onBuyLogicChange(e) {
    this.setData({
      'buyConfig.logicType': e.detail.value ? 'and' : 'or'
    });
  },

  onBuyConditionToggle(e) {
    const index = e.currentTarget.dataset.index;
    const conditions = this.data.buyConfig.conditions;
    conditions[index].enabled = !conditions[index].enabled;
    this.setData({
      'buyConfig.conditions': conditions
    });
  },

  // ==================== 平仓条件事件 ====================

  onStopLossEnabledChange(e) {
    const enabled = e.detail.value;
    const updates = {
      'sellConfig.stopLossEnabled': enabled
    };
    if (enabled && this.data.sellConfig.stopLossPercent <= 0) {
      updates['sellConfig.stopLossPercent'] = 2.0;
    }
    this.setData(updates);
  },

  onTakeProfitEnabledChange(e) {
    const enabled = e.detail.value;
    const updates = {
      'sellConfig.takeProfitEnabled': enabled
    };
    if (enabled && this.data.sellConfig.takeProfitPercent <= 0) {
      updates['sellConfig.takeProfitPercent'] = 5.0;
    }
    this.setData(updates);
  },

  onStopLossPercentChange(e) {
    this.setData({
      'sellConfig.stopLossPercent': e.detail.value
    });
  },

  onTakeProfitPercentChange(e) {
    this.setData({
      'sellConfig.takeProfitPercent': e.detail.value
    });
  },

  onReversalConfirmChange(e) {
    this.setData({
      'sellConfig.reversalRequireConfirm': e.detail.value
    });
  },

  /**
   * ✅ 新增：切换平仓条件
   */
  toggleSellCondition(e) {
    const id = e.currentTarget.dataset.id;
    const conditions = this.data.sellConfig.conditions;

    // 查找并切换条件状态
    const condition = conditions.find(c => c.id === id);
    if (condition) {
      condition.enabled = !condition.enabled;
      this.setData({
        'sellConfig.conditions': conditions
      });
    }
  },

  // ==================== 资金管理事件 ====================

  onFundModeChange(e) {
    const index = e.detail.value;
    this.setData({
      'fundConfig.mode': this.data.modeList[index].value
    });
  },

  onFixedAmountChange(e) {
    this.setData({
      'fundConfig.fixedAmount': e.detail.value
    });
  },

  onBalancePercentChange(e) {
    this.setData({
      'fundConfig.balancePercent': e.detail.value
    });
  },

  onLeverageChange(e) {
    this.setData({
      'fundConfig.leverage': e.detail.value
    });
  },

  onMarginModeChange(e) {
    const index = e.detail.value;
    this.setData({
      'fundConfig.marginMode': this.data.marginModeList[index].value
    });
  },

  onMaxPositionsChange(e) {
    this.setData({
      'fundConfig.maxPositions': e.detail.value
    });
  },

  // ==================== 保存配置 ====================

  /**
   * 测试方法
   */
  testClick() {
    console.log('✅✅✅ 测试按钮被点击了！✅✅✅');
    wx.showModal({
      title: '测试',
      content: '测试按钮点击成功！',
      showCancel: false
    });
  },

  /**
   * 处理保存按钮点击
   */
  handleSaveTap() {
    console.log('🔘 保存按钮被点击！');
    console.log('📊 当前状态:', {
      isCreateMode: this.data.isCreateMode,
      strategyId: this.data.strategyId,
      saving: this.data.saving
    });
    this.saveConfig();
  },

  async saveConfig() {
    console.log('🔘 saveConfig 被调用');
    console.log('📊 当前状态:', {
      isCreateMode: this.data.isCreateMode,
      strategyId: this.data.strategyId,
      saving: this.data.saving
    });

    if (this.data.saving) {
      console.log('⚠️  正在保存中，跳过');
      return;
    }

    console.log('✅ 开始保存流程...');
    this.setData({ saving: true });
    wx.showLoading({ title: '保存中...' });

    try {
      const userId = getCurrentUserId();
      // ✅ 检查数据完整性
      console.log('🔍 检查 data 对象完整性:');
      console.log('   - basicConfig:', this.data.basicConfig ? '✅' : '❌ NULL');
      console.log('   - buyConfig:', this.data.buyConfig ? '✅' : '❌ NULL');
      console.log('   - sellConfig:', this.data.sellConfig ? '✅' : '❌ NULL');
      console.log('   - fundConfig:', this.data.fundConfig ? '✅' : '❌ NULL');

      // 处理 fundConfig 字段映射：页面使用 balancePercent，API 使用 percentage
      const balancePercent = this.data.fundConfig.balancePercent !== undefined
        ? this.data.fundConfig.balancePercent
        : (this.data.fundConfig.percentage !== undefined ? this.data.fundConfig.percentage : 40);
      const serverFundConfig = {
        mode: this.data.fundConfig.mode,
        fixedAmount: this.data.fundConfig.fixedAmount,
        percentage: balancePercent,  // 映射 balancePercent -> percentage
        leverage: this.data.fundConfig.leverage,
        marginMode: this.data.fundConfig.marginMode,
        maxPositions: this.data.fundConfig.maxPositions
      };

      const normalizeCondition = (condition) => {
        const cleaned = {};
        const source = condition || {};
        Object.keys(source).forEach((key) => {
          const value = source[key];
          if (value === undefined) {
            return;
          }
          if (key === 'macdSignal' && source.indicator !== 'macd') {
            return;
          }
          cleaned[key] = value;
        });
        if (source.indicator === 'macd' && !cleaned.macdSignal) {
          cleaned.macdSignal = 'cross';
        }
        return cleaned;
      };

      const normalizedBuyConditions = Array.isArray(this.data.buyConfig.conditions)
        ? this.data.buyConfig.conditions.map(normalizeCondition)
        : [];
      const normalizedSellConditions = Array.isArray(this.data.sellConfig.conditions)
        ? this.data.sellConfig.conditions.map(normalizeCondition)
        : [];

      // 保持页面数据干净，避免出现 undefined 字段导致校验报错
      this.setData({
        'buyConfig.conditions': normalizedBuyConditions,
        'sellConfig.conditions': normalizedSellConditions
      });

      const sanitizedBuyConfig = {
        ...this.data.buyConfig,
        conditions: normalizedBuyConditions
      };

      const sanitizedSellConfig = {
        ...this.data.sellConfig,
        conditions: normalizedSellConditions
      };

      const config = {
        basicConfig: {
          ...this.data.basicConfig,
          strategyId: this.data.strategyId || this.data.basicConfig.strategyId || null
        },
        buyConfig: sanitizedBuyConfig,
        sellConfig: sanitizedSellConfig,
        fundConfig: serverFundConfig
      };

      // ✅ 检查是否有 undefined 字段（仅检查准备保存的配置）
      const checkUndefined = (obj, prefix = '') => {
        for (let key in obj) {
          if (!obj.hasOwnProperty(key)) continue;
          const value = obj[key];
          const path = prefix ? `${prefix}.${key}` : key;
          if (value === undefined) {
            if (key === 'macdSignal' && obj && obj.indicator !== 'macd') {
              continue;
            }
            console.error(`❌ 发现 undefined 字段: ${path}`);
          } else if (typeof value === 'object' && value !== null) {
            checkUndefined(value, path);
          }
        }
      };
      checkUndefined(config, 'config');

      console.log('📊 准备保存的 config 对象:');
      console.log('   - basicConfig keys:', Object.keys(config.basicConfig || {}));
      console.log('   - buyConfig keys:', Object.keys(config.buyConfig || {}));
      console.log('   - sellConfig keys:', Object.keys(config.sellConfig || {}));
      console.log('   - fundConfig keys:', Object.keys(config.fundConfig || {}));

      // 根据模式选择保存方式
      console.log('🔍 判断保存分支...');
      console.log('   isCreateMode:', this.data.isCreateMode);
      console.log('   strategyId:', this.data.strategyId);

      if (this.data.isCreateMode) {
        console.log('📝 进入创建模式分支');
        // 创建模式：创建新策略
        const strategyData = this.convertFormDataToStrategy(config);
        const res = await API.createStrategy({
          userId,
          strategy: strategyData
        });

        if (res.success) {
          if (res.data && res.data.id) {
            await API.setDefaultStrategy(res.data.id);
          }
          // 新建策略默认不启用，先不覆盖当前启用策略配置
          this.setData({ strategyEnabled: false });
          wx.showToast({
            title: '策略创建成功',
            icon: 'success'
          });

          setTimeout(() => {
            wx.navigateBack();
          }, 1500);
        } else {
          throw new Error(res.error || '创建失败');
        }
      } else if (this.data.strategyId) {
        console.log('📝 进入编辑模式分支');
        console.log('📝 strategyId:', this.data.strategyId);
        // 编辑模式：更新现有策略
        const strategyData = this.convertFormDataToStrategy(config);
        console.log('📝 strategyData:', JSON.stringify(strategyData));
        console.log('📝 开始调用 API.updateStrategy...');
        const res = await API.updateStrategy(this.data.strategyId, {
          strategy: strategyData
        });
        console.log('📝 API.updateStrategy 返回:', JSON.stringify(res));

        if (res.success) {
          // 仅当当前策略已启用时，才同步保存完整策略配置（strategy_config）
          if (this.data.strategyEnabled) {
            try {
              await API.saveStrategyConfig({ userId, config });
            } catch (saveError) {
              console.warn('⚠️ 保存策略配置失败:', saveError);
            }
          }
          wx.showToast({
            title: '策略更新成功',
            icon: 'success'
          });

          setTimeout(() => {
            wx.navigateBack();
          }, 1500);
        } else {
          throw new Error(res.error || '更新失败');
        }
      } else {
        console.log('📝 进入无策略ID分支，创建默认策略');
        const strategyData = this.convertFormDataToStrategy(config);
        console.log('📝 strategyData:', JSON.stringify(strategyData));
        console.log('📝 开始调用 API.createStrategy...');
        const res = await API.createStrategy({
          userId,
          strategy: strategyData
        });
        console.log('📝 API.createStrategy 返回:', JSON.stringify(res));
        if (res.success && res.data && res.data.id) {
          await API.setDefaultStrategy(res.data.id);
          this.setData({ strategyEnabled: false });
          this.setData({ strategyId: res.data.id });
          wx.showToast({
            title: '策略已创建',
            icon: 'success'
          });
          setTimeout(() => {
            wx.navigateBack();
          }, 1500);
        } else {
          throw new Error(res.error || '创建失败');
        }
      }
    } catch (error) {
      console.error('保存策略失败:', error);
      wx.showToast({
        title: error.message || '保存失败',
        icon: 'none'
      });
    } finally {
      this.setData({ saving: false });
      wx.hideLoading();
    }
  },

  /**
   * 将表单数据转换为策略数据（用于创建/更新策略）
   */
  convertFormDataToStrategy(config) {
    // 时间周期映射
    const timeframeReverseMap = {
      'daily': '1D',
      '1h': '1H',
      '15m': '15m',
      '5m': '5m'
    };

    // 策略类型映射
    const strategyNameMap = {
      'sar': 'SAR标准策略'
    };

    const strategyType = config.basicConfig.strategyType || 'sar';
    const balancePercent = config.fundConfig.balancePercent !== undefined
      ? config.fundConfig.balancePercent
      : (config.fundConfig.percentage !== undefined ? config.fundConfig.percentage : 40);
    const stopLossPercent = config.sellConfig.stopLossEnabled ? config.sellConfig.stopLossPercent : 0;
    const takeProfitPercent = config.sellConfig.takeProfitEnabled ? config.sellConfig.takeProfitPercent : 0;

    return {
      name: config.basicConfig.strategyName || strategyNameMap[strategyType] || '自定义策略',
      description: config.basicConfig.description || `${strategyNameMap[strategyType]} - 自动创建`,
      symbol: config.basicConfig.symbol || 'ETH-USDT-SWAP',
      trade_direction: config.basicConfig.tradeDirection || 'both',
      analysis_interval: config.basicConfig.analysisInterval || 30,
      trading_mode: config.basicConfig.tradingMode || 'pure',
      direction_timeframe: timeframeReverseMap[config.basicConfig.directionTimeframe] || '1D',
      entry_timeframe: config.basicConfig.entryTimeframe || '15m',
      fund_config: {
        mode: config.fundConfig.mode || 'balance',
        fixedAmount: config.fundConfig.fixedAmount || 100,
        percentage: balancePercent,
        leverage: config.fundConfig.leverage || 5,
        marginMode: config.fundConfig.marginMode || 'cross'
      },
      buy_strategy: {
        conditions: config.buyConfig.conditions || [],
        logicType: config.buyConfig.logicType || 'or'
      },
      sell_strategy: {
        takeProfitPercent: takeProfitPercent || 0,
        stopLossPercent: stopLossPercent || 0
      },
      risk_control: {
        cooldownSeconds: config.basicConfig.cooldownSeconds || 60,
        minHoldSeconds: config.basicConfig.minHoldSeconds || 60,  // ✅ 新增
        maxPositions: config.fundConfig.maxPositions || 3
      }
    };
  },

  /**
   * 重置为默认配置
   */
  resetToDefault() {
    wx.showModal({
      title: '确认重置',
      content: '确定要恢复默认配置吗？当前修改将丢失。',
      success: (res) => {
        if (res.confirm) {
          this.setData({
            basicConfig: {
              strategyName: 'SAR标准策略',
              description: '日线SAR方向(可开关)，15分钟SAR反转白点触发',
              symbol: 'ETH-USDT-SWAP',
              strategyType: 'sar',
              tradingStyle: 'conservative',
              tradeDirection: 'both',
              directionTimeframe: 'daily',
              entryTimeframe: '15m',
              analysisInterval: 30,
              tradingMode: 'pure',
              cooldownSeconds: 60
            },
            buyConfig: {
              logicType: 'or',
              conditions: [
                { id: 'sar_daily', name: '日线SAR', desc: '日线SAR方向(可开关)', enabled: true, indicator: 'sar', timeframe: '1D', operator: 'direction', required: true },
                { id: 'sar_15m_reversal', name: '15分钟SAR反转', desc: 'SAR反转白点(回看一根K线)', enabled: true, indicator: 'sar', timeframe: '15m', operator: 'reversal' }
              ]
            },
            sellConfig: {
              logicType: 'or',
              stopLossEnabled: true,
              takeProfitEnabled: true,
              stopLossPercent: 0.5,
              takeProfitPercent: 1.0,
              reversalRequireConfirm: true,
              conditions: [
                { id: 'sar_reversal', name: '15分钟SAR反转', desc: 'SAR反转白点(回看一根K线)', enabled: true, indicator: 'sar', timeframe: '15m', reversal: true },
                { id: 'stop_loss', name: '百分比止损', desc: '亏损超过阈值平仓', enabled: true },
                { id: 'take_profit', name: '百分比止盈', desc: '盈利达到目标平仓', enabled: true }
              ]
            },
            fundConfig: {
              mode: 'fixed',
              fixedAmount: 50,
              balancePercent: 10,
              leverage: 5,
              marginMode: 'cross',
              maxPositions: 3
            }
          });

          wx.showToast({
            title: '已恢复默认',
            icon: 'success'
          });
        }
      }
    });
  },

  /**
   * ✅ 应用SAR默认策略配置
   * 根据SAR.md文档配置默认参数
   */
  applySAR_Default() {
    console.log('🎯 应用SAR纯策略默认配置...');

    // SAR策略默认参数
    const params = {
      directionTimeframe: 'daily',
      entryTimeframe: '15m',
      tradingMode: 'pure',
      stopLoss: 0.5,      // 0.5%止损
      takeProfit: 1.0,    // 1.0%止盈
      leverage: 3,         // 3倍杠杆
      fixedAmount: 50     // 50 USDT
    };

    // 应用基础配置
    this.setData({
      basicConfig: {
        ...this.data.basicConfig,
        strategyName: 'SAR标准策略',
        description: '日线SAR方向(可开关)，15分钟SAR反转白点触发',
        strategyType: 'sar',
        tradingMode: params.tradingMode,
        directionTimeframe: params.directionTimeframe,
        entryTimeframe: params.entryTimeframe
      },
      fundConfig: {
        ...this.data.fundConfig,
        mode: 'fixed',
        fixedAmount: params.fixedAmount,
        leverage: params.leverage
      },
      // 应用买入条件（仅SAR，不含MACD）
      buyConfig: {
        ...this.data.buyConfig,
        logicType: 'or',  // 任一触发
        conditions: [
          { id: 'sar_daily', name: '日线SAR', desc: '日线SAR方向(可开关)', enabled: true, indicator: 'sar', timeframe: '1D', operator: 'direction', required: true },
          { id: 'sar_15m_reversal', name: '15分钟SAR反转', desc: 'SAR反转白点(回看一根K线)', enabled: true, indicator: 'sar', timeframe: '15m', operator: 'reversal' }
        ]
      },
      // 应用卖出条件（仅SAR反转，不含MACD）
      sellConfig: {
        ...this.data.sellConfig,
        logicType: 'or',  // 任一条件满足即可
        stopLossEnabled: true,
        takeProfitEnabled: true,
        stopLossPercent: params.stopLoss,      // 0.5%
        takeProfitPercent: params.takeProfit,   // 1.0%
        conditions: [
          { id: 'sar_reversal', name: '15分钟SAR反转', desc: 'SAR反转白点(回看一根K线)', enabled: true, indicator: 'sar', timeframe: '15m', reversal: true },
          { id: 'stop_loss', name: '百分比止损', desc: '亏损超过阈值平仓', enabled: true },
          { id: 'take_profit', name: '百分比止盈', desc: '盈利达到目标平仓', enabled: true }
        ]
      }
    });

    console.log('✅ SAR纯策略默认配置已应用');
    console.log('  - 止损:', params.stopLoss + '%');
    console.log('  - 止盈:', params.takeProfit + '%');
    console.log('  - 杠杆:', params.leverage + 'x');
    console.log('  - 交易模式:', params.tradingMode);
  }
});
