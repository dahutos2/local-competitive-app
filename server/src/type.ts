export type TaskMode = 'task' | 'practice';
export type LangOption = 'csharp' | 'typescript';
export type OutputStatus = 'error' | 'failure' | 'success';

// テストケース
export interface TestCase {
    input: string;
    output: string;
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

// キュー & 進捗API用
export type JobStatus = 'queued' | 'running' | 'succeeded' | 'failed';

export interface RunRequestPayload {
    language: LangOption;
    code: string;
    testCases: TestCase[];
    userId: string;
    isSubmit?: boolean;
}

export interface JobProgress {
    jobId: string;
    status: JobStatus;
    progress: number;               // 0..100
    message?: string;
    result?: TestCaseResult[];      // 成功時のみ（isSubmit:true の場合は空配列）
    error?: string;                 // 失敗時のみ
    updatedAt: number;              // epoch ms
}
