import express from 'express';
import {
  runCsCode,
  runTsCode,
  initializeUser,
  disqualifyUser,
  getUserState,
  getResult,
} from './runCode';
import cors from 'cors';
import path from 'path';
import axios from 'axios';

const app = express();
const PORT = 4000;

// CORS設定（必要に応じて調整）
app.use(cors());

// JSONパースミドルウェア
app.use(express.json());

// 静的ファイルの提供（必要に応じて）
app.use(express.static(path.join(__dirname, '../../client/build')));

// ログインエンドポイント
app.post('/api/login', (req, res) => {
  const { userId, mode, timeLimitSec } = req.body;
  if (!userId || !mode || (mode === 'task' && !timeLimitSec)) {
    return res.status(400).json({ success: false, output: 'userId, mode, および task モードの場合は timeLimitSec が必要です。' });
  }
  initializeUser(userId, mode, timeLimitSec);
  res.json({ success: true });
});

// ユーザー状態取得エンドポイント
app.get('/api/user-state', (req, res) => {
  const { userId } = req.query;
  if (!userId || typeof userId !== 'string') {
    return res.status(400).json({ success: false, output: 'userIdが必要です。' });
  }
  const userState = getUserState(userId);
  if (!userState) {
    return res.status(404).json({ success: false, output: 'ユーザーが見つかりません。' });
  }

  let remainingTime: number | undefined = undefined;

  if (userState.mode === 'task' && userState.taskStartTime && userState.timeLimitSec) {
    const elapsed = Math.floor((Date.now() - userState.taskStartTime) / 1000);
    remainingTime = userState.timeLimitSec - elapsed;

    if (remainingTime <= 0 && !userState.disqualified) {
      disqualifyUser(userId);
      remainingTime = 0;
    }
  }

  res.json({ success: true, userState: { ...userState, remainingTime } });
});

// 失格エンドポイント
app.post('/api/disqualify', (req, res) => {
  const { userId } = req.body;
  if (!userId) {
    return res.status(400).json({ success: false, output: 'userIdが必要です。' });
  }
  disqualifyUser(userId);
  res.json({ success: true });
});

// 結果取得エンドポイント
app.get('/api/get-result', async (req, res) => {
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

// C#コード実行エンドポイント（isSubmitパラメータを受け取る）
app.post('/api/run-cs', async (req, res) => {
  const { code, testCases, userId, isSubmit } = req.body;
  if (!userId || !testCases || !Array.isArray(testCases)) {
    return res.status(400).json({ success: false, output: 'userIdと複数のtestCasesが必要です。' });
  }
  try {
    const testCaseResults = await runCsCode(code, testCases, userId, isSubmit);
    res.json({ success: true, output: testCaseResults });
  } catch (error: any) {
    res.json({ success: false, output: error.message });
  }
});

// TypeScriptコード実行エンドポイント
app.post('/api/run-ts', async (req, res) => {
  const { code, testCases, userId, isSubmit } = req.body;
  if (!userId || !testCases || !Array.isArray(testCases)) {
    return res.status(400).json({ success: false, output: 'userIdと複数のtestCasesが必要です。' });
  }
  try {
    const testCaseResults = await runTsCode(code, testCases, userId, isSubmit);
    res.json({ success: true, output: testCaseResults });
  } catch (error: any) {
    res.json({ success: false, output: error.message });
  }
});

// モード切り替えエンドポイント
app.post('/api/switch-mode', (req, res) => {
  const { userId, timeLimitSec } = req.body;
  if (!userId || !timeLimitSec) {
    return res.status(400).json({ success: false, output: 'userIdとtimeLimitSecが必要です。' });
  }
  const userState = getUserState(userId);
  if (!userState) {
    return res.status(404).json({ success: false, output: 'ユーザーが見つかりません。' });
  }
  userState.mode = 'task';
  // 既に remainingTime が設定されている場合は上書きしない
  if (userState.taskStartTime === undefined) {
    userState.taskStartTime = Date.now();
    userState.timeLimitSec = timeLimitSec;
  }
  res.json({ success: true, output: '本番モードに切り替えました。' });
});

// C#サーバーのURL
const CSHARP_SERVER_URL = 'http://127.0.0.1:6000/api/csharp';

// プロキシ関数
const proxyRequest = async (req: express.Request, res: express.Response, endpoint: string) => {
  try {
    const url = `${CSHARP_SERVER_URL}/${endpoint}`;
    const axiosResponse = await axios({
      method: req.method,
      url,
      headers: { 'Content-Type': 'application/json' },
      data: req.body
    });

    // axiosが status >= 400 なら例外を投げるため、ここに来る段階で成功ステータス
    const data = axiosResponse.data;
    res.json(data);

  } catch (error: any) {
    // axiosが4xx/5xxを検知した場合もここに入る
    console.error(`エンドポイント ${endpoint} でエラーが発生しました:`, error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};
app.post('/api/csharp-complete', (req, res) => proxyRequest(req, res, 'complete'));
app.post('/api/csharp-diagnose', (req, res) => proxyRequest(req, res, 'diagnose'));
app.post('/api/csharp-hover', (req, res) => proxyRequest(req, res, 'hover'));
app.post('/api/csharp-signatureHelp', (req, res) => proxyRequest(req, res, 'signatureHelp'));
app.post('/api/csharp-tabCompletion', (req, res) => proxyRequest(req, res, 'tabCompletion'));
app.post('/api/csharp-codefix', (req, res) => proxyRequest(req, res, 'codefix'));

// 全てのルートをReactアプリにフォワード
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../../client/build', 'index.html'));
});

// サーバー起動
app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
