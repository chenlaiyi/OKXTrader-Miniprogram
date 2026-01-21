# TabBar 图标说明

## 需要的图标

微信小程序 tabBar 需要以下图标（每个选项2个状态）：

### 1. 首页 (home)
- `images/tabbar/home.png` - 未选中状态（灰色）
- `images/tabbar/home-active.png` - 选中状态（蓝色）

### 2. 交易 (trade)
- `images/tabbar/trade.png` - 未选中状态（灰色）
- `images/tabbar/trade-active.png` - 选中状态（蓝色）

### 3. 行情 (market)
- `images/tabbar/market.png` - 未选中状态（灰色）
- `images/tabbar/market-active.png` - 选中状态（蓝色）

### 4. AI分析 (ai)
- `images/tabbar/ai.png` - 未选中状态（灰色）
- `images/tabbar/ai-active.png` - 选中状态（蓝色）

### 5. 监控 (monitor)
- `images/tabbar/monitor.png` - 未选中状态（灰色）
- `images/tabbar/monitor-active.png` - 选中状态（蓝色）

## 图标要求

- **尺寸**: 81px * 81px (推荐)
- **格式**: PNG
- **颜色**:
  - 未选中: `#9e9e9e` (灰色)
  - 选中: `#667eea` (蓝色)
- **大小**: 不超过 40kb

## 获取图标的方式

### 方式1: 使用图标库

推荐使用以下图标库：
- [IconFont](https://www.iconfont.cn/)
- [IconPark](https://iconpark.oceanengine.com/)
- [Font Awesome](https://fontawesome.com/)

搜索关键词：home, trade, chart, robot, monitor

### 方式2: 在线生成

使用以下工具生成简单图标：
- [Canva](https://www.canva.com/)
- [Figma](https://www.figma.com/)
- [Sketch](https://www.sketch.com/)

### 方式3: 使用WeUI图标

微信官方 WeUI 提供了一套免费图标：
- 下载: https://github.com/Tencent/weui-wxss

### 方式4: 临时解决方案

如果暂时没有图标，可以：

**选项A**: 移除图标配置，只保留文字
```json
{
  "pagePath": "pages/index/index",
  "text": "首页"
}
```

**选项B**: 使用纯色图标（开发工具生成）

## 生成纯色图标脚本

使用 Python 生成简单的纯色图标：

```python
from PIL import Image, ImageDraw, ImageFont

def create_icon(color, output_path, icon_type):
    # 创建81x81的图像
    img = Image.new('RGBA', (81, 81), (255, 255, 255, 0))
    draw = ImageDraw.Draw(img)

    # 简单图标
    if icon_type == 'home':
        # 房子图标
        draw.polygon([(40, 20), (10, 45), (70, 45)], fill=color)
        draw.rectangle([20, 45, 60, 70], fill=color)
    elif icon_type == 'trade':
        # 交易图标（箭头上下）
        draw.polygon([(40, 15), (30, 30), (50, 30)], fill=color)
        draw.polygon([(40, 65), (30, 50), (50, 50)], fill=color)
        draw.rectangle([35, 30, 45, 50], fill=color)
    elif icon_type == 'market':
        # 折线图
        draw.line([(15, 50), (30, 35), (45, 45), (65, 25)], fill=color, width=3)
        draw.circle((15, 50), 3, fill=color)
        draw.circle((30, 35), 3, fill=color)
        draw.circle((45, 45), 3, fill=color)
        draw.circle((65, 25), 3, fill=color)
    elif icon_type == 'ai':
        # 机器人
        draw.rectangle([25, 30, 55, 55], outline=color, width=2)
        draw.circle([40, 40], 5, fill=color)
        draw.circle([48, 40], 5, fill=color)
        draw.rectangle([30, 20, 50, 25], fill=color)
    elif icon_type == 'monitor':
        # 监控器
        draw.rectangle([15, 25, 65, 55], outline=color, width=2)
        draw.line([(15, 55), (25, 65)], fill=color, width=2)
        draw.line([(65, 55), (55, 65)], fill=color, width=2)
        draw.line([(25, 65), (55, 65)], fill=color, width=2)

    img.save(output_path)

# 生成所有图标
types = ['home', 'trade', 'market', 'ai', 'monitor']
for icon_type in types:
    create_icon('#9e9e9e', f'images/tabbar/{icon_type}.png', icon_type)
    create_icon('#667eea', f'images/tabbar/{icon_type}-active.png', icon_type)
```

## 当前状态

✅ app.json 已配置图标路径
❌ 图标文件尚未创建

## 下一步

1. 选择一种方式获取图标
2. 将图标放到 `images/tabbar/` 目录
3. 重新编译小程序
4. 确认底部 tabBar 显示图标

## 注意事项

- 图标必须是本地文件，不能使用网络图片
- 不要使用过大的图片（< 40kb）
- 图标颜色建议使用透明背景的 PNG
- 确保图标在深色背景下可见
