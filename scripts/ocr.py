# -*- coding: utf-8 -*-
"""RapidOCR 离线票据识别：输入图片路径，输出 JSON 文本块"""
import sys
import json

def main():
    img_path = sys.argv[1]
    try:
        from rapidocr_onnxruntime import RapidOCR
        engine = RapidOCR()
        result, _ = engine(img_path)
        lines = []
        for item in (result or []):
            # item: [box, text, score]
            if item and len(item) >= 3:
                lines.append({"text": str(item[1]), "score": round(float(item[2]), 4)})
        print(json.dumps({"ok": True, "lines": lines}, ensure_ascii=False))
    except Exception as e:
        print(json.dumps({"ok": False, "error": str(e)}, ensure_ascii=False))

if __name__ == "__main__":
    main()
