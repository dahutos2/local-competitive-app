import React, { useEffect, useMemo, useState } from 'react';
import type { TaskMode, TestCaseResult, OverallResult, OutputStatus } from '../../utils/types';
import styles from './CompletionScreen.module.css';
import Button from '../shared/Button';

interface CompletionScreenProps {
  userId: string;
  mode: TaskMode;
  switchModeToTask: () => void;
  onInComplete: () => void;
}

function statusLabel(status: OutputStatus): string {
  switch (status) {
    case 'success': return '成功';
    case 'failure': return '失敗';
    case 'error':   return 'エラー';
    default:        return '';
  }
}

const POLL_VISIBLE_FAILED_DEFAULT = true;

const CompletionScreen: React.FC<CompletionScreenProps> = ({
  userId,
  mode,
  switchModeToTask,
  onInComplete
}) => {
  const [result, setResult] = useState<OverallResult | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [showOnlyFailed, setShowOnlyFailed] = useState<boolean>(POLL_VISIBLE_FAILED_DEFAULT);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch(`/api/get-result?userId=${encodeURIComponent(userId)}`);
        const data = await response.json();
        if (cancelled) return;
        if (data.success) {
          const testCaseResults: TestCaseResult[] = data.output ?? [];
          setResult({ overallMessage: '提出が完了しました！', testCaseResults });
        } else {
          setResult({ overallMessage: '結果の取得に失敗しました。', testCaseResults: [] });
        }
      } catch {
        if (!cancelled) {
          setResult({ overallMessage: '結果の取得中にエラーが発生しました。', testCaseResults: [] });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [userId]);

  const counts = useMemo(() => {
    const list = result?.testCaseResults ?? [];
    return {
      total: list.length,
      success: list.filter(r => r.status === 'success').length,
      failure: list.filter(r => r.status === 'failure').length,
      error: list.filter(r => r.status === 'error').length,
    };
  }, [result]);

  const visibleResults = useMemo(() => {
    const list = result?.testCaseResults ?? [];
    return showOnlyFailed ? list.filter(r => r.status !== 'success') : list;
  }, [result, showOnlyFailed]);

  const toTask = () => {
    onInComplete();
    switchModeToTask();
  };

  return (
    <section className={styles.container} aria-busy={loading}>
      <h2 className={styles.title}>提出完了</h2>

      {loading ? (
        <output className={styles.loading}>結果を取得中...</output>
      ) : (
        <>
          <div className={styles.summary}>
            <p className={styles.overall}>{result?.overallMessage}</p>
            <div className={styles.counters} aria-label="テスト結果集計">
              <span className={`${styles.badge} ${styles.badgeAll}`}>全 {counts.total}</span>
              <span className={`${styles.badge} ${styles.badgeSuccess}`}>成功 {counts.success}</span>
              <span className={`${styles.badge} ${styles.badgeFailure}`}>失敗 {counts.failure}</span>
              <span className={`${styles.badge} ${styles.badgeError}`}>エラー {counts.error}</span>
            </div>
            <label className={styles.toggle}>
              <input
                type="checkbox"
                checked={showOnlyFailed}
                onChange={(e) => setShowOnlyFailed(e.target.checked)}
              />
              <span>失敗/エラーのみ表示</span>
            </label>
          </div>

          {visibleResults.length > 0 ? (
            <ul className={styles.list}>
              {visibleResults.map((tcResult, index) => {
                // ビルド/コンパイル専用行の判定
                const isBuild = tcResult.input === '(build)';
                const isCompile = tcResult.input === '(compile)';
                const isSpecial = isBuild || isCompile;
                const title = isCompile ? 'コンパイルエラー' : `テストケース ${index + 1}`
                const caseTitle = isBuild ? 'ビルドエラー' : title;

                // ステータス用の動的クラス（ネストテンプレ回避）
                const statusClassKey = `status_${tcResult.status}`;
                const statusClassName = styles[statusClassKey] ?? '';

                const isBad = tcResult.status !== 'success';
                const itemClass = `${styles.item} ${isBad ? styles.itemBad : ''}`;

                const key = `${tcResult.input}-${index}`;

                return (
                  <li key={key} className={styles.listItem}>
                    <details className={itemClass} open={isBad}>
                      <summary className={styles.itemHeader}>
                        <span className={`${styles.status} ${statusClassName}`}>
                          {statusLabel(tcResult.status)}
                        </span>
                        <span className={styles.itemTitle}>{caseTitle}</span>
                      </summary>

                      <dl className={styles.rows}>
                        {!isSpecial && (
                          <div className={styles.row}>
                            <dt className={styles.label}>入力</dt>
                            <dd className={styles.content}>
                              <pre className={styles.pre}>{tcResult.input}</pre>
                            </dd>
                          </div>
                        )}

                        {tcResult.expectedOutput && (
                          <div className={styles.row}>
                            <dt className={styles.label}>期待出力</dt>
                            <dd className={styles.content}>
                              <pre className={styles.pre}>{tcResult.expectedOutput}</pre>
                            </dd>
                          </div>
                        )}

                        <div className={styles.row}>
                          <dt className={styles.label}>{isSpecial ? 'ログ' : '実際の出力'}</dt>
                          <dd className={styles.content}>
                            <pre className={styles.pre}>{tcResult.actualOutput}</pre>
                          </dd>
                        </div>
                      </dl>
                    </details>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className={styles.empty}>表示するテストケースはありません。</div>
          )}
        </>
      )}

      <div className={styles.buttonGroup}>
        {mode === 'practice' && (
          <Button onClick={toTask} variant="primary" className={styles.button}>
            本番モードに切り替える
          </Button>
        )}
      </div>
    </section>
  );
};

export default CompletionScreen;
