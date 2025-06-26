import React, { useState } from 'react';
import styles from './Login.module.css';
import Button from '../shared/Button';
import type { TaskMode } from '../../utils/types';

interface LoginProps {
    onLogin: (userId: string, mode: TaskMode) => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
    const [userIdInput, setUserIdInput] = useState('');
    const [error, setError] = useState('');

    const isInputValid = userIdInput.trim() !== '';

    const handleLogin = (selectedMode: TaskMode) => {
        if (isInputValid) {
            onLogin(userIdInput.trim(), selectedMode);
        } else {
            setError('ユーザーIDを入力してください。');
        }
    };

    return (
        <div className={styles.loginContainer}>
            <h2 className={styles.loginTitle}>ようこそ！</h2>

            <div className={styles.noticeContainer}>
                <p>
                    【注意事項】
                    <br />
                    ・本番中は他の画面から、入力エリアに対してペーストすると<strong>失格</strong>となります。
                    <br />
                    ・入力エリア以外のコピー操作なども<strong>失格</strong>の対象です。
                    <br />
                    ・誤って操作して失格にならないようご注意ください。
                </p>
            </div>

            <input
                type="text"
                placeholder="ユーザーIDを入力してください"
                value={userIdInput}
                onChange={(e) => {
                    setUserIdInput(e.target.value);
                    if (e.target.value.trim() !== '') {
                        setError('');
                    }
                }}
                className={styles.userIdInput}
                aria-label="ユーザーID"
            />
            {error && <div className={styles.errorMessage}>{error}</div>}
            <div className={styles.buttonGroup}>
                <Button onClick={() => handleLogin('task')} disabled={!isInputValid} variant="primary">
                    本番を開始する
                </Button>
                <Button onClick={() => handleLogin('practice')} disabled={!isInputValid} variant="secondary">
                    練習問題を解く
                </Button>
            </div>
        </div>
    );
};

export default Login;
