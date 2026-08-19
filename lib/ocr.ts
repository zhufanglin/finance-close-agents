import { spawn } from 'child_process';
import path from 'path';

// 本地 RapidOCR（离线、免费）：通过 Python 子进程调用 scripts/ocr.py
// Python 路径优先级：环境变量 OCR_PYTHON > 本机开发 venv > python3 / python
const DEV_VENV = 'C:\\Users\\30290\\.workbuddy\\binaries\\python\\envs\\default\\Scripts\\python.exe';
const PYTHON = process.env.OCR_PYTHON || DEV_VENV;
const SCRIPT = path.join(process.cwd(), 'scripts', 'ocr.py');

export interface OcrLine {
  text: string;
  score: number;
}

export interface OcrResult {
  ok: boolean;
  lines: OcrLine[];
  text: string; // 全文拼接（供 LLM 抽取）
  avgScore: number;
  error?: string;
}

export async function runOcr(imagePath: string, timeoutMs = 60000): Promise<OcrResult> {
  return new Promise((resolve) => {
    const proc = spawn(PYTHON, [SCRIPT, imagePath], { windowsHide: true });
    let out = '';
    let err = '';
    const timer = setTimeout(() => {
      proc.kill();
      resolve({ ok: false, lines: [], text: '', avgScore: 0, error: 'OCR 超时' });
    }, timeoutMs);

    proc.stdout.on('data', (d) => (out += d));
    proc.stderr.on('data', (d) => (err += d));
    proc.on('close', () => {
      clearTimeout(timer);
      try {
        const j = JSON.parse(out.trim().split('\n').pop() || '{}');
        if (!j.ok) throw new Error(j.error || 'OCR 引擎异常');
        const lines: OcrLine[] = j.lines || [];
        resolve({
          ok: true,
          lines,
          text: lines.map((l) => l.text).join('\n'),
          avgScore: lines.length ? lines.reduce((a, b) => a + b.score, 0) / lines.length : 0,
        });
      } catch (e) {
        resolve({
          ok: false,
          lines: [],
          text: '',
          avgScore: 0,
          error: `OCR 失败: ${e instanceof Error ? e.message : String(e)}${err ? ` | ${err.slice(-200)}` : ''}`,
        });
      }
    });
  });
}
