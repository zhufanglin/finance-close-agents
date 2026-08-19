#!/bin/bash
# 服务器端部署脚本（step4：修复 OCR_PYTHON 路径 + opencv-headless，重建）
set -e
cd /opt/finance-ai

echo "== 1. 修 Dockerfile =="
# python3 实际路径在 /usr/bin，且补 opencv 运行库
sed -i 's#ENV OCR_PYTHON=/usr/local/bin/python3#ENV OCR_PYTHON=/usr/bin/python3#' Dockerfile
sed -i 's#python3 python3-pip python3-venv ca-certificates#python3 python3-pip ca-certificates libglib2.0-0 libgomp1#' Dockerfile
sed -i 's#pip3 install --break-system-packages -i https://pypi.tuna.tsinghua.edu.cn/simple --no-cache-dir rapidocr_onnxruntime#pip3 install --break-system-packages -i https://pypi.tuna.tsinghua.edu.cn/simple --no-cache-dir opencv-python-headless rapidocr_onnxruntime#' Dockerfile
grep -nE 'OCR_PYTHON|libglib|opencv' Dockerfile

echo "== 2. 重建并拉起 =="
rm -f build.log
setsid nohup docker compose up -d --build > build.log 2>&1 < /dev/null &
echo "build started pid=$!"
