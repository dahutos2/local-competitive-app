import { spawn } from 'child_process';
import { sanitizeOutput } from './output';
import { CommandError } from '../type';

/**
 * 子プロセス実行（タイムアウト/猶予/出力制限対応）
 * 失敗時は CommandError を throw（stdout/stderr同梱）
 */
type ExecOptions = {
    enableTimeout?: boolean;
    timeoutMs?: number;
    killGraceMs?: number;
    maxOutputBytes?: number;
};

const EXEC_TIMEOUT_MS = Number(process.env.EXEC_TIMEOUT_MS ?? 15000);
const EXEC_KILL_GRACE_MS = Number(process.env.EXEC_KILL_GRACE_MS ?? 2000);
const EXEC_MAX_OUTPUT_BYTES = Number(process.env.EXEC_MAX_OUTPUT_BYTES ?? 5_000_000);

export function executeCommand(
    cmd: string,
    args: string[],
    cwd: string,
    input?: string,
    options?: ExecOptions
): Promise<{ stdout: string; stderr: string }> {
    const {
        enableTimeout = false,
        timeoutMs = EXEC_TIMEOUT_MS,
        killGraceMs = EXEC_KILL_GRACE_MS,
        maxOutputBytes = EXEC_MAX_OUTPUT_BYTES,
    } = options ?? {};

    return new Promise((resolve, reject) => {
        const child = spawn(cmd, args, { cwd, shell: true });

        let stdout = '';
        let stderr = '';
        let isTimeout = false;

        let timeoutId: NodeJS.Timeout | null = null;
        let killTimer: NodeJS.Timeout | null = null;

        if (enableTimeout) {
            timeoutId = setTimeout(() => {
                isTimeout = true;
                try { child.kill('SIGTERM'); } catch { }
                killTimer = setTimeout(() => { try { child.kill('SIGKILL'); } catch { } }, killGraceMs);
            }, timeoutMs);
        }

        const maybeAppend = (buf: Buffer, kind: 'out' | 'err') => {
            const chunk = buf.toString();
            if (kind === 'out') {
                if (Buffer.byteLength(stdout, 'utf8') < maxOutputBytes) {
                    stdout += chunk;
                }
                return;
            }
            if (Buffer.byteLength(stderr, 'utf8') < maxOutputBytes) {
                stderr += chunk;
            }
        };

        child.stdout.on('data', (d) => maybeAppend(d, 'out'));
        child.stderr.on('data', (d) => maybeAppend(d, 'err'));

        child.on('error', (error) => {
            if (timeoutId) clearTimeout(timeoutId);
            if (killTimer) clearTimeout(killTimer);
            reject(new CommandError(
                `コマンド実行エラー: ${sanitizeOutput(String(error?.message ?? error))}`,
                sanitizeOutput(stdout),
                sanitizeOutput(stderr)
            ));
        });

        child.on('close', (code) => {
            if (timeoutId) clearTimeout(timeoutId);
            if (killTimer) clearTimeout(killTimer);

            const sOut = sanitizeOutput(stdout);
            const sErr = sanitizeOutput(stderr);

            if (code !== 0) {
                const timeoutText = isTimeout ? '実行時間が制限を超えたため強制終了しました。' : '';
                reject(new CommandError(
                    `コマンドが非正常終了しました。終了コード: ${code}`,
                    `${timeoutText}${sOut}`,
                    `${timeoutText}${sErr}`
                ));
                return;
            }
            resolve({ stdout: sOut, stderr: sErr });
        });

        if (input) child.stdin.write(input);
        child.stdin.end();
    });
}