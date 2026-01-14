// services/api.js
// API服务层 - 封装所有HTTP请求

const BASE_URL = 'https://ly.ddg.org.cn/api';

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
      pairs.push(`${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`);
    }
  }
  return pairs.length > 0 ? '?' + pairs.join('&') : '';
}

/**
 * 通用请求方法
 */
function request(url, options = {}) {
  const fullUrl = `${BASE_URL}${url}`;

  console.log('🔵 API请求:', {
    url: fullUrl,
    method: options.method || 'GET',
    data: options.data
  });

  return new Promise((resolve, reject) => {
    console.log('📤 准备调用wx.request...');

    wx.request({
      url: fullUrl,
      method: options.method || 'GET',
      data: options.data || {},
      header: {
        'content-type': 'application/json',
        ...options.header
      },
      success: (res) => {
        console.log('🟢 API响应成功:', {
          url: fullUrl,
          statusCode: res.statusCode,
          success: res.data?.success,
          dataLength: res.data?.data?.length || 0
        });

        if (res.statusCode === 200) {
          resolve(res.data);
        } else {
          const error = new Error(`HTTP ${res.statusCode}`);
          error.response = res.data;
          console.error('🔴 API错误:', error);
          reject(error);
        }
      },
      fail: (err) => {
        console.error('🔴 wx.request失败:', {
          url: fullUrl,
          errMsg: err.errMsg,
          error: err
        });
        reject(err);
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
   * @param {String} userId - 用户ID
   */
  getAccounts(userId) {
    return request('/accounts', {
      method: 'GET',
      data: { userId }
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

  // ==================== 交易相关 ====================

  /**
   * 获取账户余额
   * @param {String} userId - 用户ID
   */
  getBalance(userId) {
    return request('/trading/account/balance', {
      method: 'POST',
      data: { userId }
    });
  },

  /**
   * 获取持仓列表
   * @param {String} userId - 用户ID
   */
  getPositions(userId) {
    return request('/trading/positions', {
      method: 'POST',
      data: { userId }
    });
  },

  /**
   * 获取交易历史
   * @param {String} userId - 用户ID
   * @param {Number} limit - 条数
   */
  getTradeHistory(userId, limit = 50) {
    return request('/trading/trades', {
      method: 'POST',
      data: { userId, limit }
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

  // ==================== AI分析相关 ====================

  /**
   * 获取最新AI分析
   * @param {String} symbol - 交易对
   * @param {Number} limit - 条数
   */
  getLatestAnalysis(symbol = 'ETH-USDT-SWAP', limit = 1) {
    return request('/ai/analysis/latest', {
      method: 'GET',
      data: { symbol, limit }
    });
  },

  /**
   * 获取AI分析历史
   * @param {String} symbol - 交易对
   * @param {Number} limit - 条数
   */
  getAnalysisHistory(symbol, limit = 20) {
    return request('/ai/analysis/history', {
      method: 'GET',
      data: { symbol, limit }
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
   * 获取自动交易配置
   * @param {String} userId - 用户ID
   */
  getAutoTradingConfig(userId) {
    return request('/autotrading/config', {
      method: 'GET',
      data: { userId }
    });
  }
};

module.exports = API;
