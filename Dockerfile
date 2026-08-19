# 财务月结 AI 演示系统 — 生产镜像
# 构建：docker build -t finance-ai-demo .
# 运行：docker compose up -d（推荐）

FROM node:20-slim AS base
# 安装 Python + RapidOCR 依赖（OCR 通道需要）
RUN apt-get update && apt-get install -y --no-install-recommends python3 python3-pip python3-venv ca-certificates \
    && rm -rf /var/lib/apt/lists/*
ENV OCR_PYTHON=/usr/local/bin/python3

# ---------- 构建阶段 ----------
FROM base AS builder
WORKDIR /app
COPY package*.json ./
# 用 npm ci 前先生成锁文件缺失时兜底
RUN npm install --no-audit --no-fund 2>/dev/null || npm install
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npx prisma generate && npm run build

# ---------- 运行阶段 ----------
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# 系统级安装 rapidocr（在运行时层装，体积放这里以便缓存）
RUN pip3 install --no-cache-dir rapidocr_onnxruntime

# 拷贝构建产物 + 运行所需
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/public ./public
COPY --from=builder /app/lib ./lib

# 持久化目录（SQLite 数据库 / 上传的发票原图）
RUN mkdir -p /app/uploads /app/prisma && chmod -R a+rw /app/uploads

EXPOSE 3000

# 启动：初始化数据库 → 首次灌演示数据（用标记文件避免重启时重置）→ 启动服务
CMD ["sh", "-c", "npx prisma db push --skip-generate --accept-data-loss 2>/dev/null; if [ ! -f /app/.seeded ]; then node prisma/seed.js && touch /app/.seeded; fi; npm run start"]
