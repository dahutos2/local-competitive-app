import { useEffect, useState, useCallback } from 'react';
import type { Config, TaskMode } from './utils/types';
import tasksData from './data/tasks.json';
import practiceTasksData from './data/practiceTasks.json';
import Timer from './components/Timer';
import TaskRunner from './components/TaskRunner';
import CompletionScreen from './components/CompletionScreen';
import Login from './components/Login';
import styles from './App.module.css';
import './styles/globals.css';

function App() {
  const [disqualified, setDisqualified] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [mode, setMode] = useState<TaskMode | null>(null);
  const [remainingTime, setRemainingTime] = useState<number | null>(null);
  const [config, setConfig] = useState<Config | null>(null);

  useEffect(() => {
    fetch('/config.json')
      .then(response => response.json())
      .then((data: Config) => {
        setConfig(data);
      })
      .catch(err => {
        console.error('Failed to load config.json', err);
      });
  }, []);

  const currentTask = mode === 'task' ? tasksData[config?.taskIndex ?? 0] : practiceTasksData[0];

  /**
   * 失格処理をまとめた関数
   * - stateが変わるたびに再生成されないよう useCallback を使用
   */
  const handleDisqualification = useCallback(() => {
    if (userId && mode === 'task' && !completed) {
      setDisqualified(true);
      fetch('/api/disqualify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
    }
  }, [userId, mode, completed]);

  // コピー操作が行われたときに失格
  useEffect(() => {
    const handleCopy = (e: ClipboardEvent) => {
      // もしコピーがMonacoEditor（.monaco-editor）内で発生した場合は失格にしない
      const target = e.target as HTMLElement | null;
      if (target?.closest('.monaco-editor')) {
        // MonacoEditor内でのコピーは許可
        return;
      }

      // それ以外（Monaco以外の場所でのコピー）は失格とする
      handleDisqualification();
    };

    document.addEventListener('copy', handleCopy);
    return () => {
      document.removeEventListener('copy', handleCopy);
    };
  }, [handleDisqualification]);

  // MonacoEditor から発行されるカスタムイベント 'monaco-editor-paste' を監視
  useEffect(() => {
    const handleMonacoPaste = () => {
      handleDisqualification();
    };

    window.addEventListener('monaco-editor-paste', handleMonacoPaste);
    return () => {
      window.removeEventListener('monaco-editor-paste', handleMonacoPaste);
    };
  }, [handleDisqualification]);

  const handleTimeUp = () => {
    setDisqualified(true);
    setRemainingTime(0);
    handleDisqualification();
  };

  const switchModeToTask = () => {
    const timeLimitSec = currentTask.timeLimitSec;
    fetch('/api/switch-mode', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, timeLimitSec }),
    }).then(() => {
      setMode('task');
      setRemainingTime(timeLimitSec);
    });
  }

  const handleLogin = (newUserId: string, selectedMode: TaskMode) => {
    // タスクのtimeLimitSecを取得
    const timeLimitSec = selectedMode === 'task' ? currentTask.timeLimitSec : undefined;

    // サーバー側でユーザー状態を初期化
    fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: newUserId, mode: selectedMode, timeLimitSec }),
    }).then(() => {
      setUserId(newUserId);
      setMode(selectedMode);
      if (selectedMode === 'task' && timeLimitSec) {
        setRemainingTime(timeLimitSec);
      }
    });
  };

  // ログイン後にユーザー状態を取得
  useEffect(() => {
    if (userId && mode) {
      fetch(`/api/user-state?userId=${encodeURIComponent(userId)}`)
        .then(response => response.json())
        .then(data => {
          if (data.success) {
            const { userState } = data;
            if (userState.disqualified) {
              setDisqualified(true);
            } else if (userState.completed) {
              setCompleted(true);
            } else if (userState.remainingTime !== undefined) {
              setRemainingTime(userState.remainingTime);
            }
          }
        });
    }
  }, [userId, mode]);

  if (!userId || !mode) {
    return <Login onLogin={handleLogin} />;
  }

  if (disqualified) {
    return (
      <div className={styles.container}>
        <div className={styles.disqualified}>失格になりました...</div>
      </div>
    );
  }

  if (completed) {
    return (
      <CompletionScreen
        userId={userId}
        mode={mode}
        onInComplete={() => setCompleted(false)}
        switchModeToTask={switchModeToTask}
      />
    );
  }

  return (
    <div className={styles.container}>
      {mode === 'task' && (
        <div className={styles.timer}>
          <Timer
            totalSec={remainingTime ?? currentTask.timeLimitSec}
            onTimeUp={handleTimeUp}
            mode={mode}
          />
        </div>
      )}

      <TaskRunner
        task={currentTask}
        userId={userId}
        mode={mode}
        switchModeToTask={switchModeToTask}
        onComplete={() => setCompleted(true)}
      />
    </div>
  );
}

export default App;
