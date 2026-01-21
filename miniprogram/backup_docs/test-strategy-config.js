/**
 * 测试策略配置保存和加载
 *
 * 使用方法：
 * 1. 在小程序开发者工具中，在 Console 中执行此脚本
 * 2. 或者在任何页面的 JS 文件中调用这些测试函数
 */

const API = require('../../services/api');

const DEFAULT_USER_ID = 'default';

/**
 * 测试保存配置
 */
async function testSaveConfig() {
  console.log('🧪 测试保存策略配置...');

  const testConfig = {
    basicConfig: {
      symbol: 'ETH-USDT-SWAP',
      strategyType: 'sar_macd',
      tradingStyle: 'conservative',
      tradeDirection: 'both',
      directionTimeframe: 'daily',
      entryTimeframe: '15m',
      analysisInterval: 30,
      cooldownSeconds: 60,
      tradingMode: 'pure'  // ✅ 测试字段
    },
    buyConfig: {
      logicType: 'and',
      minConfidence: 70,
      conditions: [
        { id: 'sar_daily', name: '日线SAR', enabled: true },
        { id: 'sar_15m', name: '15分钟SAR', enabled: true },
        { id: 'macd_15m', name: '15分钟MACD', enabled: true }
      ]
    },
    sellConfig: {
      logicType: 'or',
      stopLossEnabled: true,
      takeProfitEnabled: true,
      takeProfitPercent: 1.0,
      stopLossPercent: 0.2,
      conditions: []
    },
    fundConfig: {
      mode: 'accountBalance',
      fixedAmount: 100,
      balancePercent: 40,
      leverage: 5,
      marginMode: 'cross',
      maxPositions: 3
    }
  };

  console.log('📤 准备保存配置:', JSON.stringify(testConfig, null, 2));

  try {
    const res = await API.saveStrategyConfig({
      userId: DEFAULT_USER_ID,
      config: testConfig
    });

    console.log('✅ 保存响应:', res);

    if (res.success) {
      console.log('✅ 保存成功！');
      return true;
    } else {
      console.error('❌ 保存失败:', res.error);
      return false;
    }
  } catch (error) {
    console.error('❌ 保存异常:', error);
    return false;
  }
}

/**
 * 测试加载配置
 */
async function testLoadConfig() {
  console.log('🧪 测试加载策略配置...');

  try {
    const res = await API.getStrategyConfig(DEFAULT_USER_ID);

    console.log('✅ 加载响应:', res);

    if (res.success && res.data) {
      console.log('✅ 加载成功！');
      console.log('📊 basicConfig:', JSON.stringify(res.data.basicConfig, null, 2));
      console.log('📊 tradingMode:', res.data.basicConfig && res.data.basicConfig.tradingMode);
      return res.data;
    } else {
      console.error('❌ 加载失败:', res.error);
      return null;
    }
  } catch (error) {
    console.error('❌ 加载异常:', error);
    return null;
  }
}

/**
 * 完整测试：保存 → 加载 → 验证
 */
async function testSaveAndLoad() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🧪 开始完整测试：保存 → 加载 → 验证');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  // 1. 保存配置
  const saveSuccess = await testSaveConfig();
  if (!saveSuccess) {
    console.error('❌ 测试失败：保存配置失败');
    return false;
  }

  // 等待 2 秒，确保数据库写入完成
  await new Promise(resolve => setTimeout(resolve, 2000));

  // 2. 加载配置
  const config = await testLoadConfig();
  if (!config) {
    console.error('❌ 测试失败：加载配置失败');
    return false;
  }

  // 3. 验证 tradingMode
  const tradingMode = config.basicConfig && config.basicConfig.tradingMode;
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 验证结果:');
  console.log(`   tradingMode = "${tradingMode}"`);

  if (tradingMode === 'pure') {
    console.log('✅✅✅ 测试通过！tradingMode 已正确保存和加载 ✅✅✅');
    return true;
  } else {
    console.error('❌❌❌ 测试失败！tradingMode 未正确保存或加载 ❌❌❌');
    console.error('   期望值: "pure"');
    console.error('   实际值:', tradingMode);
    return false;
  }
}

/**
 * 检查所有配置字段
 */
async function checkAllFields() {
  console.log('🧪 检查所有配置字段...');

  const config = await testLoadConfig();
  if (!config) {
    return;
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 完整配置:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  console.log('1️⃣ basicConfig:');
  console.log(JSON.stringify(config.basicConfig, null, 2));

  console.log('2️⃣ buyConfig:');
  console.log(JSON.stringify(config.buyConfig, null, 2));

  console.log('3️⃣ sellConfig:');
  console.log(JSON.stringify(config.sellConfig, null, 2));

  console.log('4️⃣ fundConfig:');
  console.log(JSON.stringify(config.fundConfig, null, 2));
}

// 导出测试函数
module.exports = {
  testSaveConfig,
  testLoadConfig,
  testSaveAndLoad,
  checkAllFields
};

// 如果直接运行此文件
if (typeof wx !== 'undefined') {
  // 在小程序环境中
  wx.testStrategyConfig = {
    testSaveConfig,
    testLoadConfig,
    testSaveAndLoad,
    checkAllFields
  };

  console.log('✅ 测试函数已注册到 wx.testStrategyConfig');
  console.log('   使用方法:');
  console.log('   - wx.testStrategyConfig.testSaveAndLoad()  // 完整测试');
  console.log('   - wx.testStrategyConfig.checkAllFields()  // 检查所有字段');
}
