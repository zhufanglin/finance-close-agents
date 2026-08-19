# 财务月结 AI 演示系统 — 生产镜像（已在公网服务器验证通过）
# 构建：docker compose up -d --build（推荐）
#
# 国内构建加速（服务器在国外可去掉）：
#   基础镜像：daemon 配置 registry-mirrors（见 DEPLOY.md）后无需改 FROM
#   npm：--registry=https://registry.npmmirror.com
#   pip：-i https://pypi.tuna.tsinghua.edu.cn/simple

FROM node:20-slim AS base
# Python + RapidOCR 运行库（libxcb/libgl1 是 opencv GUI 版 cv2 需要的，不装则 import 报 libxcb.so.1 缺失）
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 python3-pip ca-certificates libglib2.0-0 libgomp1 \
    libxcb1 libxcb-shm0 libxcb-render0 libxcb-glx0 libxcb-shape0 libx11-6 libgl1 \
    && rm -rf /var/lib/apt/lists/*
# Debian 里 python3 在 /usr/bin（不是 /usr/local/bin，踩坑记录）
ENV OCR_PYTHON=/usr/bin/python3

# ---------- 构建阶段 ----------
FROM base AS builder
WORKDIR /app
COPY package*.json ./
# 构建期内存限制（小内存服务器防 OOM 卡死，配合宿主 swap）
ENV NODE_OPTIONS=--max-old-space-size=1024
RUN npm install --no-audit --no-fund --registry=https://registry.npmmirror.com
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

# 先装 opencv-python-headless 再装 rapidocr（rapidocr 硬依赖 opencv-python GUI 版会覆盖 headless，需要 libxcb 兜底）
RUN pip3 install --break-system-packages -i https://pypi.tuna.tsinghua.edu.cn/simple --no-cache-dir \
    opencv-python-headless rapidocr_onnxruntime

# 拷贝构建产物 + 运行所需
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/public ./public
COPY --from=builder /app/lib ./lib

# 数据目录（SQLite 与上传原图由 compose 挂载到宿主）
RUN mkdir -p /app/data /app/uploads && chmod -R a+rw /app/data /app/uploads

EXPOSE 3000

# 启动：初始化数据库 → 首次灌演示数据（用标记文件避免重启时重置）→ 启动服务
CMD ["sh", "-c", "npx prisma db push --skip-generate --accept-data-loss 2>/dev/null; if [ ! -f /app/.seeded ]; then node prisma/seed.js && touch /app/.seeded; fi; npm run start"]
