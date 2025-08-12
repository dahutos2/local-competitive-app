import { v4 as uuidv4 } from 'uuid';
import type { JobProgress, RunRequestPayload, TestCaseResult } from '../type';

// Worker: リクエスト + 進捗コールバック → テスト結果配列
type Worker = (req: RunRequestPayload, onProgress: (p: number, m?: string) => void) => Promise<Readonly<TestCaseResult[]>>;

const concurrency = Number(process.env.JOB_CONCURRENCY ?? 2);

const queue: Array<{ id: string; req: RunRequestPayload }> = [];
const progresses = new Map<string, JobProgress>();
let running = 0;
let workerFn: Worker;

export function setWorker(fn: Worker) {
    workerFn = fn;
}

export function enqueue(req: RunRequestPayload): string {
    const id = uuidv4();
    const now = Date.now();
    progresses.set(id, { jobId: id, status: 'queued', progress: 0, updatedAt: now });
    queue.push({ id, req });
    tick();
    return id;
}

export function getProgress(jobId: string): JobProgress | undefined {
    return progresses.get(jobId);
}

function tick() {
    if (!workerFn) return;
    if (running >= concurrency) return;
    const item = queue.shift();
    if (!item) return;

    running++;
    const { id, req } = item;

    update(id, { status: 'running', progress: 1, message: '準備中' });

    workerFn(req, (p, m) => {
        update(id, { status: 'running', progress: Math.max(1, Math.min(99, Math.round(p))), message: m });
    }).then((result) => {
        update(id, { status: 'succeeded', progress: 100, message: '完了', result: result as TestCaseResult[] });
    }).catch((e: any) => {
        update(id, { status: 'failed', progress: 100, error: e?.message ?? String(e), message: '失敗' });
    }).finally(() => {
        running--;
        setImmediate(tick);
    });
}

function update(id: string, patch: Partial<JobProgress>) {
    const prev = progresses.get(id);
    if (!prev) return;
    progresses.set(id, { ...prev, ...patch, updatedAt: Date.now() });
}
