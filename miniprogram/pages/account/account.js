// pages/account/account.js
const API = require('../../services/api.js');

Page({
  data: {
    loading: true,
    refreshing: false,
    // ✅ 用户信息
    userInfo: null,
    accountCount: 0,
    // 账号列表
    accounts: [],
    // 当前账号
    currentAccount: {
      id: '',
      name: '未选择',
      isSimulation: true
    },
    accountInfo: {
      uid: '--',
      level: '--',
      totalEquity: '0.00'
    },
    // 资产列表
    balances: [],
    // 持仓列表
    positions: [],
    // 刷新状态
    isRefreshing: false
  },

  onLoad() {
    this.checkLoginStatus();
    this.initData();
  },

  onShow() {
    // 页面显示时刷新数据和检查登录状态
    if (!this.data.loading) {
      this.checkLoginStatus();  // ✅ 重新检查登录状态
      this.refreshAll();
    }
  },

  /**
   * 检查登录状态
   */
  async checkLoginStatus() {
    const userInfo = wx.getStorageSync('userInfo');
    const token = wx.getStorageSync('token');

    console.log('🔍 检查登录状态:');
    console.log('  - token存在:', !!token);
    console.log('  - userInfo存在:', !!userInfo);
    if (userInfo) {
      console.log('  - userInfo.id:', userInfo.id);
      console.log('  - userInfo.nickname:', userInfo.nickname);
      console.log('  - userInfo.dbUserId:', userInfo.dbUserId);
    }

    // ✅ 放宽验证条件:只要有token和userInfo.id就认为已登录
    // nickname可能为空(老用户数据),但不应阻止显示
    if (userInfo && token && userInfo.id) {
      console.log('✅ 用户已登录:', userInfo.nickname || '未知用户');

      // 如果没有nickname,设置一个默认值
      if (!userInfo.nickname) {
        userInfo.nickname = '用户';
      }

      // 设置初始显示ID（如果还没有的话）
      if (!userInfo.userIdDisplay) {
        if (userInfo.dbUserId) {
          userInfo.userIdDisplay = userInfo.dbUserId.toString();
        } else if (userInfo.id) {
          // 临时使用UUID的前6位，等loadAccounts()后会更新为真实ID
          userInfo.userIdDisplay = userInfo.id.substring(0, 6) + '...';
        }
        wx.setStorageSync('userInfo', userInfo);
      }

      // ✅ 无论如何都要更新页面数据
      this.setData({ userInfo });

      // 获取用户的OKX账号（会从服务器返回userDbId）
      await this.loadAccounts();
    } else {
      console.log('📝 未登录或信息不完整，显示登录按钮');
      if (userInfo) {
        console.log('  - userInfo完整内容:', userInfo);
      }
      this.setData({ userInfo: null });
    }
  },

  /**
   * 加载OKX账号列表
   */
  async loadAccounts() {
    try {
      const res = await API.getAccounts();

      if (res.success && res.data) {
        this.setData({
          accounts: res.data,
          accountCount: res.data.length
        });

        // ✅ 从响应中获取userDbId并更新用户信息
        if (res.userDbId) {
          const userInfo = wx.getStorageSync('userInfo');
          if (userInfo && userInfo.dbUserId !== res.userDbId) {
            userInfo.dbUserId = res.userDbId;
            userInfo.userIdDisplay = res.userDbId.toString();
            wx.setStorageSync('userInfo', userInfo);
            this.setData({ userInfo });
            console.log('✅ 从账号列表更新用户ID:', res.userDbId);
          }
        }

        // 设置当前账号（选择默认账号或第一个）
        const defaultAccount = res.data.find(acc => acc.isDefault) || res.data[0];
        if (defaultAccount) {
          this.setData({
            currentAccount: {
              id: defaultAccount.id,
              name: defaultAccount.accountName,
              isSimulation: defaultAccount.accountType === 'simulation'
          }
          });

          // ✅ 保存当前账号到本地存储,供其他页面使用
          wx.setStorageSync('currentAccount', {
            id: defaultAccount.id,
            name: defaultAccount.accountName,
            isSimulation: defaultAccount.accountType === 'simulation'
          });
          console.log('✅ 已保存默认账号到本地存储:', defaultAccount.id);

          // 加载账号信息
          await this.loadAccountInfo(defaultAccount.id);
        }
      }
    } catch (error) {
      console.error('❌ 加载账号列表失败:', error);
    }
  },

  /**
   * 前往登录页面
   */
  goToLogin() {
    wx.navigateTo({
      url: '/pages/auth/login/login'
    });
  },

  /**
   * 前往账号列表页面
   */
  goToAccountList() {
    wx.navigateTo({
      url: '/pages/account-list/account-list'
    });
  },

  /**
   * 前往添加账号页面
   */
  goToAddAccount() {
    wx.navigateTo({
      url: '/pages/account-add/account-add'
    });
  },

  /**
   * 退出登录
   */
  handleLogout() {
    wx.showModal({
      title: '退出登录',
      content: '确定要退出登录吗？',
      success: (res) => {
        if (res.confirm) {
          // 清除本地存储
          wx.removeStorageSync('token');
          wx.removeStorageSync('userInfo');

          this.setData({
            userInfo: null,
            accounts: [],
            currentAccount: {
              id: '',
              name: '未选择',
              isSimulation: true
            }
          });

          wx.showToast({
            title: '已退出登录',
            icon: 'success'
          });
        }
      }
    });
  },

  /**
   * 初始化数据
   */
  async initData() {
    this.setData({ loading: true });

    try {
      // 加载账号信息（会自动加载该账号的资产、持仓和交易数据）
      await this.loadAccountInfo();
    } catch (error) {
      console.error('加载账户数据失败:', error);
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      });
    } finally {
      this.setData({ loading: false });
    }
  },

  /**
   * 加载账户信息
   */
  async loadAccountInfo(accountId) {
    try {
      const res = await API.getAccounts();
      console.log('账户数据:', res);

      if (res.success && res.data && res.data.length > 0) {
        const accounts = res.data;

        // 如果指定了accountId，使用该账号；否则使用默认账号或第一个
        const targetAccount = accountId
          ? accounts.find(a => a.id === accountId)
          : (accounts.find(a => a.isDefault) || accounts[0]);

        if (!targetAccount) {
          console.warn('未找到目标账号');
          return;
        }

        this.setData({
          accounts: accounts,
          accountCount: accounts.length,
          currentAccount: {
            id: targetAccount.id,
            name: targetAccount.accountName,
            isSimulation: targetAccount.accountType === 'simulation'
          },
          'accountInfo.uid': targetAccount.id ? targetAccount.id.substring(0, 8) + '...' : '--',
          'accountInfo.level': targetAccount.accountType === 'simulation' ? '模拟' : '实盘'
        });

        // ✅ 保存当前账号到本地存储,供其他页面使用
        wx.setStorageSync('currentAccount', {
          id: targetAccount.id,
          name: targetAccount.accountName,
          isSimulation: targetAccount.accountType === 'simulation'
        });
        console.log('✅ 已保存当前账号到本地存储:', targetAccount.id);

        // 加载该账号的资产和持仓数据
        await Promise.all([
          this.loadBalances(targetAccount.id),
          this.loadPositions(targetAccount.id)
        ]);
      }
    } catch (error) {
      console.error('加载账户信息失败:', error);
    }
  },

  /**
   * 加载资产列表
   */
  async loadBalances(accountId) {
    try {
      const res = await API.getBalance(accountId);

      if (res.success && res.data && res.data.details) {
        const balances = res.data.details
          .filter(b => parseFloat(b.bal) > 0)
          .map(b => ({
            currency: b.ccy,
            totalDisplay: parseFloat(b.bal).toFixed(4),
            usdValueDisplay: (parseFloat(b.bal) * (b.eqUsd ? parseFloat(b.eqUsd) / parseFloat(b.bal) : 1)).toFixed(2)
          }));

        this.setData({
          balances,
          'accountInfo.totalEquity': parseFloat(res.data.total_equity).toFixed(2)
        });
      }
    } catch (error) {
      console.error('加载资产失败:', error);
      // 使用模拟数据
      this.setData({
        balances: [
          { currency: 'USDT', totalDisplay: '10000.00', usdValueDisplay: '10000.00' }
        ]
      });
    }
  },

  /**
   * 刷新资产
   */
  async refreshAssets() {
    wx.showLoading({ title: '刷新中...' });
    await this.loadBalances(this.data.currentAccount.id);
    wx.hideLoading();
    wx.showToast({ title: '刷新成功', icon: 'success' });
  },

  /**
   * 加载持仓数据
   */
  async loadPositions(accountId) {
    try {
      const res = await API.getPositions(accountId ? { accountId } : {});

      if (res.success) {
        this.setData({
          positions: res.data || []
        });
      }
    } catch (error) {
      console.error('加载持仓失败:', error);
      this.setData({
        positions: []
      });
    }
  },

  /**
   * 显示账号选择器
   */
  showAccountActionSheet() {
    if (this.data.accounts.length <= 1) {
      wx.showToast({
        title: '只有一个账号',
        icon: 'none'
      });
      return;
    }

    const accountNames = this.data.accounts.map(acc => acc.accountName);

    wx.showActionSheet({
      itemList: accountNames,
      success: (res) => {
        const selectedAccount = this.data.accounts[res.tapIndex];
        this.switchAccount(selectedAccount);
      }
    });
  },

  /**
   * 切换账号
   */
  async switchAccount(account) {
    if (!account || account.id === this.data.currentAccount.id) {
      return;
    }

    try {
      wx.showLoading({ title: '切换中...' });

      // 更新当前账号
      this.setData({
        currentAccount: {
          id: account.id,
          name: account.accountName,
          isSimulation: account.accountType === 'simulation'
        },
        'accountInfo.uid': account.id ? account.id.substring(0, 8) + '...' : '--',
        'accountInfo.level': account.accountType === 'simulation' ? '模拟' : '实盘'
      });

      // ✅ 保存当前账号到本地存储,供其他页面使用
      wx.setStorageSync('currentAccount', {
        id: account.id,
        name: account.accountName,
        isSimulation: account.accountType === 'simulation'
      });
      console.log('✅ 已保存当前账号到本地存储:', account.id);

      // 重新加载该账号的数据
      await Promise.all([
        this.loadBalances(account.id),
        this.loadPositions(account.id)
      ]);

      wx.hideLoading();
      wx.showToast({
        title: '已切换账号',
        icon: 'success'
      });
    } catch (error) {
      wx.hideLoading();
      console.error('切换账号失败:', error);
      wx.showToast({
        title: '切换失败',
        icon: 'none'
      });
    }
  },

  /**
   * 刷新所有数据
   */
  async refreshAll() {
    this.setData({ refreshing: true });

    try {
      await Promise.all([
        this.loadAccountInfo(this.data.currentAccount.id),
        this.loadBalances(this.data.currentAccount.id)
      ]);

      wx.showToast({
        title: '刷新成功',
        icon: 'success'
      });
    } catch (error) {
      console.error('刷新失败:', error);
    } finally {
      this.setData({ refreshing: false });
    }
  },

  /**
   * 下拉刷新
   */
  onPullDownRefresh() {
    this.refreshAll().finally(() => {
      wx.stopPullDownRefresh();
    });
  },

  /**
   * 跳转到交易监控（交易页面）
   */
  goToMonitor() {
    wx.switchTab({
      url: '/pages/trading/trading'
    });
  },

  /**
   * 跳转到策略管理（策略配置页面）
   */
  goToStrategy() {
    wx.navigateTo({
      url: '/pages/strategy-list/strategy-list'
    });
  },

  /**
   * 格式化时间
   */
  formatTime(timestamp) {
    if (!timestamp) return '--';

    const date = new Date(parseInt(timestamp));
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const hour = date.getHours().toString().padStart(2, '0');
    const minute = date.getMinutes().toString().padStart(2, '0');

    return `${month}-${day} ${hour}:${minute}`;
  }
});
