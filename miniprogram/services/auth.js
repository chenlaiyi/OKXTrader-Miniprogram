/**
 * 认证相关API
 */

const BASE_URL = 'https://ly.ddg.org.cn/api';

/**
 * 通用请求方法
 */
function request(url, options = {}) {
  const method = options.method || 'GET';
  let fullUrl = `${BASE_URL}${url}`;

  // 对于 GET 请求，将 data 参数拼接到 URL
  if (method === 'GET' && options.data) {
    const pairs = [];
    for (const key in options.data) {
      if (options.data.hasOwnProperty(key)) {
        pairs.push(`${encodeURIComponent(key)}=${encodeURIComponent(options.data[key])}`);
      }
    }
    if (pairs.length > 0) {
      fullUrl += '?' + pairs.join('&');
    }
  }

  return new Promise((resolve, reject) => {
    // 获取Token
    const token = wx.getStorageSync('token');

    wx.request({
      url: fullUrl,
      method: method,
      data: method === 'GET' ? {} : (options.data || {}),
      header: {
        'content-type': 'application/json',
        'Authorization': token ? `Bearer ${token}` : '',
        ...options.header
      },
      success: (res) => {
        if (res.statusCode === 200) {
          resolve(res.data);
        } else if (res.statusCode === 401) {
          // Token无效，清除本地存储
          wx.removeStorageSync('token');
          wx.removeStorageSync('userInfo');

          // 跳转到登录页
          wx.navigateTo({
            url: '/pages/auth/login/login'
          });

          reject(new Error('请先登录'));
        } else {
          const error = new Error(`HTTP ${res.statusCode}`);
          error.response = res.data;
          reject(error);
        }
      },
      fail: (err) => {
        reject(err);
      }
    });
  });
}

const AuthAPI = {
  /**
   * 微信授权登录
   */
  login(data) {
    return request('/auth/login', {
      method: 'POST',
      data
    });
  },

  /**
   * 获取用户信息
   */
  getUserProfile() {
    return request('/auth/profile', {
      method: 'GET'
    });
  },

  /**
   * 刷新Token
   */
  refreshToken(token) {
    return request('/auth/refresh', {
      method: 'POST',
      data: { token }
    });
  },

  /**
   * 获取OKX账号列表
   */
  getAccounts() {
    return request('/user/accounts', {
      method: 'GET'
    });
  },

  /**
   * 添加OKX账号
   */
  addAccount(accountData) {
    return request('/user/accounts', {
      method: 'POST',
      data: accountData
    });
  },

  /**
   * 更新OKX账号
   */
  updateAccount(accountId, accountData) {
    return request(`/user/accounts/${accountId}`, {
      method: 'PUT',
      data: accountData
    });
  },

  /**
   * 删除OKX账号
   */
  deleteAccount(accountId) {
    return request(`/user/accounts/${accountId}`, {
      method: 'DELETE'
    });
  },

  /**
   * 设置默认账号
   */
  setDefaultAccount(accountId) {
    return request(`/user/accounts/${accountId}/default`, {
      method: 'PATCH'
    });
  },

  /**
   * 验证OKX账号
   */
  verifyAccount(accountId) {
    return request(`/user/accounts/${accountId}/verify`, {
      method: 'POST'
    });
  }
};

module.exports = AuthAPI;
