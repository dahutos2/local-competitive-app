import React from 'react';
import type { OutputStatus } from '../../utils/types';
import styles from './PreSubmitConfirmation.module.css';

interface PreSubmitConfirmationProps {
    status: OutputStatus;
    input: string;
    expectedOutput: string;
    actualOutput?: string;
    errorMessages?: string;
}

const statusIcons: Record<OutputStatus, string> = {
    error: '❌',
    failure: '⚠️',
    success: '✔️',
};

const statusMessages: Record<OutputStatus, string> = {
    error: 'コード実行結果: エラー',
    failure: 'コード実行結果: 不正解',
    success: 'コード実行結果: 正解',
};

const PreSubmitConfirmation: React.FC<PreSubmitConfirmationProps> = ({
    status,
    input,
    expectedOutput,
    actualOutput,
    errorMessages,
}) => {
    const statusStyle = `codeResult--${status}`;
    return (
        <div className={`${styles.codeResult} ${styles[statusStyle]}`}>
            <div className={styles.judgeResult}>
                <span className={styles.statusIcon}>{statusIcons[status]}</span>
                {statusMessages[status]}
            </div>
            <div className={styles.resultRow}>
                <span className={styles.label}>入力:</span>
                <pre className={styles.content}>{input}</pre>
            </div>
            <div className={styles.resultRow}>
                <span className={styles.label}>期待出力:</span>
                <pre className={styles.content}>{expectedOutput}</pre>
            </div>
            <div className={styles.resultRow}>
                <span className={styles.label}>実際の出力:</span>
                <pre className={styles.content}>{actualOutput ?? '出力がありません'}</pre>
            </div>
            {status === 'error' && errorMessages && (
                <div className={styles.errorMessages}>
                    <strong>エラー詳細:</strong>
                    <pre>{errorMessages}</pre>
                </div>
            )}
            {status === 'failure' && (
                <div className={styles.hint}>
                    期待する出力と出力結果が異なります。半角スペースや改行の違いに注意してください。
                </div>
            )}
        </div>
    );
};

export default PreSubmitConfirmation;
