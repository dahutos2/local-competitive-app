import type { RunRequestPayload, TestCaseResult } from '../type';
import { validateUser, completeUser, saveTestCaseResults } from '../core/state';
import { runCsharp } from './csharp';
import { runTypescript } from './typescript';

/**
 * 共通ランナー
 * - ユーザー検証
 * - 言語別サービスへ委譲
 * - isSubmit の場合は成功失敗問わず結果を保存
 */
export async function runCode(
    req: RunRequestPayload,
    onProgress?: (p: number, m?: string) => void
): Promise<TestCaseResult[]> {
    const { language, code, testCases, userId, isSubmit } = req;

    validateUser(userId);

    let results: TestCaseResult[];
    if (language === 'csharp') {
        results = await runCsharp(code, testCases, userId, onProgress);
    } else {
        results = await runTypescript(code, testCases, userId, onProgress);
    }

    // 提出時は結果を保存
    if (isSubmit) {
        saveTestCaseResults(userId, results);
        const allSuccess = results.length > 0 && results.every(r => r.status === 'success');
        completeUser(userId, allSuccess);
        return [];
    }

    return results;
}