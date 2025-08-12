export type TaskMode = 'task' | 'practice';
export type LangOption = 'csharp' | 'typescript';
export type OutputStatus = 'error' | 'failure' | 'success';
export type DisqualifyReason =
    | 'copy_outside_editor'   // Monaco 以外でコピー
    | 'paste_into_editor'     // Monaco への外部貼り付け
    | 'time_up';              // 時間切れ

export interface Config {
    taskIndex: number;
    defaultLang: LangOption;
    disqualificationRules?: DisqualifyReason[];
}

export interface TestCase {
    input: string;
    output: string;
    isPublic: boolean;
}

export interface Task {
    id: number;
    title: string;
    description: string[];
    inputDescription: string[];
    outputDescription: string[];
    timeLimitSec: number;
    testCases: TestCase[];
}

export interface TestCaseResult {
    input: string;
    expectedOutput: string;
    actualOutput: string;
    status: OutputStatus;
    isPublic: boolean;
}

export interface OverallResult {
    overallMessage: string;
    testCaseResults: TestCaseResult[];
}
