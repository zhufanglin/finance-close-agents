# 财务月结 AI 演示系统 — 公网部署指南

系统是 Next.js 全栈应用（SQLite + DeepSeek API + 本地 RapidOCR），需要 **Docker 环境**的云服务器。按本文档可在 10 分钟内完成部署。

## 一、准备云服务器

- 推荐：腾讯云/阿里云**轻量应用服务器**（2核4G 即可，约 ¥50-100/月），系统选 **Ubuntu 22.04**
- 安全组放行 **TCP 3000** 端口（或你改的端口）
- 服务器上安装 Docker：

```bash
curl -fsSL https://get.docker.com | sh
sudo systemctl enable docker && sudo systemctl start docker
```

## 二、拉取代码并配置

```bash
# 服务器上执行
sudo apt install -y git
git clone https://github.com/zhufanglin/finance-close-agents.git finance-ai
cd finance-ai

# 配置环境变量（DeepSeek Key 必填，其他可默认）
cat > .env << 'EOF'
DEEPSEEK_API_KEY=sk-你的Key
DEEPSEEK_MODEL=deepseek-chat
DEMO_ADMIN_PASSWORD=admin123
EOF
```

> 若服务器在国内且拉取 GitHub 慢，可用镜像：
> `git clone https://ghfast.top/https://github.com/zhufanglin/finance-close-agents.git`

## 三、构建并启动

```bash
# 首次构建约 5-10 分钟（要装 Python + RapidOCR 模型）
docker compose up -d --build

# 查看状态与日志
docker compose ps
docker compose logs -f --tail=50
```

## 四、验证与访问

- 本机验证：`curl http://localhost:3000/login`
- 公网访问：`http://<服务器公网IP>:3000`，账号 `admin` / `admin123`
- 测试 OCR：登录 → 发票中心 → 上传 `scripts/test_invoice.png`（构建时已打入镜像）

## 五、常见问题

| 问题 | 处理 |
|---|---|
| 公网打不开 | 检查安全组/防火墙是否放行 3000 端口 |
| OCR 识别失败 | 看日志 `docker compose logs app`，确认 rapidocr_onnxruntime 安装成功 |
| DeepSeek 报错 | 检查 .env 的 Key 是否填对，`docker compose restart app` 生效 |
| 想重置演示数据 | `docker compose exec app rm -f /app/.seeded /app/prisma/dev.db && docker compose restart app` |
| 想用域名 | 服务器装 Nginx/Caddy 反代 3000 端口，Caddy 自动配 HTTPS |

## 六、数据持久化

- SQLite 数据库 → 宿主目录 `./data/dev.db`
- 上传的发票原图 → 宿主目录 `./uploads/`
- 容器删除/升级不丢数据（`docker compose down` 后 `up` 即可）

## 七、安全建议（演示系统）

- 上线后建议**修改 admin 密码**（设置页或改 .env 的 DEMO_ADMIN_PASSWORD）
- 若长期使用，套一层 HTTPS（Caddy 反代最省事）
- 该项目是演示定位，仅包含种子演示数据，勿存真实财务数据
