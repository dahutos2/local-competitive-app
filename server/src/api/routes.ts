import { Router } from 'express';
import axios from 'axios';
import {
    initializeUser,
    disqualifyUser,
    getUserState,
    getResult,
} from '../core/state';
import { enqueue, getProgress, setWorker } from '../jobs/jobManager';
import { runJob } from '../jobs/serverWorker';

const router = Router();

// ワーカー登録（プロセス起動時に1回だけ）
setWorker(runJob);

/**
 * ログイン
 */
router.post('/login', (req, res) => {
    const { userId, mode, timeLimitSec } = req.body;
    if (!userId || !mode || (mode === 'task' && !timeLimitSec)) {
        return res.status(400).json({ success: false, output: 'userId, mode, および task モードの場合は timeLimitSec が必要です。' });
    }
    initializeUser(userId, mode, timeLimitSec);
    res.json({ success: true });
});

/**
 * ユーザー状態
 */
router.get('/user-state', (req, res) => {
    const { userId } = req.query;
    if (!userId || typeof userId !== 'string') {
        return res.status(400).json({ success: false, output: 'userIdが必要です。' });
    }
    const userState = getUserState(userId);
    if (!userState) {
        return res.status(404).json({ success: false, output: 'ユーザーが見つかりません。' });
    }

    let remainingTime: number | undefined;

    if (userState.mode === 'task' && userState.taskStartTime && userState.timeLimitSec) {
        const elapsed = Math.floor((Date.now() - userState.taskStartTime) / 1000);
        remainingTime = userState.timeLimitSec - elapsed;

        if (remainingTime <= 0 && !userState.disqualified) {
            disqualifyUser(userId, "time_up");
            remainingTime = 0;
        }
    }

    res.json({ success: true, userState: { ...userState, remainingTime } });
});

/**
 * 失格
 */
router.post('/disqualify', (req, res) => {
    const { userId, reason } = req.body;
    if (!userId) {
        return res.status(400).json({ success: false, output: 'userIdが必要です。' });
    }
    disqualifyUser(userId, reason);
    res.json({ success: true });
});

/**
 * 提出結果取得（保存されたテストケース結果）
 */
router.get('/get-result', async (req, res) => {
    const { userId } = req.query;
    if (!userId || typeof userId !== 'string') {
        return res.status(400).json({ success: false, output: 'userIdが必要です。' });
    }
    try {
        const result = await getResult(userId);
        res.json({ success: true, output: result });
    } catch (error: any) {
        res.status(500).json({ success: false, output: error.message });
    }
});

/**
 * モード切替
 */
router.post('/switch-mode', (req, res) => {
    const { userId, timeLimitSec } = req.body;
    if (!userId || !timeLimitSec) {
        return res.status(400).json({ success: false, output: 'userIdとtimeLimitSecが必要です。' });
    }
    const userState = getUserState(userId);
    if (!userState) {
        return res.status(404).json({ success: false, output: 'ユーザーが見つかりません。' });
    }
    userState.mode = 'task';
    if (userState.taskStartTime === undefined) {
        userState.taskStartTime = Date.now();
        userState.timeLimitSec = timeLimitSec;
    }
    res.json({ success: true, output: '本番モードに切り替えました。' });
});

/**
 * 実行開始（非同期）→ jobId を返す
 */
router.post('/run/start', (req, res) => {
    const { language, code, testCases, userId, isSubmit } = req.body;
    if (!userId || !language || !Array.isArray(testCases)) {
        return res.status(400).json({ success: false, message: 'userId, language, testCases が必要です。' });
    }
    const jobId = enqueue({ language, code, testCases, userId, isSubmit: !!isSubmit });
    res.json({ success: true, jobId });
});

/**
 * 進捗取得
 */
router.get('/run/status', (req, res) => {
    const { jobId } = req.query;
    if (!jobId || typeof jobId !== 'string') {
        return res.status(400).json({ success: false, message: 'jobId が必要です。' });
    }
    const p = getProgress(jobId);
    if (!p) return res.status(404).json({ success: false, message: 'job が見つかりません。' });
    res.json({ success: true, ...p });
});

// --- C#補助プロキシ（必要な場合のみ残す） ---
const CSHARP_SERVER_URL = 'http://127.0.0.1:6000/api/csharp';
const proxyRequest = async (req: any, res: any, endpoint: string) => {
    try {
        const url = `${CSHARP_SERVER_URL}/${endpoint}`;
        const axiosResponse = await axios({
            method: req.method,
            url,
            headers: { 'Content-Type': 'application/json' },
            data: req.body
        });
        res.json(axiosResponse.data);
    } catch (error: any) {
        console.error(`エンドポイント ${endpoint} でエラー:`, error.message);
        res.status(500).json({ success: false, message: error.message });
    }
};
router.post('/csharp-complete', (req, res) => proxyRequest(req, res, 'complete'));
router.post('/csharp-diagnose', (req, res) => proxyRequest(req, res, 'diagnose'));
router.post('/csharp-hover', (req, res) => proxyRequest(req, res, 'hover'));
router.post('/csharp-signatureHelp', (req, res) => proxyRequest(req, res, 'signatureHelp'));
router.post('/csharp-tabCompletion', (req, res) => proxyRequest(req, res, 'tabCompletion'));
router.post('/csharp-codefix', (req, res) => proxyRequest(req, res, 'codefix'));

export default router;