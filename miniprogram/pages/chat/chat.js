// pages/chat/chat.js
const zhipuService = require('../../services/zhipu.js');
const API = require('../../services/api.js');

const FALLBACK_USER_ID = 'default';

function getCurrentUserId() {
  const userInfo = wx.getStorageSync('userInfo');
  return (userInfo && userInfo.id) ? userInfo.id : FALLBACK_USER_ID;
}

function getCurrentAccountId() {
  const account = wx.getStorageSync('currentAccount');
  return account && account.id ? account.id : null;
}

Page({
  data: {
    messages: [],
    inputText: '',
    isProcessing: false,
    toView: '',
    scrollTop: 0,
    userInfo: null,
    quickCommands: [
      { icon: '💰', text: '查询余额' },
      { icon: '📊', text: '持仓信息' },
      { icon: '📈', text: '分析BTC' },
      { icon: '🛒', text: '买入0.01 ETH' },
      { icon: '🔄', text: '全部平仓' }
    ],
    selectedProvider: 'glm-4.5-air'
  },

  onLoad(options) {
    // 不再显示欢迎消息，保持空状态
    this.loadUserInfo();
  },

  onShow() {
    this.loadUserInfo();
  },

  loadUserInfo() {
    const userInfo = wx.getStorageSync('userInfo');
    this.setData({ userInfo: userInfo || null });
  },

  getCurrentTime() {
    const now = new Date();
    return now.toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit'
    });
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

    console.log('📤 用户发送消息:', content);

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

    // 调用AI模型
    try {
      console.log('🤖 准备调用AI...');
      const systemPrompt = this.getSystemPrompt();
      console.log('📋 系统提示词长度:', systemPrompt.length);

      const aiResponse = await zhipuService.ask(content, systemPrompt);
      console.log('🤖 AI原始响应:', aiResponse);

      // 解析AI响应
      console.log('🔍 开始解析AI响应...');
      const parsedResponse = await this.parseAIResponse(aiResponse);
      console.log('✅ 解析完成:', {
        message: parsedResponse.message,
        hasResult: !!parsedResponse.executionResult
      });

      // 添加AI回复
      const assistantMsg = {
        id: Date.now() + 1,
        role: 'assistant',
        content: parsedResponse.message,
        time: this.getCurrentTime(),
        executionResult: parsedResponse.executionResult
      };

      console.log('💬 添加AI消息到界面...');
      this.setData({
        messages: [...this.data.messages, assistantMsg],
        toView: `msg-${assistantMsg.id}`,
        isProcessing: false
      });

      console.log('✅ 消息发送流程完成');

    } catch (error) {
      console.error('❌ AI调用失败:', error);
      console.error('❌ 错误详情:', {
        message: error.message,
        stack: error.stack,
        errMsg: error.errMsg
      });

      // 添加错误消息
      const errorMsg = {
        id: Date.now() + 1,
        role: 'assistant',
        content: `抱歉，AI服务暂时不可用。\n\n错误信息：${error.message || error.errMsg || '未知错误'}`,
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
4. 买入/做多 - "市价买入做多ETH 10% 10倍杠杆"、"买入做多"、"做多ETH"等
5. 卖出/做空 - "市价买入做空ETH 10% 10倍杠杆"、"买入做空"、"做空ETH"等
6. 平仓 - "全部平仓"、"平掉所有"等

【响应格式】
你必须只返回一个JSON对象，不要有任何其他文字：
{"action": "操作类型", "params": {参数对象}, "message": "友好回复", "result": "执行结果说明"}

action可选值：
- "query_balance": 查询余额
- "query_positions": 查询持仓
- "analyze": 分析行情
- "buy": 买入/做多
- "sell": 卖出/做空
- "close_position": 平仓
- "chat": 普通对话

【参数说明】
- 买入/做多时：params应包含 { "side": "buy", "posSide": "long", "instId": "ETH-USDT-SWAP", "sz": "10", "lever": "10" }
- 卖出/做空时：params应包含 { "side": "buy", "posSide": "short", "instId": "ETH-USDT-SWAP", "sz": "10", "lever": "10" }
- sz: 仓位百分比，默认10
- lever: 杠杆倍数，默认10

【重要】
- 默认交易对是ETH-USDT-SWAP（永续合约）
- 默认杠杆是10倍
- 默认仓位是10%
- 必须返回纯JSON，不要加任何额外文字或markdown标记
- message应该简洁友好
- result字段应该描述操作结果的详细信息`;
  },

  /**
   * 解析AI响应
   */
  async parseAIResponse(response) {
    console.log('📥 AI原始响应:', response);

    try {
      // 尝试提取JSON
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.warn('⚠️ 未找到JSON格式的响应，返回原始文本');
        return {
          message: response,
          executionResult: null
        };
      }

      const jsonStr = jsonMatch[0];
      console.log('📦 提取的JSON:', jsonStr);

      const data = JSON.parse(jsonStr);
      console.log('🔍 解析后的数据:', data);

      const action = data.action || 'chat';
      const message = data.message || response;
      const result = data.result || null;

      console.log('🎯 识别的操作:', action);

      // 执行相应的操作（异步）
      let executionResult = null;

      switch (action) {
        case 'query_balance':
          console.log('💰 执行查询余额...');
          executionResult = await this.queryBalance();
          console.log('✅ 查询余额完成:', executionResult);
          break;
        case 'query_positions':
          console.log('📊 执行查询持仓...');
          executionResult = await this.queryPositions();
          console.log('✅ 查询持仓完成:', executionResult);
          break;
        case 'analyze':
          console.log('📈 执行市场分析...');
          executionResult = await this.analyzeMarket(data.params);
          console.log('✅ 市场分析完成:', executionResult);
          break;
        case 'buy':
          console.log('📈 执行买入操作...');
          executionResult = await this.executeTrade(data.params);
          console.log('✅ 买入完成:', executionResult);
          break;
        case 'sell':
          console.log('📉 执行卖出操作...');
          executionResult = await this.executeTrade(data.params);
          console.log('✅ 卖出完成:', executionResult);
          break;
        case 'close_position':
          console.log('🔄 执行平仓操作...');
          executionResult = await this.closeAllPositions(data.params);
          console.log('✅ 平仓完成:', executionResult);
          break;
        default:
          console.log('💬 普通对话，不执行操作');
          break;
      }

      console.log('📤 返回结果:', { message, hasExecutionResult: !!executionResult });

      return {
        message: message,
        executionResult: executionResult
      };

    } catch (error) {
      console.error('❌ 解析AI响应失败:', error);
      console.error('❌ 错误详情:', {
        message: error.message,
        stack: error.stack,
        response: response.substring(0, 200)
      });
      return {
        message: response,
        executionResult: null
      };
    }
  },

  /**
   * 查询余额（真实API）
   */
  async queryBalance() {
    try {
      console.log('💰 开始调用余额API...');
      const accountId = getCurrentAccountId();
      const res = await API.getBalance(accountId ? { accountId } : { userId: getCurrentUserId() });
      console.log('💰 余额API响应:', res);

      if (res.success && res.data) {
        const data = res.data;
        console.log('💰 余额数据:', data);

        let result = `💰 账户余额：\n总权益: $${parseFloat(data.total_equity || 0).toFixed(2)} USDT\n可用余额: $${parseFloat(data.available_balance || 0).toFixed(2)} USDT`;

        if (data.details && data.details.length > 0) {
          result += '\n\n资产明细：';
          data.details.forEach(item => {
            result += `\n• ${item.ccy}: ${parseFloat(item.eqUsd || 0).toFixed(4)} USDT`;
          });
        }

        console.log('💰 格式化后的结果:', result);
        return result;
      }

      console.warn('💰 API返回失败:', res);
      return `💰 查询失败：${res.error || '未知错误'}`;
    } catch (error) {
      console.error('❌ 查询余额异常:', error);
      console.error('❌ 错误堆栈:', error.stack);
      return `❌ 查询余额失败：${error.message || '网络错误'}`;
    }
  },

  /**
   * 查询持仓（真实API）
   */
  async queryPositions() {
    try {
      const accountId = getCurrentAccountId();
      const res = await API.getPositions(accountId ? { accountId } : { userId: getCurrentUserId() });
      if (res.success && res.data && res.data.length > 0) {
        let result = '📊 当前持仓：\n';
        res.data.forEach((p, i) => {
          const symbol = p.symbol ? p.symbol.replace('-USDT-SWAP', '') : '--';
          const side = p.side === 'long' ? '多' : '空';
          const pnl = parseFloat(p.unrealizedPnl || 0);
          const pnlStr = pnl >= 0 ? `+${pnl.toFixed(2)}` : pnl.toFixed(2);
          result += `\n${i + 1}. ${symbol} ${side} ${p.leverage}x`;
          result += `\n   数量: ${p.size} | 均价: ${parseFloat(p.entryPrice || 0).toFixed(2)}`;
          result += `\n   未实现盈亏: ${pnlStr} USDT`;
        });
        return result;
      }
      return '📊 暂无持仓';
    } catch (error) {
      console.error('查询持仓失败:', error);
      return '❌ 查询持仓失败，请稍后重试';
    }
  },

  /**
   * 分析市场（调用AI分析API）
   */
  async analyzeMarket(params) {
    try {
      const symbol = (params && params.instId) || (params && params.symbol) || 'ETH-USDT-SWAP';
      const res = await API.getLatestAnalysis(symbol, 1, true, getCurrentUserId());

      if (!res.success) {
        return (res.data && res.data.strategyConfigHint) || res.error || 'AI分析未开启，请先配置并启用策略';
      }

      if (res.data && res.data.analysisDisabled) {
        return res.data.strategyConfigHint || 'AI分析未开启，请先配置并启用策略';
      }

      if (res.data) {
        const analysis = res.data;
        const signal = analysis.signal_type || '--';
        const confidence = parseFloat(analysis.confidence || 0) * 100;

        let result = `📈 ${symbol.replace('-USDT-SWAP', '')} AI分析：\n`;
        result += `\n信号: ${signal === 'buy' ? '🟢买入' : signal === 'sell' ? '🔴卖出' : '🟡观望'}`;
        result += `\n置信度: ${confidence.toFixed(0)}%`;

        if (analysis.suggested_price) {
          result += `\n建议价格: $${parseFloat(analysis.suggested_price).toFixed(2)}`;
        }
        if (analysis.stop_loss) {
          result += `\n止损: $${parseFloat(analysis.stop_loss).toFixed(2)}`;
        }
        if (analysis.take_profit) {
          result += `\n止盈: $${parseFloat(analysis.take_profit).toFixed(2)}`;
        }
        if (analysis.reasoning) {
          result += `\n\n分析理由: ${analysis.reasoning.substring(0, 100)}...`;
        }

        return result;
      }
      return '📈 暂无分析数据';
    } catch (error) {
      console.error('市场分析失败:', error);
      return '❌ 市场分析失败，请稍后重试';
    }
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
  },

  /**
   * 手动查询余额（直接调用API并在聊天中显示）
   */
  async manualQueryBalance() {
    console.log('👆 用户点击手动查询余额');
    wx.showLoading({ title: '查询中...' });

    try {
      // 添加用户消息
      const userMsg = {
        id: Date.now(),
        role: 'user',
        content: '查询余额',
        time: this.getCurrentTime()
      };

      this.setData({
        messages: [...this.data.messages, userMsg]
      });

      // 直接调用API
      const balanceResult = await this.queryBalance();

      // 添加AI回复
      const assistantMsg = {
        id: Date.now() + 1,
        role: 'assistant',
        content: '已为您查询账户余额',
        time: this.getCurrentTime(),
        executionResult: balanceResult
      };

      this.setData({
        messages: [...this.data.messages, assistantMsg],
        toView: `msg-${assistantMsg.id}`
      });

      wx.hideLoading();

    } catch (error) {
      wx.hideLoading();
      console.error('❌ 手动查询失败:', error);
      wx.showToast({
        title: '查询失败',
        icon: 'none'
      });
    }
  },

  /**
   * 清空聊天
   */
  clearChat() {
    wx.showModal({
      title: '清空聊天',
      content: '确定要清空所有聊天记录吗？',
      confirmText: '清空',
      confirmColor: '#ff3b30',
      success: (res) => {
        if (res.confirm) {
          this.setData({
            messages: []
          });
          wx.showToast({
            title: '已清空',
            icon: 'success'
          });
        }
      }
    });
  },

  /**
   * 显示快捷菜单
   */
  showQuickMenu() {
    const commands = this.data.quickCommands;

    wx.showActionSheet({
      itemList: commands.map(c => `${c.icon} ${c.text}`),
      success: (res) => {
        if (res.tapIndex >= 0) {
          const command = commands[res.tapIndex].text;
          this.setData({
            inputText: command
          });
          setTimeout(() => {
            this.sendMessage();
          }, 100);
        }
      }
    });
  },

  /**
   * 执行交易（买入/卖出）
   */
  async executeTrade(params) {
    try {
      console.log('📊 开始执行交易，params:', params);

      // 获取当前账号ID
      const accountId = getCurrentAccountId();
      const userId = getCurrentUserId();

      // 服务器端API期望的参数格式：{userId, symbol, side, size}
      // symbol: 交易对，如 "ETH-USDT-SWAP"
      // side: "long" (做多) 或 "short" (做空)
      // size: 仓位大小
      const tradeData = {
        userId: userId,
        symbol: (params && params.instId) || 'ETH-USDT-SWAP',
        side: (params && params.posSide) || 'long', // long=做多, short=做空
        size: (params && params.sz) || '10' // 默认10%
      };

      console.log('📊 实际发送的交易参数:', tradeData);

      const res = await API.executeTrade(tradeData);
      console.log('📊 交易API响应:', res);

      if (res.success) {
        const sideText = tradeData.side === 'long' ? '做多' : '做空';
        const symbol = tradeData.symbol.replace('-USDT-SWAP', '');
        return `✅ 交易成功！\n\n${sideText} ${symbol}\n仓位: ${tradeData.size}%\n\n订单号: ${res.data.ordId || '已提交'}`;
      }

      return `❌ 交易失败：${res.error || '未知错误'}`;
    } catch (error) {
      console.error('❌ 交易异常:', error);
      return `❌ 交易失败：${error.message || '网络错误'}`;
    }
  },

  /**
   * 全部平仓
   */
  async closeAllPositions(params) {
    try {
      console.log('🔄 开始全部平仓...');

      // 先查询当前持仓
      const accountId = getCurrentAccountId();
      const userId = getCurrentUserId();

      const posRes = await API.getPositions(accountId ? { accountId } : { userId });
      console.log('📊 持仓查询结果:', posRes);

      if (!posRes.success || !posRes.data || posRes.data.length === 0) {
        return '✅ 暂无持仓需要平仓';
      }

      // 逐个平仓
      const positions = posRes.data;
      let results = [];
      let successCount = 0;
      let failCount = 0;

      for (const pos of positions) {
        // 服务器API期望的positionId格式: "symbol-side"
        const positionId = `${pos.symbol}-${pos.side}`;
        const closeData = {
          userId: userId,
          positionId: positionId
        };

        console.log('🔄 平仓数据:', closeData);

        try {
          const res = await API.closePosition(closeData);
          console.log('🔄 平仓响应:', res);

          if (res.success) {
            successCount++;
            const sideText = pos.side === 'long' ? '多' : '空';
            results.push(`${pos.symbol} ${sideText} 平仓成功`);
          } else {
            failCount++;
            const sideText = pos.side === 'long' ? '多' : '空';
            results.push(`${pos.symbol} ${sideText} 平仓失败: ${res.error || '未知错误'}`);
          }
        } catch (error) {
          failCount++;
          const sideText = pos.side === 'long' ? '多' : '空';
          results.push(`${pos.symbol} ${sideText} 平仓失败: ${error.message}`);
        }
      }

      // 返回汇总结果
      let result = `🔄 平仓完成！\n\n总计: ${positions.length}个持仓\n成功: ${successCount}个\n失败: ${failCount}个`;

      if (results.length > 0) {
        result += '\n\n详情:\n' + results.join('\n');
      }

      return result;
    } catch (error) {
      console.error('❌ 平仓异常:', error);
      return `❌ 平仓失败：${error.message || '网络错误'}`;
    }
  }
});
