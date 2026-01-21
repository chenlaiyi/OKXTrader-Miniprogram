// services/api.js
// API服务层 - 封装所有HTTP请求

const BASE_URL = 'https://ly.ddg.org.cn/api';

/**
 * 简单缓存对象（减少重复请求）
 */
const apiCache = {
  data: {},
  get(key) {
    const item = this.data[key];
    if (item && Date.now() < item.expire) {
      console.log('♻️ 使用缓存数据:', key);
      return item.data;
    }
    return null;
  },
  set(key, data, ttl = 10000) {
    this.data[key] = {
      data,
      expire: Date.now() + ttl
    };
  },
  clear(pattern) {
    if (pattern) {
      Object.keys(this.data).forEach(key => {
        if (key.includes(pattern)) {
          delete this.data[key];
        }
      });
    } else {
      this.data = {};
    }
  }
};

/**
 * 通用请求方法
 */
/**
 * 构建查询字符串（小程序兼容）
 */
function buildQueryString(params) {
  if (!params) return '';
  const pairs = [];
  for (const key in params) {
    if (params.hasOwnProperty(key)) {
      const value = params[key];
      if (value === undefined || value === null || value === '') {
        continue;
      }
      pairs.push(`${encodeURIComponent(key)}=${encodeURIComponent(value)}`);
    }
  }
  return pairs.length > 0 ? '?' + pairs.join('&') : '';
}

/**
 * 通用请求方法（带重试机制）
 */
function request(url, options = {}, retryCount = 0) {
  const method = options.method || 'GET';
  let fullUrl = `${BASE_URL}${url}`;

  // 对于 GET 请求，将 data 参数拼接到 URL
  if (method === 'GET' && options.data) {
    const queryString = buildQueryString(options.data);
    fullUrl += queryString;
  }

  // 生成缓存键
  const cacheKey = method + ':' + fullUrl;

  // 如果是GET请求，尝试从缓存读取（AI分析等耗时请求）
  if (method === 'GET' && !options.skipCache) {
    const cachedData = apiCache.get(cacheKey);
    if (cachedData) {
      return Promise.resolve(cachedData);
    }
  }

  console.log('🔵 API请求:', {
    url: fullUrl,
    method: method,
    data: options.data,
    retryCount
  });

  // 获取Token
  const token = wx.getStorageSync('token');

  return new Promise((resolve, reject) => {
    console.log('📤 准备调用wx.request...');

    wx.request({
      url: fullUrl,
      method: method,
      data: method === 'GET' ? {} : (options.data || {}),
      timeout: options.timeout || 60000,  // 默认60秒超时，AI分析可能需要更长时间
      header: {
        'content-type': 'application/json',
        'Authorization': token ? `Bearer ${token}` : '',
        ...options.header
      },
      success: (res) => {
        console.log('🟢 API响应成功:', {
          url: fullUrl,
          statusCode: res.statusCode,
          success: res.data && res.data.success,
          dataLength: (res.data && res.data.data && res.data.data.length) || 0
        });

        if (res.statusCode === 200) {
          // GET请求成功后保存到缓存（10秒TTL）
          if (method === 'GET' && res.data && !options.skipCache) {
            apiCache.set(cacheKey, res.data, 10000); // 缓存10秒
          }
          resolve(res.data);
        } else if (res.statusCode === 401) {
          // Token无效，清除本地存储并跳转到登录页
          console.warn('⚠️  Token无效，跳转到登录页');
          wx.removeStorageSync('token');
          wx.removeStorageSync('userInfo');

          // 跳转到登录页
          wx.navigateTo({
            url: '/pages/auth/login/login',
            fail: () => {
              // 如果跳转失败，可能是已经在登录页
              console.log('已在登录页，无需跳转');
            }
          });

          const error = new Error('请先登录');
          reject(error);
        } else {
          const serverMessage = (res.data && (res.data.error || res.data.message)) ? (res.data.error || res.data.message) : '';
          const errorMessage = serverMessage || `HTTP ${res.statusCode}`;
          const error = new Error(errorMessage);
          error.statusCode = res.statusCode;
          error.response = res.data;
          console.error('🔴 API错误:', error);
          reject(error);
        }
      },
      fail: (err) => {
        console.error('🔴 wx.request失败:', {
          url: fullUrl,
          errMsg: err.errMsg,
          error: err,
          retryCount
        });

        // 超时错误自动重试（最多2次）
        if (err.errMsg && err.errMsg.includes('timeout') && retryCount < 2) {
          console.log(`🔄 请求超时，自动重试 (${retryCount + 1}/2)...`);
          setTimeout(() => {
            request(url, options, retryCount + 1)
              .then(resolve)
              .catch(reject);
          }, 1000); // 延迟1秒后重试
        } else {
          reject(err);
        }
      },
      complete: () => {
        console.log('✅ wx.request完成');
      }
    });

    console.log('📥 wx.request已调用');
  });
}

/**
 * API服务对象
 */
const API = {
  // ==================== 行情相关 ====================

  /**
   * 获取市场行情列表
   * @param {String} instType - 产品类型 SPOT/SWAP
   */
  getMarkets(instType = 'SWAP') {
    return request('/markets', {
      method: 'GET',
      data: { instType }
    });
  },

  /**
   * 获取K线数据
   * @param {String} symbol - 交易对 如 'ETH-USDT-SWAP'
   * @param {String} bar - 周期 如 '1m', '5m', '15m', '1H', '1D'
   * @param {Number} limit - 数据条数 默认100
   */
  getCandles(symbol, bar = '5m', limit = 100) {
    return request('/markets/candles', {
      method: 'GET',
      data: { symbol, bar, limit }
    });
  },

  /**
   * 获取技术指标
   * @param {String} symbol - 交易对
   */
  getIndicators(symbol) {
    return request('/markets/indicators', {
      method: 'GET',
      data: { symbol }
    });
  },

  // ==================== 账户相关 ====================

  /**
   * 获取账号列表
   * 用户ID从JWT token中自动获取
   */
  getAccounts() {
    return request('/accounts', {
      method: 'GET'
    });
  },

  /**
   * 添加新账号
   */
  addAccount(accountData) {
    return request('/accounts', {
      method: 'POST',
      data: accountData
    });
  },

  /**
   * 验证账号
   */
  validateAccount(validateData) {
    return request('/accounts/validate', {
      method: 'POST',
      data: validateData
    });
  },

  /**
   * 设置默认账号
   */
  setDefaultAccount(data) {
    return request('/accounts/default', {
      method: 'POST',
      data: data
    });
  },

  /**
   * 删除账号
   */
  deleteAccount(data) {
    return request('/accounts/delete', {
      method: 'POST',
      data: data
    });
  },

  // ==================== 交易相关 ====================

  /**
   * 获取账户余额
   * @param {String|Object} accountId - 账号ID 或 { userId, accountId }
   */
  getBalance(accountId) {
    const data = (accountId && typeof accountId === 'object') ? accountId : { accountId };
    return request('/trading/account/balance', {
      method: 'GET',
      data
    });
  },

  /**
   * 获取持仓列表
   * @param {String|Object} accountId - 账号ID 或 { userId, accountId }
   */
  getPositions(accountId) {
    const data = (accountId && typeof accountId === 'object') ? accountId : { accountId };
    return request('/trading/positions', {
      method: 'GET',
      data
    });
  },

  /**
   * 获取交易历史
   * @param {String} accountId - 账号ID
   * @param {Number} limit - 条数
   */
  getTradeHistory(accountId, limit = 50) {
    return request('/trading/trades', {
      method: 'GET',
      data: { accountId, limit }
    });
  },

  /**
   * 获取OKX成交记录
   * @param {String} accountId - 账号ID
   * @param {Number} limit - 条数
   */
  getFills(accountId, limit = 50) {
    return request('/trading/fills', {
      method: 'GET',
      data: { accountId, instType: 'SWAP', limit }
    });
  },

  /**
   * 执行交易
   */
  executeTrade(tradeData) {
    return request('/trading/trade', {
      method: 'POST',
      data: tradeData
    });
  },

  /**
   * 平仓
   */
  closePosition(closeData) {
    return request('/trading/positions/close', {
      method: 'POST',
      data: closeData
    });
  },

  /**
   * 获取最新AI分析
   * @param {String} symbol - 交易对
   * @param {Number} limit - 条数
   * @param {Boolean} force - 是否强制刷新
   */
  getLatestAnalysis(symbol = 'ETH-USDT-SWAP', limit = 1, force = false, userId) {
    const data = { symbol, limit, force: force ? 'true' : 'false' };
    if (userId) {
      data.userId = userId;
    }
    return request('/ai/analysis/latest', {
      method: 'GET',
      data: data
    });
  },

  /**
   * 获取AI分析历史
   * @param {String} symbol - 交易对
   * @param {Number} limit - 条数
   */
  getAnalysisHistory(symbol, limit = 20, userId) {
    const data = { symbol, limit };
    if (userId) {
      data.userId = userId;
    }
    return request('/ai/analysis/history', {
      method: 'GET',
      data: data
    });
  },

  // ==================== 策略相关 ====================

  /**
   * 获取策略列表
   * @param {String} userId - 用户ID
   */
  getStrategies(userId) {
    return request('/strategy', {
      method: 'GET',
      data: { userId }
    });
  },

  /**
   * 获取策略配置（完整配置）
   * @param {String} userId - 用户ID
   */
  getStrategyConfig(userId) {
    return request('/strategy/config', {
      method: 'GET',
      data: { userId }
    });
  },

  /**
   * 获取策略列表
   * @param {String} userId - 用户ID
   */
  getStrategyList(userId) {
    return request('/strategy', {
      method: 'GET',
      data: { userId }
    });
  },

  /**
   * 获取单个策略详情
   * @param {String} strategyId - 策略ID
   */
  getStrategyDetail(strategyId) {
    return request(`/strategy/${strategyId}`, {
      method: 'GET'
    });
  },

  /**
   * 创建策略
   * @param {Object} data - { userId, strategy }
   */
  createStrategy(data) {
    return request('/strategy', {
      method: 'POST',
      data: data
    });
  },

  /**
   * 更新策略
   * @param {String} strategyId - 策略ID
   * @param {Object} data - { strategy }
   */
  updateStrategy(strategyId, data) {
    return request(`/strategy/${strategyId}`, {
      method: 'PUT',
      data: data
    });
  },

  /**
   * 删除策略
   * @param {String} strategyId - 策略ID
   */
  deleteStrategy(strategyId) {
    return request(`/strategy/${strategyId}`, {
      method: 'DELETE'
    });
  },

  /**
   * 启用/禁用策略
   * @param {String} strategyId - 策略ID
   * @param {Boolean} enabled - 是否启用
   */
  toggleStrategy(strategyId, enabled) {
    return request(`/strategy/${strategyId}/enable`, {
      method: 'PATCH',
      data: { enabled }
    });
  },

  /**
   * 设置默认策略
   * @param {String} strategyId - 策略ID
   */
  setDefaultStrategy(strategyId) {
    return request(`/strategy/${strategyId}/set-default`, {
      method: 'PATCH'
    });
  },

  /**
   * 保存策略配置
   * @param {Object} data - { userId, config }
   */
  saveStrategyConfig(data) {
    return request('/strategy/config', {
      method: 'POST',
      data: data
    });
  },

  // ==================== 自动交易相关 ====================

  /**
   * 获取自动交易状态
   * @param {String} userId - 用户ID
   */
  getAutoTradingStatus(userId) {
    return request('/autotrading/status', {
      method: 'GET',
      data: { userId }
    });
  },

  /**
   * 启停自动交易
   */
  toggleAutoTrading(toggleData) {
    return request('/autotrading/toggle', {
      method: 'POST',
      data: toggleData
    });
  },

  /**
   * 启停自动分析
   */
  toggleAutoAnalysis(toggleData) {
    return request('/autotrading/toggle-analysis', {
      method: 'POST',
      data: toggleData
    });
  },

  /**
   * 获取自动交易配置
   * @param {String} userId - 用户ID
   */
  getAutoTradingConfig(userId) {
    return request('/autotrading/config', {
      method: 'GET',
      data: { userId }
    });
  },

  /**
   * 更新自动交易配置
   * @param {Object} data - { userId, config }
   */
  updateAutoTradingConfig(data) {
    return request('/autotrading/config', {
      method: 'PUT',
      data: data
    });
  },

  // ==================== 认证相关 ====================

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
   * 获取当前用户信息（包含dbUserId）
   */
  getCurrentUser() {
    return request('/auth/me', {
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

  // ==================== 新闻公告相关 ====================

  /**
   * 获取OKX公告列表
   * @param {String} type - 公告类型（可选）
   * @param {Number} page - 页码，默认1
   * @param {Number} limit - 每页数量，默认5
   */
  getNews(type, page = 1, limit = 5) {
    const data = { page, limit };
    if (type) {
      data.type = type;
    }
    return request('/news', {
      method: 'GET',
      data: data,
      skipCache: true  // 新闻不使用客户端缓存
    });
  },

  /**
   * 获取公告类型列表
   */
  getNewsTypes() {
    return request('/news/types', {
      method: 'GET'
    });
  },

  /**
   * 获取新闻详情
   * @param {String} id - 新闻ID
   */
  getNewsDetail(id) {
    return request('/news/detail/' + id, {
      method: 'GET',
      skipCache: true
    });
  }
};

module.exports = API;
