#!/bin/bash
# 服务器端部署脚本（step1：预拉镜像 + 改 FROM + 启动构建）
set -e

cd /opt/finance-ai

echo "== 1. 停掉残留构建 =="
pkill -f 'docker compose up' 2>/dev/null || true
pkill -f buildkit 2>/dev/null || true
sleep 2

echo "== 2. FROM 改回标准名（复用本地缓存镜像） =="
sed -i 's#^FROM docker\.1ms\.run/library/node:20-slim AS base#FROM node:20-slim AS base#' Dockerfile
grep '^FROM' Dockerfile

echo "== 3. 后台预拉 node:20-slim（走 daemon 双镜像站） =="
setsid nohup docker pull node:20-slim > pull.log 2>&1 < /dev/null &
echo "pull started (pid $!)"
