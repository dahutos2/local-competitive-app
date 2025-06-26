import React, { useEffect, useState } from 'react';
import type { TaskMode, TestCaseResult, OverallResult, OutputStatus } from '../../utils/types';
import styles from './CompletionScreen.module.css';
import Button from '../shared/Button';

interface CompletionScreenProps {
    userId: string;
    mode: TaskMode;
    switchModeToTask: () => void;
    onInComplete: () => void;
}

const CompletionScreen: React.FC<CompletionScreenProps> = ({ userId, mode, switchModeToTask, onInComplete }) => {
    const [result, setResult] = useState<OverallResult | null>(null);
    const [loading, setLoading] = useState<boolean>(true);

    useEffect(() => {
        const fetchResult = async () => {
            try {
                const response = await fetch(`/api/get-result?userId=${encodeURIComponent(userId)}`);
                const data = await response.json();
                if (data.success) {
                    const testCaseResults: TestCaseResult[] = data.output;
                    setResult({ overallMessage: '提出が完了しました！', testCaseResults: testCaseResults });
                } else {
                    setResult({ overallMessage: '結果の取得に失敗しました。', testCaseResults: [] });
                }
            } catch {
                setResult({ overallMessage: '結果の取得中にエラーが発生しました。', testCaseResults: [] });
            } finally {
                setLoading(false);
            }
        };

        fetchResult();
    }, [userId]);

    const getStatusStyle = (status: OutputStatus): string => {
        switch (status) {
            case 'success':
                return styles.resultSuccess;
            case 'failure':
                return styles.resultFailure;
            case 'error':
                return styles.resultError;
            default:
                return '';
        }
    };
    const getStatusMessage = (status: OutputStatus): string => {
        switch (status) {
            case 'success':
                return '成功';
            case 'failure':
                return '失敗';
            case 'error':
                return 'エラー';
            default:
                return '';
        }
    };
    const toTask = () => {
        onInComplete();
        switchModeToTask();
    };

    return (
        <div className={styles.container}>
            <h2 className={styles.title}>提出完了</h2>
            {loading ? (
                <div className={styles.loading}>結果を取得中...</div>
            ) : (
                <div className={styles.resultContainer}>
                    <div className={styles.overallResult}>
                        <strong>総合結果:</strong>
                        <p>{result?.overallMessage}</p>
                    </div>
                    {result?.testCaseResults && result.testCaseResults.length > 0 && (
                        <div className={styles.testCaseResults}>
                            {result.testCaseResults.map((tcResult, index) => (
                                <div key={`${tcResult.input}-${index}`} className={styles.testCaseResult}>
                                    <div className={styles.resultHeader}>
                                        <strong>テストケース {index + 1}:</strong>
                                        <span className={getStatusStyle(tcResult.status)}>
                                            {getStatusMessage(tcResult.status)}
                                        </span>
                                    </div>
                                    <div className={styles.resultRow}>
                                        <span className={styles.label}>入力:</span>
                                        <pre className={styles.content}>{tcResult.input}</pre>
                                    </div>
                                    <div className={styles.resultRow}>
                                        <span className={styles.label}>期待出力:</span>
                                        <pre className={styles.content}>{tcResult.expectedOutput}</pre>
                                    </div>
                                    <div className={styles.resultRow}>
                                        <span className={styles.label}>実際の出力:</span>
                                        <pre className={styles.content}>{tcResult.actualOutput}</pre>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
            <div className={styles.buttonGroup}>
                {mode === 'practice' && (
                    <Button onClick={toTask} variant="primary" className={styles.button}>
                        本番モードに切り替える
                    </Button>
                )}
            </div>
        </div>
    );
};

export default CompletionScreen;
