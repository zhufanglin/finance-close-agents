#!/bin/bash
# 服务器端部署脚本（step2：启动 docker compose 构建）
cd /opt/finance-ai
rm -f build.log
setsid nohup docker compose up -d --build > build.log 2>&1 < /dev/null &
echo "build started, pid=$!"
sleep 5
ps aux | grep -c '[d]ocker compose'
