import type { RunRequestPayload, TestCaseResult } from '../type';
import { runCode } from '../services/runCode';

// 単一ワーカー：言語に応じて中でC#/TSランナーを呼ぶ
export async function runJob(
    req: RunRequestPayload,
    onProgress: (p: number, m?: string) => void
): Promise<Readonly<TestCaseResult[]>> {
    return runCode(req, onProgress);
}
