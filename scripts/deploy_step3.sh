#!/bin/bash
# 服务器端部署脚本（step3：修复数据库卷挂载并重启容器）
set -e
cd /opt/finance-ai

echo "== 1. 停容器（保留镜像缓存） =="
docker compose down 2>&1 | tail -2 || true

echo "== 2. 清理误建的目录（dev.db 被 docker 创建成目录） =="
rm -rf ./data
mkdir -p ./data ./uploads

echo "== 3. compose 改为目录挂载 + DATABASE_URL =="
cat > docker-compose.yml << 'YAML'
services:
  app:
    build: .
    image: finance-ai-demo:latest
    container_name: finance-ai-demo
    restart: unless-stopped
    ports:
      - "3100:3000"
    environment:
      - DEEPSEEK_API_KEY=${DEEPSEEK_API_KEY:-sk-请填入你的Key}
      - DEEPSEEK_MODEL=${DEEPSEEK_MODEL:-deepseek-chat}
      - OCR_PYTHON=/usr/local/bin/python3
      - DATABASE_URL=file:/app/data/dev.db
      - DEMO_ADMIN_PASSWORD=${DEMO_ADMIN_PASSWORD:-admin123}
    volumes:
      - ./data:/app/data
      - ./uploads:/app/uploads
    healthcheck:
      test: ["CMD", "curl", "-sf", "http://localhost:3000/login"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 20s
YAML
echo "compose 已更新：$(grep -c 'DATABASE_URL' docker-compose.yml) 处环境变量"

echo "== 4. 重新拉起容器 =="
docker compose up -d 2>&1 | tail -2
sleep 10
docker ps --format '{{.Names}} | {{.Status}}' | grep finance
echo "== 5. 日志 =="
docker logs finance-ai-demo --tail 8 2>&1
