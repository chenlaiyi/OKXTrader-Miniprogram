# 微信开发者工具配置指南

## 问题诊断

小程序无法访问的原因：项目使用 TypeScript (.ts) 和 Less (.less) 源文件，但微信开发者工具默认只识别 .js 和 .wxss 文件。

## 解决方案

### 方式1：在微信开发者工具中启用 TypeScript 和 Less 支持（推荐）

1. **打开微信开发者工具**

2. **导入项目**
   - 项目目录：`/Users/chenlaiyi/Oyi/OKly-program/miniprogram`
   - AppID：使用测试号或填入 `wxc54ef555c258bbf6`

3. **启用 TypeScript 编译**
   - 点击右上角「详情」
   - 找到「本地设置」
   - 勾选 ✅ **「使用 npm 模块」**
   - 勾选 ✅ **「增强编译」**
   - 勾选 ✅ **「使用 TypeScript」**
   - 勾选 ✅ **「自动补全 TypeScript 类型」**

4. **启用 Less 支持**
   - 在「本地设置」中
   - 确保勾选 ✅ **「使用 CSS 扩展」**（支持 Less）

5. **关闭 URL 校验（开发阶段）**
   - 在「本地设置」中
   - 取消勾选 ❌ **「不校验合法域名、web-view（业务域名）、TLS 版本以及 HTTPS 证书」**

6. **重启编译**
   - 按 `Cmd + S` 保存所有文件
   - 点击「工具」→「编译」或按 `Cmd + B`
   - 等待编译完成

### 方式2：手动编译 TypeScript 和 Less 文件

如果方式1不起作用，可以手动编译：

```bash
cd /Users/chenlaiyi/Oyi/OKly-program

# 安装依赖
npm install

# 编译 TypeScript
npx tsc --project tsconfig.json

# 将 .less 文件转换为 .wxss（需要安装 less）
npm install -g less
cd miniprogram
# 编译所有 .less 文件为 .wxss
for file in $(find . -name "*.less"); do
  lessc $file ${file%.less}.wxss
done
```

### 方式3：暂时移除 .js 和 .wxss 文件

让微信开发者工具自动编译 TypeScript 和 Less：

```bash
cd /Users/chenlaiyi/Oyi/OKly-program/miniprogram

# 备份现有的 .js 和 .wxss 文件
mkdir -p .backup
find . -name "*.js" -type f -exec mv {} .backup/ \; 2>/dev/null || true
find . -name "*.wxss" -type f -exec mv {} .backup/ \; 2>/dev/null || true
```

然后重启微信开发者工具，它会自动编译 .ts 和 .less 文件。

## 验证步骤

1. 打开微信开发者工具控制台（按 F12）
2. 查看是否有编译错误
3. 检查首页是否能正常加载数据
4. 检查网络请求是否正常发送到 `https://ly.ddg.org.cn/api`

## 常见问题

### Q: 提示 "module 'miniprogram_npm' not found"
A: 需要构建 npm 包：
- 点击「工具」→「构建 npm」

### Q: TypeScript 类型错误
A: 暂时可以忽略，或在 tsconfig.json 中降低检查级别：
```json
{
  "compilerOptions": {
    "strict": false,
    "noImplicitAny": false
  }
}
```

### Q: Less 样式不生效
A: 检查「本地设置」中是否勾选了「使用 CSS 扩展」

### Q: 网络请求失败
A:
1. 确保「详情」→「本地设置」中关闭了 URL 校验
2. 检查网络连接
3. 查看控制台的具体错误信息

## API 配置

小程序会自动调用以下 API：
- 基础URL: `https://ly.ddg.org.cn/api`
- WebSocket: `wss://ly.ddg.org.cn`

如需修改，请编辑 `miniprogram/utils/config.ts` 中的 `CONFIG` 对象。

## 调试技巧

1. **查看日志**
   - 打开控制台（Console）
   - 查看所有 console.log 输出

2. **网络调试**
   - 切换到「Network」标签
   - 查看 API 请求和响应

3. **页面调试**
   - 切换到「AppData」标签
   - 查看页面数据状态

4. **源码调试**
   - 打开「Sources」标签
   - 可以直接断点调试 TypeScript 源码

## 联系支持

如果遇到其他问题，请查看：
- [微信小程序官方文档](https://developers.weixin.qq.com/miniprogram/dev/framework/)
- [TypeScript 官方文档](https://www.typescriptlang.org/docs/)
- 项目 Issues: https://github.com/chenlaiyi/OKXTrader-Miniprogram/issues
