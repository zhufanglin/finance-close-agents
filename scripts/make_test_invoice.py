# -*- coding: utf-8 -*-
"""生成一张测试发票图片（供 RapidOCR + DeepSeek 全链路验证）"""
from PIL import Image, ImageDraw, ImageFont
import os

W, H = 900, 560
img = Image.new("RGB", (W, H), "white")
d = ImageDraw.Draw(img)

font_path = r"C:\Windows\Fonts\msyh.ttc"
f_title = ImageFont.truetype(font_path, 34)
f_head = ImageFont.truetype(font_path, 20)
f_body = ImageFont.truetype(font_path, 19)

# 标题
d.text((W//2, 30), "深圳增值税电子普通发票", font=f_title, fill="#8c2b1f", anchor="ma")

# 表头
d.text((50, 110), "发票号码：25617000000123456789", font=f_head, fill="black")
d.text((50, 145), "开票日期：2026年07月22日", font=f_head, fill="black")
d.text((560, 110), "机器编号：499000000000", font=f_head, fill="black")

# 购销方
d.text((50, 200), "购买方：深圳市宏图电子科技有限公司", font=f_body, fill="black")
d.text((50, 235), "销  方：广州云启办公设备有限公司", font=f_body, fill="black")

# 明细表
d.rectangle([45, 290, W-45, 420], outline="#333333", width=2)
d.line([45, 345, W-45, 345], fill="#333333", width=1)
d.text((60, 300), "货物或应税劳务名称", font=f_body, fill="black")
d.text((400, 300), "金额", font=f_body, fill="black")
d.text((600, 300), "税率", font=f_body, fill="black")
d.text((730, 300), "税额", font=f_body, fill="black")
d.text((60, 360), "*办公设备*激光打印机", font=f_body, fill="black")
d.text((400, 360), "3,539.82", font=f_body, fill="black")
d.text((600, 360), "13%", font=f_body, fill="black")
d.text((730, 360), "460.18", font=f_body, fill="black")

# 合计
d.text((50, 445), "价税合计（小写）￥4,000.00", font=f_head, fill="black")
d.text((50, 480), "价税合计（大写）肆仟元整", font=f_head, fill="black")
d.text((50, 515), "收款人：测试  复核：测试  开票人：测试", font=f_body, fill="black")

out = os.path.join(os.path.dirname(__file__), "test_invoice.png")
img.save(out)
print("saved:", out)
