import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';

// 系统设置：账号、集成状态、运行环境（演示系统只读展示）
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: '未登录' }, { status: 401 });

  const users = await prisma.user.findMany({
    select: { username: true, name: true, role: true, createdAt: true },
    orderBy: { id: 'asc' },
  });

  // OCR 引擎探测：优先 OCR_PYTHON 环境变量（Docker/服务器用 /usr/bin/python3），本地开发回退本机 venv
  const venvPython =
    process.env.OCR_PYTHON ||
    'C:\\Users\\30290\\.workbuddy\\binaries\\python\\envs\\default\\Scripts\\python.exe';
  let ocrReady = false;
  try { await fs.access(venvPython); ocrReady = true; } catch { /* not found */ }

  const integrations = [
    {
      key: 'deepseek', name: 'DeepSeek 云 API', enabled: !!process.env.DEEPSEEK_API_KEY,
      detail: process.env.DEEPSEEK_API_KEY
        ? `模型 ${process.env.DEEPSEEK_MODEL || 'deepseek-chat'} · 发票抽取 / 差异解释 / 流水分类 / 报销科目建议`
        : '未配置 DEEPSEEK_API_KEY，AI 功能将以规则模式降级运行',
    },
    {
      key: 'ocr', name: 'RapidOCR（本地离线）', enabled: ocrReady,
      detail: ocrReady ? '本地 venv 就绪 · 发票影像文字识别，不出内网' : 'venv 未找到，图片上传通道不可用',
    },
    {
      key: 'eticket', name: '数电票 XML/OFD 直解析', enabled: true,
      detail: '全电发票结构化文件免 OCR 直读，字段 100% 准确',
    },
    {
      key: 'bank', name: '银行流水导入（CSV/Excel）', enabled: true,
      detail: '银企直联平替通道：万能表头映射 + 借贷双列兼容 + bankRef 去重',
    },
  ];

  return NextResponse.json({
    users,
    integrations,
    current: session,
    env: {
      node: process.version,
      platform: `${process.platform} ${process.arch}`,
      db: 'SQLite (Prisma)',
      period: '2026-07 月结期间',
    },
  });
}
