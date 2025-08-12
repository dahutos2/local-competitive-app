import express from 'express';
import cors from 'cors';
import path from 'path';
import dotenv from 'dotenv';
import routes from './api/routes';
import { initLogger } from './utils/logger';

// ルート直下の .env を読む（dev / release 共通で process.cwd() をルートに）
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

// ロガー初期化
initLogger();

const app = express();
const PORT = Number(process.env.PORT ?? 4000);

// ミドルウェア
app.use(cors());
app.use(express.json());

// 静的ファイル（Reactビルド配信。必要なければ削除可）
app.use(express.static(path.join(__dirname, '../../client/build')));

// API ルート
app.use('/api', routes);

// React へフォワード（必要な場合のみ）
app.get('*', (_req, res) => {
    res.sendFile(path.join(__dirname, '../../client/build', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Server listening on http://localhost:${PORT}`);
});