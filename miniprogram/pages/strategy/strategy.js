// pages/strategy/strategy.js
const API = require('../../services/api.js');

const FALLBACK_USER_ID = 'default';

function getCurrentUserId() {
  const userInfo = wx.getStorageSync('userInfo');
  return (userInfo && userInfo.id) ? userInfo.id : FALLBACK_USER_ID;
}

Page({
  data: {
    // 自动交易状态
    autoTradeEnabled: false,
    saving: false,

    // 交易统计
    stats: {
      totalTrades: 0,
      winTrades: 0,
      lossTrades: 0,
      winRate: 0
    },

    // 交易对列表
    symbolList: ['ETH-USDT-SWAP', 'BTC-USDT-SWAP', 'SOL-USDT-SWAP', 'DOGE-USDT-SWAP'],
    symbolIndex: 0,

    // 配置
    config: {
      symbol: 'ETH-USDT-SWAP',
      maxPositions: 3,
      stopLossPercent: 0.2,
      takeProfitPercent: 1.0,
      positionSize: 0.4,
      cooldownSeconds: 60
    },

    // 原始配置（用于检测变化）
    originalConfig: null,
    strategyId: null
  },

  onLoad() {
    this.loadData();
  },

  onShow() {
    // 页面显示时刷新数据
    this.loadAutoTradingStatus();
  },

  /**
   * 加载数据
   */
  async loadData() {
    wx.showLoading({ title: '加载中...' });

    try {
      await Promise.all([
        this.loadDefaultStrategy(),
        this.loadAutoTradingStatus()
      ]);
    } catch (error) {
      console.error('加载配置失败:', error);
    } finally {
      wx.hideLoading();
    }
  },

  /**
   * 加载自动交易配置
   */
  async loadDefaultStrategy() {
    try {
      const userId = getCurrentUserId();
      const listRes = await API.getStrategyList(userId);
      if (listRes.success && Array.isArray(listRes.data) && listRes.data.length > 0) {
        const defaultStrategy = listRes.data.find(s => s.is_default) || listRes.data[0];
        const detailRes = await API.getStrategyDetail(defaultStrategy.id);

        if (detailRes.success && detailRes.data) {
          const strategy = detailRes.data;
          const symbolIndex = this.data.symbolList.indexOf(strategy.symbol);
          const positionSize = strategy.fund_config && strategy.fund_config.percentage
            ? parseFloat(strategy.fund_config.percentage) / 100
            : 0.4;

          this.setData({
            strategyId: strategy.id,
            config: {
              symbol: strategy.symbol || 'ETH-USDT-SWAP',
              maxPositions: (strategy.risk_control && strategy.risk_control.maxPositions) || 3,
              stopLossPercent: (strategy.sell_strategy && strategy.sell_strategy.stopLossPercent) || 0.2,
              takeProfitPercent: (strategy.sell_strategy && strategy.sell_strategy.takeProfitPercent) || 1.0,
              positionSize: positionSize,
              cooldownSeconds: (strategy.risk_control && strategy.risk_control.cooldownSeconds) || 60
            },
            symbolIndex: symbolIndex >= 0 ? symbolIndex : 0,
            originalConfig: JSON.stringify(strategy)
          });
        }
      }
    } catch (error) {
      console.error('加载默认策略失败:', error);
    }
  },

  /**
   * 加载自动交易状态
   */
  async loadAutoTradingStatus() {
    try {
      const res = await API.getAutoTradingStatus(getCurrentUserId());
      if (res.success && res.data) {
        this.setData({
          autoTradeEnabled: res.data.enabled || false,
          stats: {
            totalTrades: res.data.totalTrades || 0,
            winTrades: res.data.winTrades || 0,
            lossTrades: res.data.lossTrades || 0,
            winRate: (res.data.winRate || 0).toFixed(1)
          }
        });
      }
    } catch (error) {
      console.error('加载自动交易状态失败:', error);
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
   * 交易对变化
   */
  onSymbolChange(e) {
    const index = e.detail.value;
    this.setData({
      symbolIndex: index,
      'config.symbol': this.data.symbolList[index]
    });
  },

  /**
   * 冷却时间变化
   */
  onCooldownChange(e) {
    this.setData({
      'config.cooldownSeconds': e.detail.value
    });
  },

  /**
   * 止盈比例变化
   */
  onTakeProfitChange(e) {
    this.setData({
      'config.takeProfitPercent': e.detail.value / 100
    });
  },

  /**
   * 止损比例变化
   */
  onStopLossChange(e) {
    this.setData({
      'config.stopLossPercent': e.detail.value / 100
    });
  },

  /**
   * 仓位比例变化
   */
  onPositionSizeChange(e) {
    this.setData({
      'config.positionSize': e.detail.value / 100
    });
  },

  /**
   * 最大持仓数变化
   */
  onMaxPositionsChange(e) {
    this.setData({
      'config.maxPositions': e.detail.value
    });
  },

  /**
   * 保存配置
   */
  async saveConfig() {
    if (this.data.saving) return;

    this.setData({ saving: true });

    try {
      if (!this.data.strategyId) {
        throw new Error('未找到默认策略');
      }

      const originalStrategy = this.data.originalConfig ? JSON.parse(this.data.originalConfig) : {};
      const fundConfig = originalStrategy.fund_config || {};

      const res = await API.updateStrategy(this.data.strategyId, {
        strategy: {
          symbol: this.data.config.symbol,
          fund_config: {
            ...fundConfig,
            percentage: Math.round(this.data.config.positionSize * 100)
          },
          sell_strategy: {
            takeProfitPercent: this.data.config.takeProfitPercent,
            stopLossPercent: this.data.config.stopLossPercent
          },
          risk_control: {
            cooldownSeconds: this.data.config.cooldownSeconds,
            maxPositions: this.data.config.maxPositions
          }
        }
      });

      if (res.success) {
        wx.showToast({
          title: '配置已保存',
          icon: 'success'
        });

        // 更新原始配置
        this.setData({
          originalConfig: JSON.stringify({
            ...originalStrategy,
            symbol: this.data.config.symbol,
            fund_config: {
              ...fundConfig,
              percentage: Math.round(this.data.config.positionSize * 100)
            },
            sell_strategy: {
              takeProfitPercent: this.data.config.takeProfitPercent,
              stopLossPercent: this.data.config.stopLossPercent
            },
            risk_control: {
              cooldownSeconds: this.data.config.cooldownSeconds,
              maxPositions: this.data.config.maxPositions
            }
          })
        });
      } else {
        throw new Error(res.error || '保存失败');
      }
    } catch (error) {
      console.error('保存配置失败:', error);
      wx.showToast({
        title: error.message || '保存失败',
        icon: 'none'
      });
    } finally {
      this.setData({ saving: false });
    }
  }
});
