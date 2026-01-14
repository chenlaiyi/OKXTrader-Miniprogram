// services/zhipu.js
// 智谱AI GLM模型服务

const BASE_URL = 'https://ly.ddg.org.cn/api';

/**
 * 调用GLM聊天API（通过服务器代理）
 * @param {Array} messages - 消息数组 [{role, content}]
 * @param {String} model - 模型名称，默认 'glm-4-flash'
 */
async function chat(messages, model = 'glm-4-flash') {
  try {
    console.log('🤖 调用GLM模型:', model);

    // 将wx.request包装成Promise
    const response = await new Promise((resolve, reject) => {
      wx.request({
        url: `${BASE_URL}/ai/chat`,
        method: 'POST',
        header: {
          'Content-Type': 'application/json'
        },
        data: {
          model: model,
          messages: messages,
          temperature: 0.3,
          top_p: 0.9,
          max_tokens: 4096
        },
        success: resolve,
        fail: reject
      });
    });

    console.log('📡 服务器响应状态:', response.statusCode);

    if (response.statusCode === 200) {
      const data = response.data;
      console.log('📦 响应数据:', data);

      // 解析服务器响应
      if (data.success && data.data && data.data.choices && data.data.choices[0]) {
        const content = data.data.choices[0].message.content;
        console.log('✅ GLM响应成功:', content.substring(0, 100));
        return content;
      }

      console.error('❌ 响应格式错误:', data);
      throw new Error('响应格式错误');
    } else {
      console.error('❌ API返回错误状态:', response.statusCode, response.data);
      throw new Error(`API错误: ${response.statusCode} - ${JSON.stringify(response.data)}`);
    }
  } catch (error) {
    console.error('❌ GLM API调用失败:', error);
    throw error;
  }
}

/**
 * 简单对话接口
 * @param {String} question - 用户问题
 * @param {String} systemPrompt - 系统提示词（可选）
 */
async function ask(question, systemPrompt = null) {
  const messages = [];

  if (systemPrompt) {
    messages.push({
      role: 'system',
      content: systemPrompt
    });
  }

  messages.push({
    role: 'user',
    content: question
  });

  return await chat(messages);
}

module.exports = {
  chat,
  ask
};
