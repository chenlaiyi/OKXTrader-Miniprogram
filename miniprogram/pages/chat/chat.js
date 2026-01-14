// pages/chat/chat.js
const zhipuService = require('../../services/zhipu.js');

Page({

  /**
   * 页面的初始数据
   */
  data: {
    messages: [], // 消息列表
    inputText: '', // 输入框内容
    isProcessing: false, // 是否正在处理
    toView: '', // 滚动到指定消息
    quickCommands: [ // 快捷指令
      { icon: '💰', text: '查询余额' },
      { icon: '📊', text: '持仓信息' },
      { icon: '📈', text: '分析BTC' },
      { icon: '🛒', text: '买入0.01 ETH' },
      { icon: '🔄', text: '全部平仓' }
    ],
    selectedProvider: 'glm-4-flash' // 选择的AI模型
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
    // 不再添加欢迎消息，显示空状态
  },

  /**
   * 获取当前时间
   */
  getCurrentTime() {
    const now = new Date();
    return now.toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit'
    });
  },

  /**
   * 生命周期函数--监听页面初次渲染完成
   */
  onReady() {

  },

  /**
   * 生命周期函数--监听页面显示
   */
  onShow() {

  },

  /**
   * 生命周期函数--监听页面隐藏
   */
  onHide() {

  },

  /**
   * 生命周期函数--监听页面卸载
   */
  onUnload() {

  },

  /**
   * 页面相关事件处理函数--监听用户下拉动作
   */
  onPullDownRefresh() {
    wx.stopPullDownRefresh();
  },

  /**
   * 页面上拉触底事件的处理函数
   */
  onReachBottom() {

  },

  /**
   * 用户点击右上角分享
   */
  onShareAppMessage() {

  },

  /**
   * 输入框内容变化
   */
  onInputChange(e) {
    this.setData({
      inputText: e.detail.value
    });
  },

  /**
   * 发送消息
   */
  async sendMessage() {
    const content = this.data.inputText.trim();
    if (!content || this.data.isProcessing) return;

    // 添加用户消息
    const userMsg = {
      id: Date.now(),
      role: 'user',
      content: content,
      time: this.getCurrentTime()
    };

    const messages = [...this.data.messages, userMsg];

    this.setData({
      messages: messages,
      inputText: '',
      toView: `msg-${userMsg.id}`,
      isProcessing: true
    });

    // 调用GLM模型
    try {
      const systemPrompt = this.getSystemPrompt();
      const aiResponse = await zhipuService.ask(content, systemPrompt);

      // 解析AI响应
      const parsedResponse = this.parseAIResponse(aiResponse);

      // 添加AI回复
      const assistantMsg = {
        id: Date.now() + 1,
        role: 'assistant',
        content: parsedResponse.message,
        time: this.getCurrentTime(),
        executionResult: parsedResponse.executionResult
      };

      this.setData({
        messages: [...this.data.messages, assistantMsg],
        toView: `msg-${assistantMsg.id}`,
        isProcessing: false
      });

    } catch (error) {
      console.error('❌ AI调用失败:', error);

      // 添加错误消息
      const errorMsg = {
        id: Date.now() + 1,
        role: 'assistant',
        content: '抱歉，AI服务暂时不可用。请稍后再试。',
        time: this.getCurrentTime(),
        executionResult: null
      };

      this.setData({
        messages: [...this.data.messages, errorMsg],
        isProcessing: false
      });

      wx.showToast({
        title: 'AI服务错误',
        icon: 'none'
      });
    }
  },

  /**
   * 获取系统提示词
   */
  getSystemPrompt() {
    return `你是OKly交易助手，可以帮用户执行以下操作：

【可执行的操作】
1. 查询账户余额 - 用户说"查询余额"、"有多少钱"等
2. 查询持仓 - 用户说"持仓"、"我持有什么"等
3. 分析行情 - 用户说"分析BTC"、"ETH走势"等
4. 买入 - 用户说"买入0.01 BTC"、"用100U买ETH"等
5. 卖出 - 用户说"卖出0.5 ETH"、"卖掉所有SOL"等
6. 平仓 - 用户说"平仓"、"全部平仓"等

【响应格式】
你必须只返回一个JSON对象，不要有任何其他文字：
{"action": "操作类型", "params": {参数}, "message": "友好回复", "result": "执行结果说明"}

action可选值：
- "query_balance": 查询余额
- "query_positions": 查询持仓
- "analyze": 分析行情
- "buy": 买入
- "sell": 卖出
- "close_position": 平仓
- "chat": 普通对话

【注意事项】
- 必须返回纯JSON，不要加任何额外文字或markdown标记
- message应该简洁友好
- result字段应该描述操作结果的详细信息`;
  },

  /**
   * 解析AI响应
   */
  parseAIResponse(response) {
    try {
      // 尝试提取JSON
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return {
          message: response,
          executionResult: null
        };
      }

      const jsonStr = jsonMatch[0];
      const data = JSON.parse(jsonStr);

      const action = data.action || 'chat';
      const message = data.message || response;
      const result = data.result || null;

      // 执行相应的操作
      let executionResult = null;

      switch (action) {
        case 'query_balance':
          executionResult = this.queryBalance();
          break;
        case 'query_positions':
          executionResult = this.queryPositions();
          break;
        case 'analyze':
          executionResult = this.analyzeMarket(data.params);
          break;
        case 'buy':
        case 'sell':
        case 'close_position':
          executionResult = `🚧 ${result || '交易功能开发中'}\n\n当前为演示模式，实际交易需要连接OKX API`;
          break;
      }

      return {
        message: message,
        executionResult: executionResult
      };

    } catch (error) {
      console.error('❌ 解析AI响应失败:', error);
      return {
        message: response,
        executionResult: null
      };
    }
  },

  /**
   * 查询余额（模拟）
   */
  queryBalance() {
    return `💰 账户余额（模拟数据）：
总权益: $10,000.00 USDT
可用: $5,000.00 USDT
冻结: $5,000.00 USDT`;
  },

  /**
   * 查询持仓（模拟）
   */
  queryPositions() {
    return `📊 当前持仓（模拟数据）：
暂无持仓`;
  },

  /**
   * 分析市场（模拟）
   */
  analyzeMarket(params) {
    const instId = params.instId || 'BTC-USDT';
    return `📈 ${instId} 技术分析（演示）：
当前价格: $35,200.50
24h涨跌: +2.15%
技术指标: RSI 55 (中性)
建议: 观望等待更明确信号`;
  },

  /**
   * 使用快捷命令
   */
  useQuickCommand(e) {
    const command = e.currentTarget.dataset.command;
    this.setData({
      inputText: command
    });

    // 自动发送命令
    setTimeout(() => {
      this.sendMessage();
    }, 100);
  }
})