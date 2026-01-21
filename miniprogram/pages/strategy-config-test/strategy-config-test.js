// 策略配置保存测试页面
const API = require('../../services/api.js');

const DEFAULT_USER_ID = 'default';

Page({
  data: {
    tradingMode: 'ai',
    logText: ''
  },

  onLoad() {
    this.addLog('🚀 测试页面加载');
    this.loadConfig();
  },

  addLog(message) {
    const timestamp = new Date().toLocaleTimeString();
    const logText = this.data.logText + `[${timestamp}] ${message}\n`;
    this.setData({ logText });
  },

  async loadConfig() {
    this.addLog('📥 开始加载配置...');

    try {
      const res = await API.getStrategyConfig(DEFAULT_USER_ID);

      if (res.success && res.data) {
        const basicConfig = res.data.basicConfig || {};
        const tradingMode = basicConfig.tradingMode || 'ai';
        this.addLog(`✅ 加载成功，tradingMode = "${tradingMode}"`);
        this.setData({ tradingMode });
      } else {
        this.addLog(`❌ 加载失败: ${res.error || '未知错误'}`);
      }
    } catch (error) {
      this.addLog(`❌ 加载异常: ${error.message}`);
    }
  },

  async saveConfig() {
    this.addLog(`💾 开始保存配置，tradingMode = "${this.data.tradingMode}"`);

    try {
      const config = {
        basicConfig: {
          symbol: 'ETH-USDT-SWAP',
          tradingMode: this.data.tradingMode,
          testTimestamp: new Date().toISOString()
        },
        buyConfig: { test: 'buy' },
        sellConfig: { test: 'sell' },
        fundConfig: { test: 'fund' }
      };

      this.addLog(`📤 发送保存请求...`);

      const res = await API.saveStrategyConfig({
        userId: DEFAULT_USER_ID,
        config
      });

      if (res.success) {
        this.addLog(`✅ 保存成功！`);
      } else {
        this.addLog(`❌ 保存失败: ${res.error}`);
      }
    } catch (error) {
      this.addLog(`❌ 保存异常: ${error.message}`);
    }
  },

  async verifyConfig() {
    this.addLog('✅ 开始验证配置...');

    try {
      // 重新从数据库加载
      const res = await API.getStrategyConfig(DEFAULT_USER_ID);

      if (res.success && res.data) {
        const basicConfig = res.data.basicConfig || {};
        const dbTradingMode = basicConfig.tradingMode;
        const currentTradingMode = this.data.tradingMode;

        this.addLog(`📊 数据库中的值: "${dbTradingMode}"`);
        this.addLog(`📊 当前页面的值: "${currentTradingMode}"`);

        if (dbTradingMode === currentTradingMode) {
          this.addLog(`✅✅✅ 验证通过！配置已正确保存 ✅✅✅`);
        } else {
          this.addLog(`❌❌❌ 验证失败！值不匹配 ❌❌❌`);
        }
      }
    } catch (error) {
      this.addLog(`❌ 验证异常: ${error.message}`);
    }
  },

  switchToPure() {
    this.addLog(`🔄 切换到纯策略模式`);
    this.setData({ tradingMode: 'pure' });
  },

  switchToAI() {
    this.addLog(`🔄 切换到AI辅助模式`);
    this.setData({ tradingMode: 'ai' });
  }
});
