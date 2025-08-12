import React, { useState, useEffect, type JSX } from 'react';
import CodeEditor from '../CodeEditor';
import PreSubmitConfirmation from '../PreSubmitConfirmation';
import type { Task, TaskMode, LangOption, TestCaseResult, OutputStatus, TestCase } from '../../utils/types';
import defaultCodes from '../../data/defaultCodes.json';
import styles from './TaskRunner.module.css';
import Button from '../shared/Button';
import ProgressOverlay from '../shared/ProgressOverlay';

interface TaskRunnerProps {
  task: Task;
  userId: string;
  mode: TaskMode;
  defaultLang: LangOption,
  switchModeToTask: () => void;
  onComplete: () => void;
}

type StartAndPollResult = { ok: true; result: TestCaseResult[] } | { ok: false; error: string };

const POLL_INTERVAL_MS = 500;

function toErrorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  try { return JSON.stringify(e); } catch { /* noop */ }
  return String(e);
}

async function sleep(ms: number): Promise<void> {
  await new Promise((r) => setTimeout(r, ms));
}

const TaskRunner: React.FC<TaskRunnerProps> = ({ task, userId, mode, defaultLang, switchModeToTask, onComplete }) => {
  const [language, setLanguage] = useState<LangOption>(defaultLang);
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

  // 進捗オーバーレイ
  const [overlayOpen, setOverlayOpen] = useState(false);
  const [overlayProgress, setOverlayProgress] = useState(0);
  const [overlayMessage, setOverlayMessage] = useState<string>();

  const publicTestCases = task.testCases.filter((tc) => tc.isPublic);

  useEffect(() => {
    setUserCode(defaultCodes[language]);
    setPreSubmitStatus(null);
  }, [language]);

  async function pollJob(jobId: string): Promise<StartAndPollResult> {
    for (;;) {
      const res = await fetch(`/api/run/status?jobId=${encodeURIComponent(jobId)}`);
      const st: { success: boolean; status?: string; progress?: number; message?: string; result?: TestCaseResult[]; error?: string } = await res.json();

      if (!st.success) {
        return { ok: false, error: st.error || 'status失敗' };
      }

      setOverlayProgress(st.progress ?? 0);
      setOverlayMessage(st.message);

      if (st.status === 'succeeded') {
        return { ok: true, result: st.result ?? [] };
      }
      if (st.status === 'failed') {
        return { ok: false, error: st.error ?? 'ジョブ失敗' };
      }
      await sleep(POLL_INTERVAL_MS);
    }
  }

  async function startAndPoll(payload: {
    code: string; testCases: TestCase[]; userId: string; isSubmit: boolean; language: LangOption;
  }): Promise<StartAndPollResult> {
    const startRes = await fetch('/api/run/start', {
      method: 'POST',
      headers: { 'Content-Type':'application/json' },
      body: JSON.stringify(payload),
    });
    const startJson: { success: boolean; jobId?: string; message?: string } = await startRes.json();
    if (!startJson.success || !startJson.jobId) {
      return { ok: false, error: startJson.message ?? 'start失敗' };
    }

    setOverlayOpen(true);
    setOverlayProgress(1);
    setOverlayMessage('キュー投入');

    try {
      const result = await pollJob(startJson.jobId);
      setOverlayOpen(false);
      return result;
    } catch (e: unknown) {
      setOverlayOpen(false);
      return { ok: false, error: toErrorMessage(e) };
    }
  }

  // 提出前の単一テストケース実行
  const handlePreSubmit = async () => {
    const selectedTestCase = publicTestCases[sampleIndex];
    if (!selectedTestCase) {
      setPreSubmitStatus('error');
      setPreSubmitActualOutput('');
      setPreSubmitErrorMessages('テストケースが選択されていません');
      return;
    }

    try {
      const testCases: TestCase[] = [{
        input: selectedTestCase.input,
        output: selectedTestCase.output,
        isPublic: selectedTestCase.isPublic
      }];

      const r = await startAndPoll({ code: userCode, testCases, userId, isSubmit: false, language });

      setPreSubmitInput(selectedTestCase.input);
      setPreSubmitExpectedOutput(selectedTestCase.output);

      if (!r.ok) {
        setPreSubmitStatus('error');
        setPreSubmitActualOutput('');
        setPreSubmitErrorMessages(r.error);
        return;
      }

      const [result0] = r.result;
      if (!result0) {
        setPreSubmitStatus('error');
        setPreSubmitActualOutput('');
        setPreSubmitErrorMessages('データが不正です');
        return;
      }

      setPreSubmitStatus(result0.status);
      if (result0.status === 'error') {
        setPreSubmitActualOutput('');
        setPreSubmitErrorMessages(result0.actualOutput);
      } else {
        setPreSubmitActualOutput(result0.actualOutput);
        setPreSubmitErrorMessages('');
      }
    } catch (e: unknown) {
      setPreSubmitStatus('error');
      setPreSubmitActualOutput('');
      setPreSubmitErrorMessages(toErrorMessage(e));
    }
  };

  // 提出
  const executeAllTestCases = async (): Promise<void> => {
    const testCases: TestCase[] = task.testCases.map(tc => ({
      input: tc.input,
      output: tc.output,
      isPublic: tc.isPublic
    }));
    await startAndPoll({ code: userCode, testCases, userId, isSubmit: true, language });
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
  };

  const renderWithCodeBlocks = (lines: string[]) => {
    const elements: JSX.Element[] = [];
    let codeBlock: string[] = [];
    let insideCodeBlock = false;

    lines.forEach((line, index) => {
      if (line === '<code>') {
        insideCodeBlock = true;
        codeBlock = [];
        return;
      }
      if (line === '</code>') {
        insideCodeBlock = false;
        elements.push(
          <div key={`${line}-${index}`} className={styles.codeBlock}>
            {codeBlock.map((codeLine, codeIndex) => (
              <pre key={`${codeLine}-${codeIndex}`}>{codeLine}</pre>
            ))}
          </div>
        );
        return;
      }
      if (insideCodeBlock) {
        codeBlock.push(line);
        return;
      }
      elements.push(<p key={`${line}-${index}`} className={styles.line}>{line}</p>);
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

      {task.description?.length > 0 && (
        <div className={styles.section}>
          <div className={styles.sectionContent}>{renderWithCodeBlocks(task.description)}</div>
        </div>
      )}

      {task.inputDescription?.length > 0 && (
        <div className={styles.section}>
          <h4 className={styles.sectionTitle}>入力される値</h4>
          <div className={styles.sectionContent}>{renderWithCodeBlocks(task.inputDescription)}</div>
        </div>
      )}

      {task.outputDescription?.length > 0 && (
        <div className={styles.section}>
          <h4 className={styles.sectionTitle}>期待する出力</h4>
          <div className={styles.sectionContent}>{renderWithCodeBlocks(task.outputDescription)}</div>
        </div>
      )}

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

      <CodeEditor
        key={language}
        userId={userId}
        initialCode={userCode}
        onCodeChange={setUserCode}
        language={language}
      />

      <div className={styles.compileTestArea}>
        <div className={styles.inputSelect}>
          <label htmlFor="sample_input_no">動作確認で使うテストケースを選択</label>
          <select
            name="sample_input_no"
            id="sample_input_no"
            className={styles.select}
            value={sampleIndex}
            onChange={(e) => setSampleIndex(Number(e.target.value))}
          >
            {publicTestCases.map((tc, index) => (
              <option key={`${tc.input}-${index}`} value={index}>入力例{index + 1}</option>
            ))}
          </select>
        </div>
        <Button
          onClick={handleTestRun}
          disabled={isSubmitting || isTesting}
          variant="secondary"
          className={styles.submitButton}
        >
          {isTesting ? '確認中...' : '提出前に動作確認する'}
        </Button>
      </div>

      {preSubmitStatus && (
        <PreSubmitConfirmation
          status={preSubmitStatus}
          input={preSubmitInput}
          expectedOutput={preSubmitExpectedOutput}
          actualOutput={preSubmitActualOutput}
          errorMessages={preSubmitErrorMessages}
        />
      )}

      <Button
        onClick={handleSubmit}
        disabled={isSubmitting || isTesting}
        variant="primary"
        className={styles.submitButton}
      >
        {isSubmitting ? '提出中...' : 'コードを提出する'}
      </Button>

      <ProgressOverlay open={overlayOpen} progress={overlayProgress} message={overlayMessage} />
    </div>
  );
};

export default TaskRunner;
