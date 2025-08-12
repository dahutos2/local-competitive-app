import fs from 'fs';
import path from 'path';
import type { UserState, TaskMode, TestCaseResult } from '../type';
import { getVarDir } from '../utils/paths';

const tempDir = getVarDir('temp');
const resultDir = getVarDir('results');

const userStates: Record<string, UserState> = {};

export function initializeUser(userId: string, mode: TaskMode, timeLimitSec?: number): void {
    if (!userStates[userId]) {
        userStates[userId] = {
            disqualified: false,
            completed: false,
            mode,
            taskStartTime: mode === 'task' ? Date.now() : undefined,
            timeLimitSec: mode === 'task' && timeLimitSec ? timeLimitSec : undefined,
        };
    } else {
        userStates[userId].mode = mode;
    }
}

export function disqualifyUser(userId: string, reason: string): void {
    const userState = userStates[userId];
    if (userState && userState.mode === 'task') {
        userState.disqualified = true;
        writeResultToFile(userId, `失格-${reason}`);
    }
}

export function getUserState(userId: string): UserState | null {
    return userStates[userId] ?? null;
}

export function validateUser(userId: string): void {
    const s = userStates[userId];
    if (!s) throw new Error('ユーザーが初期化されていません。');
    if (s.mode === 'task') {
        if (s.disqualified) throw new Error('ユーザーは失格状態です。');
        if (s.taskStartTime && s.timeLimitSec !== undefined) {
            const elapsed = Math.floor((Date.now() - s.taskStartTime) / 1000);
            const timeLeft = s.timeLimitSec - elapsed;
            if (timeLeft <= 0) {
                disqualifyUser(userId, 'time_up');
                throw new Error('時間切れで失格しました。');
            }
        }
    }
}

export function completeUser(userId: string, isAllSuccess: boolean): void {
    const s = userStates[userId];
    if (s && s.mode === 'task') {
        s.completed = true;
        writeResultToFile(userId, `提出完了-${isAllSuccess ? "合格" : "不合格"}`);
    }
}

export function writeResultToFile(userId: string, result: string): void {
    const filePath = path.join(resultDir, `${userId}.txt`);
    const timestamp = new Date().toISOString();
    fs.appendFileSync(filePath, `結果: ${result}\n日時: ${timestamp}\n`, 'utf8');
}

export function saveTestCaseResults(userId: string, testCaseResults: TestCaseResult[]): void {
    const filePath = path.join(resultDir, `${userId}_test_results.json`);
    fs.writeFileSync(filePath, JSON.stringify(testCaseResults, null, 2), 'utf8');
}

export async function getResult(userId: string): Promise<TestCaseResult[]> {
    const testResultPath = path.join(resultDir, `${userId}_test_results.json`);
    if (fs.existsSync(testResultPath)) {
        const testContent = fs.readFileSync(testResultPath, 'utf8');
        return JSON.parse(testContent) as TestCaseResult[];
    }
    return [];
}

// ディレクトリパスを公開（servicesで使う）
export const Paths = {
    tempDir,
    resultDir,
};
