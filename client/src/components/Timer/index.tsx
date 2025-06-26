import React, { useEffect, useState } from 'react';
import type { TaskMode } from '../../utils/types';
import styles from './Timer.module.css';
import Button from '../shared/Button';

interface TimerProps {
    totalSec: number;
    onTimeUp: () => void;
    mode: TaskMode;
}

const Timer: React.FC<TimerProps> = ({ totalSec, onTimeUp, mode }) => {
    const [timeLeft, setTimeLeft] = useState(totalSec);

    useEffect(() => {
        setTimeLeft(totalSec);
    }, [totalSec]);

    useEffect(() => {
        if (timeLeft <= 0) {
            onTimeUp();
            return;
        }
        const timerId = setInterval(() => {
            setTimeLeft(prev => {
                if (prev <= 1) {
                    clearInterval(timerId);
                    onTimeUp();
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(timerId);
    }, [timeLeft, onTimeUp]);

    // タイマーのリセット機能
    const handleReset = () => {
        if (mode === 'practice') {
            setTimeLeft(totalSec);
        }
    };

    return (
        <div className={styles.timerContainer}>
            <div className={`${styles.timerDisplay} ${timeLeft <= 10 ? styles.timerWarning : ''}`}>
                残り時間: {timeLeft}秒
            </div>
            {mode === 'practice' && (
                <Button onClick={handleReset} variant="secondary">
                    リセット
                </Button>
            )}
        </div>
    );
};

export default Timer;
