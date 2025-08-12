import React from 'react';
import styles from './ProgressOverlay.module.css';

type Props = { open: boolean; progress: number; message?: string; };

const ProgressOverlay: React.FC<Props> = ({ open, progress, message }) => {
  if (!open) return null;
  return (
    <div className={styles.backdrop}>
      <div className={styles.panel}>
        <div className={styles.title}>実行中...</div>
        <div className={styles.barWrap}>
          <div className={styles.bar} style={{ width: `${Math.min(100, Math.max(0, progress))}%` }} />
        </div>
        <div className={styles.percent}>{Math.round(progress)}%</div>
        {message && <div className={styles.msg}>{message}</div>}
      </div>
    </div>
  );
};

export default ProgressOverlay;
