import fs from 'node:fs';
import { getLogFilePath } from './paths';

let logStream: fs.WriteStream | undefined;
let currentDate = '';

function rotateIfNeeded() {
    const now = new Date();
    const logFile = getLogFilePath(now);
    const dateStr = logFile.split('/').pop()?.replace('.log', '');

    if (dateStr && dateStr !== currentDate) {
        if (logStream) logStream.end();
        logStream = fs.createWriteStream(logFile, { flags: 'a', encoding: 'utf8' });
        currentDate = dateStr;
    }
}

function writeLog(level: string, ...args: unknown[]) {
    rotateIfNeeded();
    const ts = new Date().toISOString();
    const msg = args.map(a => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ');
    const line = `[${ts}] [${level}] ${msg}\n`;
    logStream?.write(line);
}

export function initLogger() {
    const orig = { log: console.log, info: console.info, warn: console.warn, error: console.error };

    console.log = (...a) => { orig.log(...a); writeLog('INFO', ...a); };
    console.info = (...a) => { orig.info(...a); writeLog('INFO', ...a); };
    console.warn = (...a) => { orig.warn(...a); writeLog('WARN', ...a); };
    console.error = (...a) => { orig.error(...a); writeLog('ERROR', ...a); };
}
