/**
 * 测试登录功能
 *
 * 使用方法：
 * 1. 在小程序开发者工具中，在 Console 中执行此脚本
 * 2. 或者在任何页面的 JS 文件中调用这些测试函数
 */

/**
 * 测试登录流程
 */
async function testLoginFlow() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🧪 开始测试登录流程');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  try {
    // 1. 获取用户资料
    console.log('\n📝 步骤 1/4: 获取用户资料...');
    const userProfile = await getUserProfileInfo();

    if (!userProfile) {
      console.error('❌ 获取用户资料失败');
      return false;
    }

    console.log('✅ 用户资料:', userProfile);
    console.log('   -昵称:', userProfile.nickName);
    console.log('   -头像:', userProfile.avatarUrl);

    // 2. 获取微信登录code
    console.log('\n📱 步骤 2/4: 获取微信登录code...');
    const loginRes = await getWechatLoginCode();

    if (!loginRes.code) {
      console.error('❌ 获取微信登录code失败');
      return false;
    }

    console.log('✅ 获取code成功');
    console.log('   code:', loginRes.code);

    // 3. 调用后端登录接口
    console.log('\n🌐 步骤 3/4: 调用后端登录接口...');
    const authRes = await API.login({
      code: loginRes.code,
      userInfo: userProfile
    });

    console.log('✅ 登录响应:', authRes);

    if (authRes.success && authRes.data) {
      const { token, user } = authRes.data;

      // 4. 保存Token和用户信息
      wx.setStorageSync('token', token);
      wx.setStorageSync('userInfo', user);

      console.log('\n✅✅✅ 登录成功！✅✅✅');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('📊 用户信息:');
      console.log('   ID:', user.id);
      console.log('   OpenID:', user.openid);
      console.log('   昵称:', user.nickname);
      console.log('   头像:', user.avatarUrl);
      console.log('   是否新用户:', user.isNewUser);
      console.log('   Token:', token.substring(0, 50) + '...');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

      return true;
    } else {
      console.error('❌ 登录失败:', authRes.error);
      return false;
    }
  } catch (error) {
    console.error('❌ 测试失败:', error);
    return false;
  }
}

/**
 * 测试获取用户资料
 */
function getUserProfileInfo() {
  return new Promise((resolve) => {
    wx.getUserProfile({
      desc: '用于完善用户资料',
      success: (res) => {
        console.log('✅ 获取用户资料成功');
        resolve(res.userInfo);
      },
      fail: (err) => {
        console.error('❌ 获取用户资料失败:', err);
        wx.showModal({
          title: '提示',
          content: '需要授权获取用户信息',
          showCancel: false
        });
        resolve(null);
      }
    });
  });
}

/**
 * 测试获取微信登录code
 */
function getWechatLoginCode() {
  return new Promise((resolve) => {
    wx.login({
      success: (res) => {
        console.log('✅ wx.login成功');
        resolve(res);
      },
      fail: (err) => {
        console.error('❌ wx.login失败:', err);
        resolve({ code: null });
      }
    });
  });
}

/**
 * 测试获取用户信息
 */
async function testGetUserProfile() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🧪 测试获取用户信息');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  try {
    const res = await API.getUserProfile();

    console.log('✅ API响应:', res);

    if (res.success && res.data) {
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('📊 用户信息:');
      console.log('   ID:', res.data.id);
      console.log('   OpenID:', res.data.openid);
      console.log('   昵称:', res.data.nickname);
      console.log('   头像:', res.data.avatarUrl);
      console.log('   登录时间:', res.data.lastLoginTime);
      console.log('   OKX账号数:', res.data.accountCount);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

      return res.data;
    } else {
      console.error('❌ 获取用户信息失败:', res.error);
      return null;
    }
  } catch (error) {
    console.error('❌ 获取用户信息异常:', error);
    return null;
  }
}

/**
 * 测试退出登录
 */
function testLogout() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🧪 测试退出登录');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  // 清除本地存储
  wx.removeStorageSync('token');
  wx.removeStorageSync('userInfo');

  console.log('✅ 已清除Token和用户信息');
  console.log('   Token:', wx.getStorageSync('token'));
  console.log('   UserInfo:', wx.getStorageSync('userInfo'));

  // 跳转到登录页
  wx.navigateTo({
    url: '/pages/auth/login/login'
  });

  console.log('✅ 已跳转到登录页');
}

// 导出测试函数
module.exports = {
  testLoginFlow,
  testGetUserProfile,
  testLogout
};

// 如果直接运行此文件
if (typeof wx !== 'undefined') {
  // 在小程序环境中
  wx.testLogin = {
    testLoginFlow,
    testGetUserProfile,
    testLogout
  };

  console.log('✅ 测试函数已注册到 wx.testLogin');
  console.log('   使用方法:');
  console.log('   - wx.testLogin.testLoginFlow()  // 完整登录流程测试');
  console.log('   - wx.testLogin.testGetUserProfile()  // 测试获取用户信息');
  console.log('   - wx.testLogin.testLogout()  // 测试退出登录');
}
