// 添加OKX账号页面
const API = require('../../services/api.js');

Page({
  data: {
    accountName: '',
    accountType: 'real',
    label: '',
    apiKey: '',
    secretKey: '',
    passphrase: '',
    showGuide: false,
    isEdit: false,
    accountId: ''
  },

  onLoad(options) {
    if (!options) return;

    // 编辑模式：从参数中读取账号信息
    if (options.account) {
      try {
        const account = JSON.parse(decodeURIComponent(options.account));
        this.setData({
          isEdit: true,
          accountId: account.id || '',
          accountName: account.accountName || account.name || '',
          accountType: account.accountType || 'real',
          label: account.label || ''
        });
        return;
      } catch (error) {
        console.error('❌ 解析账号参数失败:', error);
      }
    }
  },

  /**
   * 扫描OKX API二维码
   */
  async onScanQRCode() {
    try {
      // 调用微信扫一扫
      const scanResult = await wx.scanCode({
        scanType: ['qrCode'],
        onlyFromCamera: false // 允许从相册选择
      });

      console.log('📱 扫码结果:', scanResult);

      if (scanResult && scanResult.result) {
        const qrData = scanResult.result;

        // 尝试解析二维码内容
        this.parseQRCodeData(qrData);
      }
    } catch (error) {
      console.error('❌ 扫码失败:', error);

      if (error.errMsg && error.errMsg.includes('cancel')) {
        // 用户取消扫描，不提示
        return;
      }

      wx.showToast({
        title: '扫码失败',
        icon: 'none'
      });
    }
  },

  /**
   * 解析二维码数据
   */
  parseQRCodeData(data) {
    console.log('🔍 解析二维码数据:', data);
    let updated = false;
    let updates = {};

    // 格式1: JSON格式的二维码
    try {
      const jsonData = JSON.parse(data);
      if (jsonData.apiKey || jsonData.api_key || jsonData.ApiKey) {
        updates.apiKey = jsonData.apiKey || jsonData.api_key || jsonData.ApiKey;
        updated = true;
      }
      if (jsonData.secretKey || jsonData.secret_key || jsonData.SecretKey) {
        updates.secretKey = jsonData.secretKey || jsonData.secret_key || jsonData.SecretKey;
        updated = true;
      }
      if (jsonData.passphrase || jsonData.Passphrase) {
        updates.passphrase = jsonData.passphrase || jsonData.Passphrase;
        updated = true;
      }
      if (jsonData.accountName || jsonData.account_name || jsonData.name) {
        updates.accountName = jsonData.accountName || jsonData.account_name || jsonData.name;
        updated = true;
      }
      if (jsonData.accountType || jsonData.account_type) {
        updates.accountType = jsonData.accountType || jsonData.account_type;
        updated = true;
      }
    } catch (e) {
      // 不是JSON格式，尝试其他格式
    }

    // 格式2: URL参数格式 (例如: okx://api?key=xxx&secret=xxx&pass=xxx)
    if (!updated && data.includes('okx://') || data.includes('key=')) {
      try {
        const url = new URL(data.startsWith('http') ? data : `https://${data}`);
        const params = url.searchParams;

        if (params.has('key') || params.has('apiKey') || params.has('api_key')) {
          updates.apiKey = params.get('key') || params.get('apiKey') || params.get('api_key');
          updated = true;
        }
        if (params.has('secret') || params.has('secretKey') || params.has('secret_key')) {
          updates.secretKey = params.get('secret') || params.get('secretKey') || params.get('secret_key');
          updated = true;
        }
        if (params.has('pass') || params.has('passphrase')) {
          updates.passphrase = params.get('pass') || params.get('passphrase');
          updated = true;
        }
        if (params.has('name') || params.has('accountName')) {
          updates.accountName = params.get('name') || params.get('accountName');
          updated = true;
        }
      } catch (e) {
        // URL解析失败
      }
    }

    // 格式3: Base64编码的数据
    if (!updated) {
      try {
        const decoded = atob(data);
        const jsonMatch = decoded.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const jsonData = JSON.parse(jsonMatch[0]);
          if (jsonData.apiKey || jsonData.api_key) {
            updates.apiKey = jsonData.apiKey || jsonData.api_key;
            updated = true;
          }
          if (jsonData.secretKey || jsonData.secret_key) {
            updates.secretKey = jsonData.secretKey || jsonData.secret_key;
            updated = true;
          }
          if (jsonData.passphrase) {
            updates.passphrase = jsonData.passphrase;
            updated = true;
          }
        }
      } catch (e) {
        // Base64解码失败
      }
    }

    // 格式4: 逗号或分号分隔的简单格式
    if (!updated) {
      const parts = data.split(/[,;]/).map(p => p.trim());
      if (parts.length >= 3) {
        // 尝试识别每个部分
        parts.forEach(part => {
          // API Key: 36位UUID格式
          if (/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(part)) {
            updates.apiKey = part;
            updated = true;
          }
          // Secret Key: 64位十六进制
          else if (/^[a-f0-9]{64}$/i.test(part)) {
            updates.secretKey = part;
            updated = true;
          }
          // Passphrase: 其他字符串
          else if (part.length > 0 && part.length < 100 && !updates.passphrase) {
            updates.passphrase = part;
            updated = true;
          }
        });
      }
    }

    if (updated) {
      this.setData(updates);
      wx.showToast({
        title: '✅ 已识别 ' + Object.keys(updates).length + ' 个字段',
        icon: 'success',
        duration: 2000
      });
      console.log('✅ 二维码解析成功:', updates);
    } else {
      wx.showModal({
        title: '无法识别二维码',
        content: '请确保扫描的是OKX API二维码，或使用"从剪贴板粘贴"功能',
        showCancel: false,
        confirmText: '知道了'
      });
    }
  },

  /**
   * 从剪贴板粘贴所有信息
   */
  async onPasteFromClipboard() {
    try {
      const res = await wx.getClipboardData();
      const text = res.data;

      console.log('📋 剪贴板内容:', text);

      if (!text || text.trim().length === 0) {
        wx.showToast({
          title: '剪贴板为空',
          icon: 'none'
        });
        return;
      }

      // 尝试解析剪贴板内容
      this.parseClipboardContent(text);
    } catch (error) {
      console.error('❌ 读取剪贴板失败:', error);
      wx.showToast({
        title: '读取剪贴板失败',
        icon: 'none'
      });
    }
  },

  /**
   * 解析剪贴板内容
   */
  parseClipboardContent(text) {
    let updated = false;
    let updates = {};

    // 尝试多种格式解析

    // 格式1: JSON格式
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const data = JSON.parse(jsonMatch[0]);
        if (data.apiKey || data.api_key) {
          updates.apiKey = data.apiKey || data.api_key;
          updated = true;
        }
        if (data.secretKey || data.secret_key) {
          updates.secretKey = data.secretKey || data.secret_key;
          updated = true;
        }
        if (data.passphrase) {
          updates.passphrase = data.passphrase;
          updated = true;
        }
        if (data.accountName || data.account_name) {
          updates.accountName = data.accountName || data.account_name;
          updated = true;
        }
      }
    } catch (e) {
      // 不是JSON格式，继续尝试其他格式
    }

    // 格式2: OKX后台格式（键值对，用冒号或等号分隔）
    if (!updated) {
      // 匹配API Key (格式: apikey = "xxx" 或 API Key: xxx 或 API Key=xxx)
      const apiKeyMatch = text.match(/(?:apikey|API\s*Key)\s*[:=]\s*["']?([a-zA-Z0-9-]{36})["']?/i);
      if (apiKeyMatch) {
        updates.apiKey = apiKeyMatch[1];
        updated = true;
      }

      // 匹配Secret Key (格式: secretkey = "xxx" 或 Secret Key: xxx 或 Secret Key=xxx)
      const secretKeyMatch = text.match(/(?:secretkey|Secret\s*Key)\s*[:=]\s*["']?([a-zA-Z0-9]{64})["']?/i);
      if (secretKeyMatch) {
        updates.secretKey = secretKeyMatch[1];
        updated = true;
      }

      // 匹配Passphrase (格式: Passphrase: xxx 或 Passphrase=xxx)
      const passphraseMatch = text.match(/Passphrase\s*[:=]\s*["']?([^\s\n"']+)["']?/i);
      if (passphraseMatch) {
        updates.passphrase = passphraseMatch[1];
        updated = true;
      }

      // 匹配API key name作为账号名称
      const nameMatch = text.match(/API\s+key\s+name\s*[:=]\s*["']?([^"'\n]+)["']?/i);
      if (nameMatch && !updates.accountName) {
        updates.accountName = nameMatch[1].trim();
        updated = true;
      }
    }

    // 格式3: 直接识别特定格式的字符串
    if (!updated) {
      // API Key: 36位UUID格式
      const apiKeyPattern = /\b[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\b/i;
      const apiKeyMatch = text.match(apiKeyPattern);
      if (apiKeyMatch) {
        updates.apiKey = apiKeyMatch[0];
        updated = true;
      }

      // Secret Key: 64位十六进制
      const secretKeyPattern = /\b[a-f0-9]{64}\b/i;
      const secretKeyMatches = text.match(secretKeyPattern);
      if (secretKeyMatches && secretKeyMatches.length > 0) {
        updates.secretKey = secretKeyMatches[0];
        updated = true;
      }

      // 如果有36位UUID格式的API Key，第一个是API Key，第二个64位的是Secret Key
      const allMatches = text.match(/\b[a-f0-9-]{36}\b/gi);
      if (allMatches && allMatches.length >= 2) {
        updates.apiKey = allMatches[0];
        // 查找附近的64位十六进制作为Secret Key
        const secretMatch = text.substr(text.indexOf(allMatches[0]), 200).match(/\b[a-f0-9]{64}\b/i);
        if (secretMatch) {
          updates.secretKey = secretMatch[0];
          updated = true;
        }
      }
    }

    if (updated) {
      this.setData(updates);
      wx.showToast({
        title: '已识别 ' + Object.keys(updates).length + ' 个字段',
        icon: 'success'
      });
      console.log('✅ 解析成功:', updates);
    } else {
      wx.showToast({
        title: '未识别到API信息\n请手动输入',
        icon: 'none',
        duration: 2000
      });
    }
  },

  /**
   * OCR识别截图
   */
  async onOCRScan() {
    try {
      // 选择图片
      const chooseResult = await wx.chooseImage({
        count: 1,
        sizeType: ['original', 'compressed'],
        sourceType: ['album', 'camera']
      });

      const tempFilePaths = chooseResult.tempFilePaths;
      if (!tempFilePaths || tempFilePaths.length === 0) {
        return;
      }

      wx.showLoading({ title: '识别中...' });

      // 使用小程序OCR功能识别图片中的文字
      // 注意：需要先在小程序管理后台开通OCR能力
      try {
        const ocrResult = await wx.ocr.general({
          img: tempFilePaths[0]
        });

        wx.hideLoading();

        if (ocrResult && ocrResult.items) {
          // 提取所有文字
          const fullText = ocrResult.items.map(function(item) {
            return item.text;
          }).join('\n');
          console.log('📷 OCR识别结果:', fullText);

          // 解析识别的文字
          this.parseClipboardContent(fullText);
        } else {
          wx.hideLoading();
          wx.showToast({
            title: 'OCR识别失败\n请手动输入',
            icon: 'none',
            duration: 2000
          });
        }
      } catch (ocrError) {
        wx.hideLoading();
        console.error('❌ OCR识别失败:', ocrError);

        // 如果OCR不可用，提示用户手动输入
        wx.showModal({
          title: 'OCR功能暂不可用',
          content: '请使用"扫描二维码"或"从剪贴板粘贴"功能',
          showCancel: false,
          confirmText: '知道了'
        });
      }
    } catch (error) {
      wx.hideLoading();
      console.error('❌ 选择图片失败:', error);

      if (error.errMsg && error.errMsg.includes('cancel')) {
        // 用户取消选择，不提示
        return;
      }

      wx.showToast({
        title: '选择图片失败',
        icon: 'none'
      });
    }
  },

  /**
   * 单独粘贴API Key
   */
  async onPasteApiKey() {
    try {
      const res = await wx.getClipboardData();
      const text = (res.data && res.data.trim) ? res.data.trim() : '';

      if (text) {
        this.setData({ apiKey: text });
        wx.showToast({
          title: '已粘贴',
          icon: 'success',
          duration: 1000
        });
      }
    } catch (error) {
      console.error('粘贴失败:', error);
    }
  },

  /**
   * 单独粘贴Secret Key
   */
  async onPasteSecretKey() {
    try {
      const res = await wx.getClipboardData();
      const text = (res.data && res.data.trim) ? res.data.trim() : '';

      if (text) {
        this.setData({ secretKey: text });
        wx.showToast({
          title: '已粘贴',
          icon: 'success',
          duration: 1000
        });
      }
    } catch (error) {
      console.error('粘贴失败:', error);
    }
  },

  /**
   * 单独粘贴Passphrase
   */
  async onPastePassphrase() {
    try {
      const res = await wx.getClipboardData();
      const text = (res.data && res.data.trim) ? res.data.trim() : '';

      if (text) {
        this.setData({ passphrase: text });
        wx.showToast({
          title: '已粘贴',
          icon: 'success',
          duration: 1000
        });
      }
    } catch (error) {
      console.error('粘贴失败:', error);
    }
  },

  /**
   * 输入账号名称
   */
  onAccountNameInput(e) {
    this.setData({
      accountName: e.detail.value
    });
  },

  /**
   * 切换账号类型
   */
  onAccountTypeChange(e) {
    this.setData({
      accountType: e.detail.value
    });
  },

  /**
   * 输入标签
   */
  onLabelInput(e) {
    this.setData({
      label: e.detail.value
    });
  },

  /**
   * 输入API Key
   */
  onApiKeyInput(e) {
    this.setData({
      apiKey: e.detail.value
    });
  },

  /**
   * 输入Secret Key
   */
  onSecretKeyInput(e) {
    this.setData({
      secretKey: e.detail.value
    });
  },

  /**
   * 输入Passphrase
   */
  onPassphraseInput(e) {
    this.setData({
      passphrase: e.detail.value
    });
  },

  /**
   * 切换指南显示
   */
  toggleGuide() {
    this.setData({
      showGuide: !this.data.showGuide
    });
  },

  /**
   * 取消
   */
  onCancel() {
    wx.navigateBack();
  },

  /**
   * 保存账号
   */
  async onSave() {
    if (this.data.isEdit) {
      if (!this.data.accountName) {
        wx.showToast({
          title: '请输入账号名称',
          icon: 'none'
        });
        return;
      }

      wx.showLoading({ title: '保存中...' });

      try {
        const res = await API.updateAccount(this.data.accountId, {
          accountName: this.data.accountName,
          label: this.data.label || ''
        });

        if (res.success) {
          wx.hideLoading();
          wx.showToast({
            title: '更新成功',
            icon: 'success'
          });
          setTimeout(() => {
            wx.navigateBack();
          }, 1200);
        } else {
          throw new Error(res.error || '更新失败');
        }
      } catch (error) {
        wx.hideLoading();
        console.error('❌ 更新账号失败:', error);
        wx.showToast({
          title: error.message || '更新失败',
          icon: 'none'
        });
      }
      return;
    }

    // 验证必填字段
    if (!this.data.accountName) {
      wx.showToast({
        title: '请输入账号名称',
        icon: 'none'
      });
      return;
    }

    if (!this.data.apiKey) {
      wx.showToast({
        title: '请输入API Key',
        icon: 'none'
      });
      return;
    }

    if (!this.data.secretKey) {
      wx.showToast({
        title: '请输入Secret Key',
        icon: 'none'
      });
      return;
    }

    if (!this.data.passphrase) {
      wx.showToast({
        title: '请输入Passphrase',
        icon: 'none'
      });
      return;
    }

    wx.showLoading({ title: '保存中...' });

    try {
      console.log('💾 保存OKX账号...');

      const res = await API.addAccount({
        accountName: this.data.accountName,
        accountType: 'real',
        label: this.data.label || null,
        apiKey: this.data.apiKey,
        secretKey: this.data.secretKey,
        passphrase: this.data.passphrase
      });

      if (res.success) {
        wx.hideLoading();

        wx.showToast({
          title: '添加成功',
          icon: 'success'
        });

        setTimeout(() => {
          wx.navigateBack();
        }, 1500);
      } else {
        throw new Error(res.error || '添加失败');
      }
    } catch (error) {
      wx.hideLoading();

      console.error('❌ 添加账号失败:', error);

      wx.showToast({
        title: error.message || '添加失败',
        icon: 'none'
      });
    }
  }
});
