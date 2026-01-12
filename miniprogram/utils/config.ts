// API配置
export const CONFIG = {
  // API基础URL
  API_BASE: 'https://ly.ddg.org.cn/api',

  // WebSocket URL
  WS_BASE: 'wss://ly.ddg.org.cn',

  // 支持的交易对
  SYMBOLS: ['BTC-USDT-SWAP', 'ETH-USDT-SWAP', 'SOL-USDT-SWAP', 'DOGE-USDT-SWAP', 'PEPE-USDT-SWAP', 'NEAR-USDT-SWAP'],

  // 时间周期
  TIMEFRAMES: ['1H', '4H', '1D'],

  // 存储键
  STORAGE_KEYS: {
    TOKEN: 'auth_token',
    USER_INFO: 'user_info',
    CURRENT_SYMBOL: 'current_symbol',
    STRATEGY_LIST: 'strategy_list',
    ACCOUNTS: 'accounts',
    CURRENT_ACCOUNT_INDEX: 'current_account_index',
    AUTO_TRADING_CONFIG: 'auto_trading_config',
    AUTO_TRADING_STATE: 'auto_trading_state',
    AI_ANALYSIS_CONFIG: 'ai_analysis_config',
    ANALYSIS_HISTORY: 'analysis_history'
  }
}
