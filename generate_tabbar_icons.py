#!/usr/bin/env python3
"""
生成微信小程序 tabBar 图标
需要安装: pip install Pillow
"""

try:
    from PIL import Image, ImageDraw, ImageFont
    print("✅ Pillow 已安装")
except ImportError:
    print("❌ 请先安装 Pillow: pip install Pillow")
    exit(1)

import os

def create_simple_icon(color, output_path, text):
    """创建简单的文字图标"""
    size = 81
    img = Image.new('RGBA', (size, size), (255, 255, 255, 0))
    draw = ImageDraw.Draw(img)

    # 绘制文字（居中）
    try:
        # 尝试使用系统字体
        font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 40)
        bbox = draw.textbbox((0, 0), text, font=font)
        text_width = bbox[2] - bbox[0]
        text_height = bbox[3] - bbox[1]
        position = ((size - text_width) // 2, (size - text_height) // 2 - 3)
        draw.text(position, text, fill=color, font=font)
    except Exception as e:
        try:
            font = ImageFont.load_default()
            bbox = draw.textbbox((0, 0), text, font=font)
            text_width = bbox[2] - bbox[0]
            text_height = bbox[3] - bbox[1]
            position = ((size - text_width) // 2, (size - text_height) // 2 - 3)
            draw.text(position, text, fill=color, font=font)
        except:
            # 最后的备选方案：画圆圈
            draw.ellipse([25, 25, 55, 55], fill=color)

    img.save(output_path)
    print(f"✅ 已创建: {os.path.basename(output_path)}")

def main():
    base_dir = "/Users/chenlaiyi/Oyi/OKly-program/miniprogram/images/tabbar"
    os.makedirs(base_dir, exist_ok=True)

    # 图标配置：名称、文字（单个字符）
    icons = [
        ("market", "📊"),
        ("trading", "💱"),
        ("ai", "🧠"),
        ("account", "👤"),
    ]

    gray = "#8e8e93"      # iOS 未选中颜色
    blue = "#007aff"      # iOS 选中颜色（蓝色）

    print("开始生成 tabBar 图标...\n")

    for icon_name, emoji in icons:
        # 未选中状态（灰色）
        create_simple_icon(
            gray,
            os.path.join(base_dir, f"{icon_name}.png"),
            emoji
        )

        # 选中状态（蓝色）
        create_simple_icon(
            blue,
            os.path.join(base_dir, f"{icon_name}-active.png"),
            emoji
        )

    print(f"\n✅ 所有图标已生成到: {base_dir}")
    print("\n生成的图标文件:")
    for f in sorted(os.listdir(base_dir)):
        if f.endswith('.png'):
            print(f"  - {f}")

if __name__ == "__main__":
    main()
