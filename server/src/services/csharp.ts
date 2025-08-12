import path from 'path';
import fs from 'fs';
import { executeCommand } from '../core/exec';
import { normalizeOutput } from '../core/output';
import { CommandError, type TestCase, type TestCaseResult } from '../type';
import { Paths } from '../core/state';

/**
 * C# コンソールアプリ雛形生成
 */
async function initializeCsProject(projectDir: string, userId: string): Promise<void> {
    try {
        await executeCommand('dotnet', ['new', 'console', '-o', `Project_${userId}`], path.dirname(projectDir));
    } catch (error: any) {
        const output = error?.message ?? String(error)
        console.error(`C#プロジェクトの初期化エラー for user ${userId}: ${output}`);
    }
}

/**
 * ビルド（失敗時は CommandError）
 */
async function buildCsProject(projectDir: string, userId: string): Promise<{ stdout: string; stderr: string }> {
    const r = await executeCommand('dotnet', ['build', '--no-restore', '--nologo', '-c', 'Release'], projectDir);
    if (r.stderr) console.warn(`Build stderr for user ${userId}: ${r.stderr}`);
    return r;
}

/**
 * 実行（失敗時は CommandError）
 */
async function runCsProject(projectDir: string, userId: string, input: string): Promise<{ stdout: string; stderr: string }> {
    const projectFilePath = path.join(projectDir, `Project_${userId}.csproj`);
    const args = ['run', '--no-restore', '--nologo', '--no-build', '-c', 'Release', '--project', projectFilePath];
    return executeCommand('dotnet', args, projectDir, input, { enableTimeout: true });
}

/**
 * C# のコードをビルド → テスト入力ごとに実行
 * ここで **ビルドエラーをテスト結果1件として返却** するのがポイント
 */
export async function runCsharp(
    code: string,
    testCases: TestCase[],
    userId: string,
    onProgress?: (p: number, m?: string) => void
): Promise<TestCaseResult[]> {
    const projectDir = path.join(Paths.tempDir, `Project_${userId}`);
    onProgress?.(5, 'C# プロジェクト準備');

    if (!fs.existsSync(projectDir)) {
        await initializeCsProject(projectDir, userId);
    }

    onProgress?.(10, 'ソース配置');
    const programCsPath = path.join(projectDir, 'Program.cs');
    fs.writeFileSync(programCsPath, code, 'utf8');

    onProgress?.(20, 'ビルド中');
    try {
        await buildCsProject(projectDir, userId);
    } catch (buildErr) {
        const e = buildErr as CommandError | Error;
        const stderr = (e as CommandError)?.stderr ?? '';
        const stdout = (e as CommandError)?.stdout ?? '';
        onProgress?.(100, 'ビルド失敗');

        const output = e instanceof Error ? e.message : String(e)
        console.error(`C#ビルドエラー for user ${userId}: ${output}\nstderr: ${stderr}\nstdout: ${stdout}`);

        // ✅ ビルド失敗は「テスト結果1件（error）」として返す
        const buildError: TestCaseResult = {
            input: '(build)',
            expectedOutput: '',
            actualOutput: `【ビルドエラー】\n${output}\n\n--- stderr ---\n${stderr}\n\n--- stdout ---\n${stdout}`,
            status: 'error',
            isPublic: true,
        };
        return [buildError];
    }

    onProgress?.(30, 'テスト実行開始');
    const total = testCases.length || 1;
    const startBase = 30;
    const span = 70;

    const results = await Promise.all(testCases.map(async (tc, idx) => {
        onProgress?.(Math.min(99, Math.round(startBase + (span * idx) / total)), `テスト ${idx + 1}/${total} 実行中`);
        try {
            const { stdout, stderr } = await runCsProject(projectDir, userId, tc.input);
            if (stderr) console.error(`Run stderr for user ${userId}: ${stderr}`);
            const success = normalizeOutput(stdout) === normalizeOutput(tc.output);
            return {
                input: tc.input,
                expectedOutput: tc.output,
                actualOutput: stdout,
                status: success ? 'success' : 'failure',
                isPublic: tc.isPublic,
            } as TestCaseResult;
        } catch (runErr: any) {
            const e = runErr as CommandError | Error;
            const stderr = (e as CommandError)?.stderr ?? '';
            const stdout = (e as CommandError)?.stdout ?? '';
            const output = e instanceof Error ? e.message : String(e)
            console.error(`C#実行エラー for user ${userId}: ${output}\nstderr: ${stderr}\nstdout: ${stdout}`);
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
