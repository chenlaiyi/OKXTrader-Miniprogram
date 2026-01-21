// 登录页面
const API = require('../../../services/api.js');

Page({
  data: {
    loading: false,
    userInfo: null,
    accountCount: 0,
    tempAvatarUrl: '',  // 临时头像
    tempNickname: ''   // 临时昵称
  },

  onLoad() {
    this.checkLoginStatus();
  },

  onShow() {
    // 每次显示时检查登录状态
    this.checkLoginStatus();
  },

  /**
   * 检查登录状态
   */
  async checkLoginStatus() {
    const token = wx.getStorageSync('token');
    const userInfo = wx.getStorageSync('userInfo');

    if (!token) {
      console.log('📝 未登录：没有token');
      return;
    }

    if (userInfo && userInfo.id) {
      console.log('✅ 已登录，自动跳转到账户页面...', userInfo.nickname);

      // 直接跳转到账户页面（使用 tabBar）
      wx.switchTab({
        url: '/pages/account/account'
      });
      return;
    }

    console.log('📝 用户信息不完整，需要重新登录');
    console.log('userInfo:', userInfo);

    // 清除不完整的数据
    wx.removeStorageSync('token');
    wx.removeStorageSync('userInfo');
    this.setData({ userInfo: null });
  },

  /**
   * 获取用户信息
   */
  async getUserProfile() {
    try {
      const res = await API.getUserProfile();

      if (res.success && res.data) {
        this.setData({
          userInfo: {
            id: res.data.id,
            nickname: res.data.nickname,
            avatarUrl: res.data.avatarUrl
          },
          accountCount: res.data.accountCount || 0
        });

        console.log('✅ 用户信息:', this.data.userInfo);
      }
    } catch (error) {
      console.error('❌ 获取用户信息失败:', error);

      // Token可能已过期，清除本地存储
      wx.removeStorageSync('token');
      wx.removeStorageSync('userInfo');
      this.setData({ userInfo: null });
    }
  },

  /**
   * 处理登录
   */
  async handleLogin() {
    if (this.data.loading) return;

    this.setData({ loading: true });

    try {
      console.log('🔄 开始登录流程...');

      // 1. 调用微信登录获取code
      const loginRes = await this.getWechatLoginCode();

      if (!loginRes.code) {
        wx.showToast({
          title: '微信登录失败',
          icon: 'none'
        });
        this.setData({ loading: false });
        return;
      }

      console.log('✅ 获取code成功');

      // 2. 先调用后端登录（不传userInfo），后端会返回用户信息和isNewUser标识
      let authRes = await API.login({
        code: loginRes.code
      });

      if (!authRes.success) {
        throw new Error(authRes.error || '登录失败');
      }

      const { token, user } = authRes.data;

      console.log('📋 后端返回用户信息:', user);
      console.log('🆕 是否新用户:', user.isNewUser);

      // 3. 如果是新用户，需要获取头像昵称
      if (user.isNewUser) {
        console.log('🆕 新用户，需要获取头像昵称');

        // 先检查用户是否已经输入了昵称
        if (!this.data.tempNickname) {
          this.setData({ loading: false });
          wx.showModal({
            title: '完善信息',
            content: '请设置您的昵称',
            showCancel: false,
            success: (res) => {
              // 用户点击确定后，引导获取用户信息
              this.getUserInfo();
            }
          });
          return;
        }

        // 调用后端登录接口，传入userInfo
        authRes = await API.login({
          code: loginRes.code,
          userInfo: {
            nickName: this.data.tempNickname,
            avatarUrl: this.data.tempAvatarUrl || ''
          }
        });

        if (!authRes.success) {
          throw new Error(authRes.error || '登录失败');
        }

        const { user: updatedUser } = authRes.data;
        wx.setStorageSync('userInfo', updatedUser);
      } else {
        console.log('👤 老用户，直接使用数据库中的信息');
        // 老用户，直接保存用户信息（后端已返回完整信息）
        wx.setStorageSync('userInfo', user);
      }

      // 4. 保存Token
      wx.setStorageSync('token', token);

      this.setData({
        userInfo: user,
        loading: false,
        tempAvatarUrl: '',
        tempNickname: ''
      });

      console.log('✅ 登录成功:', user);

      wx.showToast({
        title: user.isNewUser ? '欢迎新用户' : '登录成功',
        icon: 'success'
      });

      // 延迟跳转到账户页面
      setTimeout(() => {
        wx.switchTab({
          url: '/pages/account/account'
        });
      }, 1500);
    } catch (error) {
      console.error('❌ 登录失败:', error);

      wx.showToast({
        title: error.message || '登录失败',
        icon: 'none'
      });

      this.setData({ loading: false });
    }
  },

  /**
   * 获取用户信息（新用户）
   */
  getUserInfo() {
    wx.getUserProfile({
      desc: '用于完善个人资料',
      success: (res) => {
        console.log('✅ 获取用户信息成功:', res);
        const { userInfo } = res;

        this.setData({
          tempNickname: userInfo.nickName || '',
          tempAvatarUrl: userInfo.avatarUrl || ''
        });

        // 重新调用登录
        this.handleLogin();
      },
      fail: (err) => {
        console.error('❌ 获取用户信息失败:', err);
        wx.showToast({
          title: '获取用户信息失败',
          icon: 'none'
        });
        this.setData({ loading: false });
      }
    });
  },

  /**
   * 选择头像
   */
  onChooseAvatar(e) {
    console.log('✅ 选择头像:', e.detail);

    const { avatarUrl } = e.detail;
    this.setData({
      tempAvatarUrl: avatarUrl
    });
  },

  /**
   * 输入昵称
   */
  onNicknameInput(e) {
    this.setData({
      tempNickname: e.detail.value
    });
  },

  /**
   * 微信登录获取code
   */

  /**
   * 微信登录获取code
   */
  getWechatLoginCode() {
    return new Promise((resolve) => {
      wx.login({
        success: (res) => {
          if (res.code) {
            resolve({ code: res.code });
          } else {
            console.error('❌ wx.login失败:', res.errMsg);
            resolve({});
          }
        },
        fail: (err) => {
          console.error('❌ wx.login失败:', err);
          resolve({});
        }
      });
    });
  },

  /**
   * 处理退出登录
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
            accountCount: 0
          });

          console.log('✅ 已退出登录');

          wx.showToast({
            title: '已退出登录',
            icon: 'success'
          });
        }
      }
    });
  }
});
