import { NextResponse } from 'next/server';
import { triggerDegradeDemo } from '@/lib/llm';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';

// 安全与降级演示：故意触发 DeepSeek 超时，看降级到规则引擎全过程
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: '未登录' }, { status: 401 });

  const demo = await triggerDegradeDemo();

  // 取最近这条降级记录回显
  const latest = await prisma.aiCallLog.findFirst({
    where: { degraded: true },
    orderBy: { id: 'desc' },
  });

  // 同时回放大额报销被规则拦截的案例
  const blockedExample = {
    scenario: '费用报销 ¥12,800（>5000）',
    rule: '大额报销需总监加签，禁止直接通过',
    httpStatus: 400,
    response: { error: '该报销金额超过 5000 元，需总监加签后方可通过' },
    point: '规则优先于 AI：即使 AI 给出了科目建议，规则仍能拦截审批',
  };

  return NextResponse.json({
    degradeDemo: demo,
    latestLog: latest,
    ruleBlockExample: blockedExample,
  });
}
