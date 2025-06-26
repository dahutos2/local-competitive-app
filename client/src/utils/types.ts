export type TaskMode = 'task' | 'practice';
export type LangOption = 'csharp' | 'typescript';
export type OutputStatus = 'error' | 'failure' | 'success';

export interface Config {
    taskIndex: number;
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
