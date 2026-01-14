// pages/chat/chat.ts
interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  time: string;
  executionResult?: string;
}

interface QuickCommand {
  text: string;
  icon: string;
}

Page({
  data: {
    messages: [] as ChatMessage[],
    inputText: '',
    isProcessing: false,
    toView: '',
    quickCommands: [
      { text: '查询余额', icon: '💰' },
      { text: '查询持仓', icon: '📊' },
      { text: '分析行情', icon: '📈' },
      { text: '市价买入', icon: '🛒' },
      { text: '市价卖出', icon: '🏷️' },
      { text: '全部平仓', icon: '❌' },
    ] as QuickCommand[],
  },

  onLoad() {
    // 从本地存储加载聊天历史
    this.loadChatHistory();
  },

  onUnload() {
    // 保存聊天历史
    this.saveChatHistory();
  },

  // 加载聊天历史
  loadChatHistory() {
    try {
      const history = wx.getStorageSync('chat_history');
      if (history) {
        this.setData({ messages: history });
      }
    } catch (e) {
      console.error('加载聊天历史失败:', e);
    }
  },

  // 保存聊天历史
  saveChatHistory() {
    try {
      wx.setStorageSync('chat_history', this.data.messages);
    } catch (e) {
      console.error('保存聊天历史失败:', e);
    }
  },

  // 清空聊天历史
  clearHistory() {
    wx.showModal({
      title: '确认清空',
      content: '确定要清空所有聊天记录吗？',
      success: (res) => {
        if (res.confirm) {
          this.setData({ messages: [] });
          wx.removeStorageSync('chat_history');
          wx.showToast({ title: '已清空', icon: 'success' });
        }
      },
    });
  },

  // 输入变化
  onInputChange(e: any) {
    this.setData({ inputText: e.detail.value });
  },

  // 使用快捷指令
  useQuickCommand(e: any) {
    const command = e.currentTarget.dataset.command;
    this.setData({ inputText: command });
  },

  // 发送消息
  sendMessage() {
    const { inputText, messages } = this.data;

    if (!inputText.trim() || this.data.isProcessing) {
      return;
    }

    // 添加用户消息
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: inputText,
      time: this.formatTime(new Date()),
    };

    this.setData({
      messages: [...messages, userMessage],
      inputText: '',
      isProcessing: true,
    });

    // 滚动到底部
    this.scrollToBottom();

    // 模拟AI响应（实际项目中应该调用后端API）
    setTimeout(() => {
      this.simulateAIResponse(inputText);
    }, 1000);
  },

  // 模拟AI响应
  simulateAIResponse(userInput: string) {
    let response = '';
    let executionResult: string | undefined;

    // 简单的规则匹配（实际应该调用AI API）
    if (userInput.includes('余额') || userInput.includes('查询')) {
      response = '正在为您查询账户余额...';
      executionResult = '查询成功：\nUSDT 可用: 1000.00\nETH 可用: 2.50\nBTC 可用: 0.05';
    } else if (userInput.includes('持仓') || userInput.includes('仓位')) {
      response = '正在为您查询当前持仓...';
      executionResult = '当前持仓:\nETH-USDT 永续: 0.5 张 (做多)\nBTC-USDT 永续: 0.1 张 (做空)';
    } else if (userInput.includes('买入') || userInput.includes('开多')) {
      response = '收到买入指令，正在执行...';
      executionResult = '✅ 买入成功\n交易对: ETH-USDT\n数量: 0.01\n价格: 2000.00 USDT';
    } else if (userInput.includes('卖出') || userInput.includes('平仓')) {
      response = '收到卖出指令，正在执行...';
      executionResult = '✅ 卖出成功\n交易对: ETH-USDT\n数量: 0.01\n价格: 2000.00 USDT';
    } else if (userInput.includes('分析') || userInput.includes('行情')) {
      response = '正在分析市场行情...';
      executionResult = '市场分析结果:\n趋势: 看涨 📈\nRSI: 65 (中性)\nMACD: 金叉形成\n建议: 可适当建仓';
    } else {
      response = '我收到了您的指令：' + userInput + '\n\n抱歉，我暂时无法处理这个请求。请尝试以下指令：\n- 查询余额\n- 查询持仓\n- 买入 [数量] [币种]\n- 卖出 [数量] [币种]\n- 分析行情';
    }

    // 添加AI响应
    const aiMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'assistant',
      content: response,
      time: this.formatTime(new Date()),
      executionResult,
    };

    this.setData({
      messages: [...this.data.messages, aiMessage],
      isProcessing: false,
    });

    // 滚动到底部
    this.scrollToBottom();

    // 保存聊天历史
    this.saveChatHistory();
  },

  // 格式化时间
  formatTime(date: Date): string {
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  },

  // 滚动到底部
  scrollToBottom() {
    const { messages } = this.data;
    if (messages.length > 0) {
      this.setData({
        toView: `msg-${messages.length - 1}`,
      });
    }
  },
});
