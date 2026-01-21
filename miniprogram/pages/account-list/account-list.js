// OKX账号列表页面
const API = require('../../services/api.js');

Page({
  data: {
    accounts: [],
    refreshing: false,
    settingDefault: false,
    userInfo: null
  },

  onLoad() {
    this.checkLoginStatus();
  },

  onShow() {
    // 每次显示时刷新账号列表
    this.checkLoginStatus();
  },

  /**
   * 检查登录状态
   */
  checkLoginStatus() {
    const userInfo = wx.getStorageSync('userInfo');
    const token = wx.getStorageSync('token');

    console.log('🔍 检查登录状态:');
    console.log('   - userInfo:', userInfo ? '存在' : '不存在');
    console.log('   - token:', token ? '存在' : '不存在');

    if (userInfo && token) {
      this.setData({ userInfo });
      this.loadAccounts();
    } else {
      console.log('⚠️  未登录，跳转到登录页');
      this.setData({ userInfo: null });

      // 跳转到登录页
      wx.showModal({
        title: '需要登录',
        content: '请先登录后查看账号列表',
        showCancel: false,
        success: () => {
          wx.navigateTo({
            url: '/pages/auth/login/login',
            fail: () => {
              console.log('跳转失败，可能已在登录页');
            }
          });
        }
      });
    }
  },

  /**
   * 加载账号列表
   */
  async loadAccounts() {
    try {
      console.log('📥 加载OKX账号列表...');

      const res = await API.getAccounts();

      if (res.success && res.data) {
        this.setData({
          accounts: res.data
        });

        console.log(`✅ 加载成功，共 ${res.data.length} 个账号`);
      } else {
        throw new Error(res.error || '加载失败');
      }
    } catch (error) {
      console.error('❌ 加载账号列表失败:', error);

      wx.showToast({
        title: error.message || '加载失败',
        icon: 'none'
      });
    }
  },

  /**
   * 下拉刷新
   */
  onRefresh() {
    this.setData({ refreshing: true });

    this.loadAccounts().then(() => {
      this.setData({ refreshing: false });
    });
  },

  /**
   * 点击账号卡片
   */
  onAccountTap(e) {
    const { id } = e.currentTarget.dataset;
    console.log('📋 点击账号:', id);

    // 可以跳转到账号详情页面
    wx.navigateTo({
      url: `/pages/account-detail/account-detail?id=${id}`
    });
  },

  /**
   * 设置默认账号
   */
  async onSetDefault(e) {
    const { id } = e.currentTarget.dataset;

    wx.showModal({
      title: '设置默认账号',
      content: '确定要将此账号设为默认账号吗？',
      success: async (res) => {
        if (res.confirm) {
          try {
            this.setData({ settingDefault: true });

            const res = await API.setDefaultAccount(id);

            if (res.success) {
              wx.showToast({
                title: '设置成功',
                icon: 'success'
              });

              // 重新加载列表
              await this.loadAccounts();
            } else {
              throw new Error(res.error || '设置失败');
            }
          } catch (error) {
            console.error('❌ 设置默认账号失败:', error);

            wx.showToast({
              title: error.message || '设置失败',
              icon: 'none'
            });
          } finally {
            this.setData({ settingDefault: false });
          }
        }
      }
    });
  },

  /**
   * 编辑账号
   */
  onEdit(e) {
    const { id } = e.currentTarget.dataset;

    wx.navigateTo({
      url: `/pages/account-edit/account-edit?id=${id}`
    });
  },

  /**
   * 编辑账号（新方法，传递完整账号信息）
   */
  onEditAccount(e) {
    const { account } = e.currentTarget.dataset;
    console.log('✏️ 编辑账号:', account);

    // 将账号信息转换为JSON字符串传递
    const accountJson = JSON.stringify(account);
    wx.navigateTo({
      url: `/pages/account-add/account-add?account=${encodeURIComponent(accountJson)}`
    });
  },

  /**
   * 切换账号状态
   */
  async onToggleActive(e) {
    const { id, active } = e.currentTarget.dataset;
    const action = active ? '禁用' : '启用';

    wx.showModal({
      title: `${action}账号`,
      content: `确定要${action}此账号吗？`,
      success: async (res) => {
        if (res.confirm) {
          try {
            const res = await API.updateAccount(id, {
              isActive: !active
            });

            if (res.success) {
              wx.showToast({
                title: `${action}成功`,
                icon: 'success'
              });

              await this.loadAccounts();
            } else {
              throw new Error(res.error || '操作失败');
            }
          } catch (error) {
            console.error('❌ 切换账号状态失败:', error);

            wx.showToast({
              title: error.message || '操作失败',
              icon: 'none'
            });
          }
        }
      }
    });
  },

  /**
   * 删除账号
   */
  onDelete(e) {
    const { id } = e.currentTarget.dataset;
    const account = this.data.accounts.find(a => a.id === id);

    wx.showModal({
      title: '删除账号',
      content: `确定要删除账号"${account.accountName}"吗？此操作不可恢复。`,
      confirmColor: '#ff3b30',
      success: async (res) => {
        if (res.confirm) {
          try {
            const deleteRes = await API.deleteAccount(id);

            if (deleteRes.success) {
              wx.showToast({
                title: '删除成功',
                icon: 'success'
              });

              // 重新加载列表
              await this.loadAccounts();
            } else {
              throw new Error(deleteRes.error || '删除失败');
            }
          } catch (error) {
            console.error('❌ 删除账号失败:', error);

            wx.showToast({
              title: error.message || '删除失败',
              icon: 'none'
            });
          }
        }
      }
    });
  },

  /**
   * 添加账号
   */
  onAddAccount() {
    wx.navigateTo({
      url: '/pages/account-add/account-add'
    });
  }
});
