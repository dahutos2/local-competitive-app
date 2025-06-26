import React, { useState, useEffect, type JSX } from 'react';
import CodeEditor from '../CodeEditor';
import PreSubmitConfirmation from '../PreSubmitConfirmation';
import type { Task, TaskMode, LangOption, TestCaseResult, OutputStatus } from '../../utils/types';
import defaultCodes from '../../data/defaultCodes.json';
import styles from './TaskRunner.module.css';
import Button from '../shared/Button';

interface TaskRunnerProps {
    task: Task;
    userId: string;
    mode: TaskMode;
    switchModeToTask: () => void;
    onComplete: () => void;
}

const TaskRunner: React.FC<TaskRunnerProps> = ({ task, userId, mode, switchModeToTask, onComplete }) => {
    const [language, setLanguage] = useState<LangOption>('csharp');
    const [userCode, setUserCode] = useState('');
    const [sampleIndex, setSampleIndex] = useState(0);
    const [isTesting, setIsTesting] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // 提出前動作確認用の状態
    const [preSubmitStatus, setPreSubmitStatus] = useState<OutputStatus | null>(null);
    const [preSubmitInput, setPreSubmitInput] = useState('');
    const [preSubmitExpectedOutput, setPreSubmitExpectedOutput] = useState('');
    const [preSubmitActualOutput, setPreSubmitActualOutput] = useState('');
    const [preSubmitErrorMessages, setPreSubmitErrorMessages] = useState('');

    const publicTestCases = task.testCases.filter((tc) => tc.isPublic);

    useEffect(() => {
        // 言語が変更された際にデフォルトのコードを設定し、プレテスト結果をクリア
        setUserCode(defaultCodes[language]);
        setPreSubmitStatus(null);
    }, [language]);

    // 提出前の単一テストケース実行
    const handlePreSubmit = async () => {
        const selectedTestCase = publicTestCases[sampleIndex];
        if (!selectedTestCase) {
            setPreSubmitStatus('error');
            setPreSubmitActualOutput('');
            setPreSubmitErrorMessages('テストケースが選択されていません');
        }
        try {
            const testCases = [{
                input: selectedTestCase.input,
                expectedOutput: selectedTestCase.output,
                isPublic: selectedTestCase.isPublic
            }];

            const url = language === 'csharp' ? '/api/run-cs' : '/api/run-ts';
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    code: userCode,
                    testCases: testCases,
                    userId: userId,
                    isSubmit: false
                })
            });
            const data = await res.json();
            setPreSubmitInput(selectedTestCase.input);
            setPreSubmitExpectedOutput(selectedTestCase.output);
            if (!data.success) {
                // エラー発生時
                setPreSubmitStatus('error');
                setPreSubmitActualOutput('');
                setPreSubmitErrorMessages(data.output);
            } else {
                const testCaseResults: TestCaseResult[] = data.output;
                if (testCaseResults.length !== 1) {
                    setPreSubmitStatus('error');
                    setPreSubmitActualOutput('');
                    setPreSubmitErrorMessages('データが不正です');
                } else {
                    const testCaseResult = testCaseResults[0];
                    setPreSubmitStatus(testCaseResult.status);
                    if (testCaseResult.status === 'error') {
                        setPreSubmitActualOutput('');
                        setPreSubmitErrorMessages(testCaseResult.actualOutput);
                    } else {
                        setPreSubmitActualOutput(testCaseResult.actualOutput);
                    }
                }
            }
        } catch (error: any) {
            // 通信エラー
            setPreSubmitStatus('error');
            setPreSubmitInput(selectedTestCase.input);
            setPreSubmitExpectedOutput(selectedTestCase.output);
            setPreSubmitActualOutput('');
            setPreSubmitErrorMessages(error.message);
        }
    };

    // 提出時のテストケース実行
    const executeAllTestCases = async (): Promise<void> => {
        try {
            const testCases = task.testCases.map(tc => {
                return {
                    input: tc.input,
                    expectedOutput: tc.output,
                    isPublic: tc.isPublic
                };
            });
            const url = language === 'csharp' ? '/api/run-cs' : '/api/run-ts';
            await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    code: userCode,
                    testCases: testCases,
                    userId: userId,
                    isSubmit: true
                })
            });
        } catch {
            // 例外時は何もしない
        }
    };

    const handleTestRun = async () => {
        setIsTesting(true);
        await handlePreSubmit();
        setIsTesting(false);
    };
    const handleSubmit = async () => {
        setIsSubmitting(true);
        await executeAllTestCases();
        onComplete();
        setIsSubmitting(false);
    };

    const toTask = () => {
        setPreSubmitStatus(null);
        switchModeToTask();
    }

    const renderWithCodeBlocks = (lines: string[]) => {
        const elements: JSX.Element[] = [];
        let codeBlock: string[] = [];
        let insideCodeBlock = false;
        lines.forEach((line, index) => {
            if (line === '<code>') {
                insideCodeBlock = true;
                codeBlock = [];
            } else if (line === '</code>') {
                insideCodeBlock = false;
                elements.push(
                    <div key={`${line}-${index}`} className={styles.codeBlock}>
                        {codeBlock.map((codeLine, codeIndex) => (
                            <pre key={`${codeLine}-${codeIndex}`}>
                                {codeLine}
                            </pre>
                        ))}
                    </div>
                );
            } else if (insideCodeBlock) {
                codeBlock.push(line);
            } else {
                elements.push(
                    <p key={`${line}-${index}`} className={styles.line}>
                        {line}
                    </p>
                );
            }
        });

        return elements;
    };

    return (
        <div className={styles.container}>
            {mode === 'practice' && (
                <Button onClick={toTask} variant="secondary" className={styles.switchButton}>
                    本番モードに切り替える
                </Button>
            )}

            <h3 className={styles.taskTitle}>{task.title}</h3>

            {/* 説明 */}
            {task.description && task.description.length > 0 && (
                <div className={styles.section}>
                    <div className={styles.sectionContent}>
                        {renderWithCodeBlocks(task.description)}
                    </div>
                </div>
            )}


            {/* 入力される値 */}
            {task.inputDescription && task.inputDescription.length > 0 && (
                <div className={styles.section}>
                    <h4 className={styles.sectionTitle}>入力される値</h4>
                    <div className={styles.sectionContent}>
                        {renderWithCodeBlocks(task.inputDescription)}
                    </div>
                </div>
            )}

            {/* 期待する出力 */}
            {task.outputDescription && task.outputDescription.length > 0 && (
                <div className={styles.section}>
                    <h4 className={styles.sectionTitle}>期待する出力</h4>
                    <div className={styles.sectionContent}>
                        {renderWithCodeBlocks(task.outputDescription)}
                    </div>
                </div>
            )}

            {/* テストケースの詳細表示 */}
            <div className={styles.testCaseDetails}>
                {publicTestCases.map((tc, index) => (
                    <div key={`${tc.input}-${index}`} className={styles.individualTestCase}>
                        <div>
                            <strong className={styles.testCaseTitle}>入力例{index + 1}:</strong>
                            <pre className={styles.testCasePre}>{tc.input}</pre>
                        </div>
                        <div>
                            <strong className={styles.testCaseTitle}>期待される出力:</strong>
                            <pre className={styles.testCasePre}>{tc.output}</pre>
                        </div>
                    </div>
                ))}
            </div>

            {/* 言語選択 */}
            <div className={styles.formGroup}>
                <label htmlFor="language-select">使用言語: </label>
                <select
                    id="language-select"
                    value={language}
                    onChange={(e) => setLanguage(e.target.value as LangOption)}
                    className={styles.select}
                >
                    <option value='csharp'>C#</option>
                    <option value='typescript'>TypeScript</option>
                </select>
            </div>

            {/* コードエディタ */}
            <CodeEditor
                key={language}
                userId={userId}
                initialCode={userCode}
                onCodeChange={setUserCode}
                language={language}
            />

            {/* 提出前動作確認エリア */}
            <div className={styles.compileTestArea}>
                <div className={styles.inputSelect}>
                    <label htmlFor="sample_input_no">動作確認で使うテストケースを選択</label>
                    <select
                        name="sample_input_no"
                        id="sample_input_no"
                        className={`${styles.select}`}
                        value={sampleIndex ?? ''}
                        onChange={(e) => {
                            setSampleIndex(Number(e.target.value));
                        }}
                    >
                        {publicTestCases.map((tc, index) => (
                            <option key={`${tc.input}-${index}`} value={index}>
                                入力例{index + 1}
                            </option>
                        ))}
                    </select>
                </div>
                <Button
                    onClick={handleTestRun}
                    disabled={isSubmitting || isTesting || sampleIndex === null}
                    variant="secondary"
                    className={styles.submitButton}
                >
                    {isTesting ? '確認中...' : '提出前に動作確認する'}
                </Button>
            </div>

            {/* 提出前動作確認の結果表示 */}
            {preSubmitStatus && (
                <PreSubmitConfirmation
                    status={preSubmitStatus}
                    input={preSubmitInput}
                    expectedOutput={preSubmitExpectedOutput}
                    actualOutput={preSubmitActualOutput}
                    errorMessages={preSubmitErrorMessages}
                />
            )}

            {/* 提出ボタンを中央に配置 */}
            <Button
                onClick={handleSubmit}
                disabled={isSubmitting || isTesting}
                variant="primary"
                className={styles.submitButton}
            >
                {isSubmitting ? '提出中...' : 'コードを提出する'}
            </Button>
        </div>
    );
};

export default TaskRunner;