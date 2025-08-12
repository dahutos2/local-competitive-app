import path from 'path';
import fs from 'fs';
import { executeCommand } from '../core/exec';
import { normalizeOutput } from '../core/output';
import { CommandError, type TestCase, type TestCaseResult } from '../type';
import { Paths } from '../core/state';

export async function runTypescript(
    code: string,
    testCases: TestCase[],
    userId: string,
    onProgress?: (p: number, m?: string) => void
): Promise<TestCaseResult[]> {
    const tsFilePath = path.join(Paths.tempDir, `temp_${userId}.ts`);
    const jsFilePath = path.join(Paths.tempDir, `temp_${userId}.js`);

    onProgress?.(5, 'TS 準備');
    fs.writeFileSync(tsFilePath, code, 'utf8');

    onProgress?.(20, 'コンパイル中');
    try {
        const compileResult = await executeCommand('tsc', [tsFilePath, '--outDir', Paths.tempDir], Paths.tempDir);
        if (compileResult.stderr) {
            console.warn(`TypeScript warnings for user ${userId}: ${compileResult.stderr}`);
        }
    } catch (compileErr) {
        const e = compileErr as CommandError | Error;
        const stderr = (e as CommandError)?.stderr ?? '';
        const stdout = (e as CommandError)?.stdout ?? '';
        onProgress?.(100, 'コンパイル失敗');

        const output = e instanceof Error ? e.message : String(e)
        console.error(`TSコンパイルエラー for user ${userId}: ${output}\nstderr: ${stderr}\nstdout: ${stdout}`);

        // ✅ コンパイル失敗は「テスト結果1件（error）」として返す
        const compileError: TestCaseResult = {
            input: '(compile)',
            expectedOutput: '',
            actualOutput: `【コンパイルエラー】\n${output}\n\n--- stderr ---\n${stderr}\n\n--- stdout ---\n${stdout}`,
            status: 'error',
            isPublic: true,
        };
        return [compileError];
    }

    onProgress?.(30, 'テスト実行開始');
    const total = testCases.length || 1;
    const startBase = 30;
    const span = 70;

    const results = await Promise.all(testCases.map(async (tc, idx) => {
        onProgress?.(Math.min(99, Math.round(startBase + (span * idx) / total)), `テスト ${idx + 1}/${total} 実行中`);
        try {
            const runResult = await executeCommand('node', [jsFilePath], Paths.tempDir, tc.input, { enableTimeout: true });
            const output = runResult.stdout;
            const success = normalizeOutput(output) === normalizeOutput(tc.output);
            return {
                input: tc.input,
                expectedOutput: tc.output,
                actualOutput: output,
                status: success ? 'success' : 'failure',
                isPublic: tc.isPublic,
            } as TestCaseResult;
        } catch (runErr: any) {
            const e = runErr as CommandError | Error;
            const stderr = (e as CommandError)?.stderr ?? '';
            const stdout = (e as CommandError)?.stdout ?? '';
            const output = e instanceof Error ? e.message : String(e)
            console.error(`TS実行エラー for user ${userId}: ${output}\nstderr: ${stderr}\nstdout: ${stdout}`);
            return {
                input: tc.input,
                expectedOutput: tc.output,
                actualOutput: `【実行エラー】\n${output}\n\n--- stderr ---\n${stderr}\n\n--- stdout ---\n${stdout}`,
                status: 'error',
                isPublic: tc.isPublic,
            } as TestCaseResult;
        }
    }));

    onProgress?.(100, '完了');
    return results;
}
