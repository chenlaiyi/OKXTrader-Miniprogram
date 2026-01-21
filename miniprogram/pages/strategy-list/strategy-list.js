const API = require('../../services/api.js');

const FALLBACK_USER_ID = 'default';

function getCurrentUserId() {
  const userInfo = wx.getStorageSync('userInfo');
  return (userInfo && userInfo.id) ? userInfo.id : FALLBACK_USER_ID;
}

function inferStrategyType(name) {
  return 'sar';
}

function getStrategyTypeLabel(type) {
  const map = {
    sar: 'SAR'
  };
  return map[type] || 'SAR';
}

Page({
  data: {
    loading: true,
    strategyList: []
  },

  onLoad() {
    this.loadStrategyList();
  },

  onShow() {
    this.loadStrategyList();
  },

  async loadStrategyList() {
    this.setData({ loading: true });
    try {
      const res = await API.getStrategyList(getCurrentUserId());
      if (res.success && Array.isArray(res.data)) {
        const strategies = res.data.map(item => ({
          id: item.id,
          name: item.name,
          description: item.description,
          isEnabled: item.is_enabled,
          isDefault: item.is_default,
          strategyType: item.strategy_type || inferStrategyType(item.name),
          strategyTypeLabel: getStrategyTypeLabel(item.strategy_type || inferStrategyType(item.name)),
          performance: item.performance || {
            totalTrades: 0,
            winTrades: 0,
            lossTrades: 0,
            winRate: 0
          }
        }));
        this.setData({ strategyList: strategies });
      }
    } catch (error) {
      console.error('加载策略列表失败:', error);
      wx.showToast({
        title: '加载策略失败',
        icon: 'none'
      });
    } finally {
      this.setData({ loading: false });
    }
  },

  createNewStrategy() {
    wx.navigateTo({
      url: '/pages/strategy-edit/strategy-edit?mode=create&template=sar'
    });
  },

  editStrategy(e) {
    const strategy = e.currentTarget.dataset.strategy;
    wx.navigateTo({
      url: `/pages/strategy-edit/strategy-edit?strategyId=${strategy.id}`
    });
  },

  async toggleStrategyEnabled(e) {
    const strategy = e.currentTarget.dataset.strategy;
    const newState = !strategy.isEnabled;

    if (newState) {
      const hasOtherEnabled = (this.data.strategyList || []).some(item => item.id !== strategy.id && item.isEnabled);
      if (hasOtherEnabled) {
        const confirmed = await new Promise(resolve => {
          wx.showModal({
            title: '只能启用一个策略',
            content: '启用该策略后将自动禁用其他已启用的策略，是否继续？',
            confirmText: '继续',
            cancelText: '取消',
            success: (res) => resolve(res.confirm)
          });
        });
        if (!confirmed) {
          return;
        }
      }
    }

    wx.showLoading({ title: newState ? '启用中...' : '禁用中...' });
    try {
      const res = await API.toggleStrategy(strategy.id, newState);
      if (res.success) {
        wx.showToast({
          title: newState ? '已启用' : '已禁用',
          icon: 'success'
        });
        await this.loadStrategyList();
      } else {
        throw new Error(res.error || '操作失败');
      }
    } catch (error) {
      console.error('切换策略状态失败:', error);
      wx.showToast({
        title: error.message || '操作失败',
        icon: 'none'
      });
    } finally {
      wx.hideLoading();
    }
  },

  async deleteStrategy(e) {
    const strategy = e.currentTarget.dataset.strategy;
    if (strategy.isDefault) {
      wx.showToast({
        title: '不能删除默认策略',
        icon: 'none'
      });
      return;
    }

    const confirmed = await new Promise((resolve) => {
      wx.showModal({
        title: '确认删除',
        content: `确定要删除策略「${strategy.name}」吗？此操作不可恢复。`,
        success: (res) => resolve(res.confirm)
      });
    });

    if (!confirmed) return;

    wx.showLoading({ title: '删除中...' });
    try {
      const res = await API.deleteStrategy(strategy.id);
      if (res.success) {
        wx.showToast({
          title: '删除成功',
          icon: 'success'
        });
        await this.loadStrategyList();
      } else {
        throw new Error(res.error || '删除失败');
      }
    } catch (error) {
      console.error('删除策略失败:', error);
      wx.showToast({
        title: error.message || '删除失败',
        icon: 'none'
      });
    } finally {
      wx.hideLoading();
    }
  }
});
