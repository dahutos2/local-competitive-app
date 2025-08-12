import fs from 'fs';
import path from 'path';

/** YYYY-MM-DD 文字列を返す */
export function getDateString(d: Date = new Date()): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

/** ディレクトリを必ず作る（なければ再帰的に作成） */
export function ensureDir(dir: string): void {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

/**
 * var/YYYY-MM-DD/{subdir} のパスを作成して返す
 * 例: getVarDir('results') -> /abs/path/var/2025-08-12/results
 */
export function getVarDir(subdir: 'results' | 'temp', date: Date = new Date()): string {
    const dateStr = getDateString(date);
    const dir = path.join(process.cwd(), 'var', dateStr, subdir);
    ensureDir(dir);
    return dir;
}

/** logs/YYYY-MM-DD.log のパス */
export function getLogFilePath(date: Date = new Date()): string {
    const dateStr = getDateString(date);
    const logsDir = path.join(process.cwd(), 'logs');
    ensureDir(logsDir);
    return path.join(logsDir, `${dateStr}.log`);
}
