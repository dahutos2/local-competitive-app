// server/types.ts
export type TaskMode = 'task' | 'practice';
export type LangOption = 'csharp' | 'typescript';
export type OutputStatus = 'error' | 'failure' | 'success';

// テストケース
export interface TestCase {
    input: string;
    expectedOutput: string;
    isPublic: boolean;
}

// テストケースの結果
export interface TestCaseResult {
    input: string;
    expectedOutput: string;
    actualOutput: string;
    status: OutputStatus;
    isPublic: boolean;
}

// ユーザーごとのタスク管理
export interface UserState {
    disqualified: boolean;
    completed: boolean;
    mode: TaskMode;
    taskStartTime?: number; // タスク開始時刻（ミリ秒）
    timeLimitSec?: number;  // タスクの制限時間（秒）
}

export class CommandError extends Error {
    public stdout: string;
    public stderr: string;

    constructor(message: string, stdout: string, stderr: string) {
        super(message);
        this.stdout = stdout;
        this.stderr = stderr;
        Object.setPrototypeOf(this, CommandError.prototype);
    }
}
