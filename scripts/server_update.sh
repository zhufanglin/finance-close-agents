#!/bin/bash
# 服务器更新脚本：同步代码 → 重新应用本地配置 → 后台重建
set -e
cd /opt/finance-ai

echo "== 1. 暂存本地修改 =="
git stash -q 2>/dev/null || true

echo "== 2. 拉取最新代码 =="
git pull -q 2>&1 | tail -1
git log --oneline -1

echo "== 3. 重新应用本地配置 =="
# 端口 3100（3000 被 puiying 占用）
grep -q '3100:3000' docker-compose.yml || sed -i 's#- "3000:3000"#- "3100:3000"#' docker-compose.yml
# 容器内存上限
grep -q 'mem_limit' docker-compose.yml || sed -i '/container_name: finance-ai-demo/a\    mem_limit: 512m' docker-compose.yml
# 构建内存限制
grep -q 'NODE_OPTIONS' Dockerfile || sed -i '/^RUN npm install/a ENV NODE_OPTIONS=--max-old-space-size=1024' Dockerfile
grep -n '3100:3000\|mem_limit\|NODE_OPTIONS' docker-compose.yml Dockerfile | head -5
echo "本地配置已应用"

echo "== 4. 清理 stash =="
git stash drop -q 2>/dev/null || true

echo "== 5. 启动后台重建（systemd 隔离，SSH 断开不杀） =="
systemd-run --unit=finance-rebuild --collect bash -c 'cd /opt/finance-ai && docker compose up -d --build > build.log 2>&1'
sleep 3
systemctl is-active finance-rebuild
echo "构建已启动"
