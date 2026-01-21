// pages/test/test.js
const zhipuService = require('../../services/zhipu.js');
const API = require('../../services/api.js');

const DEFAULT_USER_ID = 'default';

Page({
  data: {
    serverStatus: { status: 'pending', text: '待测试' },
    glmStatus: { status: 'pending', text: '待测试' },
    balanceStatus: { status: 'pending', text: '待测试' },
    positionsStatus: { status: 'pending', text: '待测试' },
    analysisStatus: { status: 'pending', text: '待测试' },
    logs: [],
    isTesting: false,
    testResults: [],
    loading: false
  },

  onLoad() {
    this.addLog('info', '页面加载完成，准备测试API连接...');
  },

  /**
   * 添加日志
   */
  addLog(type, message) {
    const now = new Date();
    const time = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;

    this.data.logs.unshift({
      type,
      time,
      message
    });

    this.setData({
      logs: this.data.logs.slice(0, 50)
    });
  },

  /**
   * 运行所有测试
   */
  async runAllTests() {
    if (this.data.isTesting || this.data.loading) return;

    this.setData({ isTesting: true, loading: true });
    this.addLog('info', '开始测试所有API...');
    this.setData({ testResults: [] });

    const tests = [
      { name: '服务器连接', fn: () => this.testServerConnection() },
      { name: 'GLM Chat API', fn: () => this.testGLMAPI() },
      { name: 'OKX余额API', fn: () => this.testBalanceAPI() },
      { name: 'OKX持仓API', fn: () => this.testPositionsAPI() },
      { name: 'AI分析API', fn: () => this.testAnalysisAPI() }
    ];

    for (const test of tests) {
      const startTime = Date.now();
      try {
        await test.fn();
        const duration = `${Date.now() - startTime}ms`;
        this.setData({
          testResults: [...this.data.testResults, {
            name: test.name,
            status: 'success',
            duration
          }]
        });
      } catch (error) {
        this.setData({
          testResults: [...this.data.testResults, {
            name: test.name,
            status: 'error',
            error: error.message
          }]
        });
      }
    }

    this.setData({ isTesting: false, loading: false });
    this.addLog('success', '所有测试完成！');
  },

  /**
   * 测试服务器连接
   */
  async testServerConnection() {
    this.addLog('info', '测试服务器连接...');
    try {
      const res = await new Promise((resolve, reject) => {
        wx.request({
          url: 'https://ly.ddg.org.cn/api',
          method: 'GET',
          timeout: 10000,
          success: resolve,
          fail: reject
        });
      });

      if (res.statusCode === 200 || res.statusCode === 404) {
        this.setData({
          serverStatus: { status: 'success', text: '✓ 正常' }
        });
        this.addLog('success', `服务器连接成功 (状态码: ${res.statusCode})`);
      } else {
        throw new Error(`状态码: ${res.statusCode}`);
      }
    } catch (error) {
      this.setData({
        serverStatus: { status: 'error', text: '✗ 失败' }
      });
      this.addLog('error', `服务器连接失败: ${error.errMsg || error.message}`);
      throw error;
    }
  },

  /**
   * 测试GLM Chat API
   */
  async testGLMAPI() {
    this.addLog('info', '测试GLM Chat API...');
    try {
      const response = await zhipuService.ask('你好');

      if (response && response.length > 0) {
        this.setData({
          glmStatus: { status: 'success', text: '✓ 正常' }
        });
        this.addLog('success', `GLM API响应成功: ${response.substring(0, 50)}...`);
      } else {
        throw new Error('响应为空');
      }
    } catch (error) {
      this.setData({
        glmStatus: { status: 'error', text: '✗ 失败' }
      });
      this.addLog('error', `GLM API调用失败: ${error.message || error.errMsg}`);
      throw error;
    }
  },

  /**
   * 测试余额API
   */
  async testBalanceAPI() {
    this.addLog('info', '测试OKX余额查询API...');
    try {
      const res = await API.getBalance(DEFAULT_USER_ID);

      if (res.success) {
        this.setData({
          balanceStatus: { status: 'success', text: '✓ 正常' }
        });
        this.addLog('success', `余额查询成功: 总权益 $${(res.data && res.data.totalEquity) || 'N/A'}`);
      } else {
        throw new Error(res.error || '未知错误');
      }
    } catch (error) {
      this.setData({
        balanceStatus: { status: 'error', text: '✗ 失败' }
      });
      this.addLog('error', `余额查询失败: ${error.message || error.errMsg}`);
      throw error;
    }
  },

  /**
   * 测试持仓API
   */
  async testPositionsAPI() {
    this.addLog('info', '测试OKX持仓查询API...');
    try {
      const res = await API.getPositions({ userId: DEFAULT_USER_ID });

      if (res.success) {
        const count = (res.data && res.data.length) || 0;
        this.setData({
          positionsStatus: { status: 'success', text: '✓ 正常' }
        });
        this.addLog('success', `持仓查询成功: 当前${count}个持仓`);
      } else {
        throw new Error(res.error || '未知错误');
      }
    } catch (error) {
      this.setData({
        positionsStatus: { status: 'error', text: '✗ 失败' }
      });
      this.addLog('error', `持仓查询失败: ${error.message || error.errMsg}`);
      throw error;
    }
  },

  /**
   * 测试AI分析API
   */
  async testAnalysisAPI() {
    this.addLog('info', '测试AI市场分析API...');
    try {
      const res = await API.getLatestAnalysis('ETH-USDT-SWAP', 1, false);

      if (res.success && res.data) {
        const signal = res.data.signal_type || 'N/A';
        this.setData({
          analysisStatus: { status: 'success', text: '✓ 正常' }
        });
        this.addLog('success', `AI分析成功: 信号 ${signal}`);
      } else {
        throw new Error(res.error || '无数据');
      }
    } catch (error) {
      this.setData({
        analysisStatus: { status: 'error', text: '✗ 失败' }
      });
      this.addLog('error', `AI分析失败: ${error.message || error.errMsg}`);
      throw error;
    }
  }
});
