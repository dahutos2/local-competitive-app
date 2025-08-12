// パス/行番号をマスク
export function sanitizeOutput(output: string): string {
    // ファイルパスのマッチ（ディレクトリ区切り文字を必須）
    const pathRegex =
        /(?:[A-Za-z]:\\|\/|\.{1,2}[\\/])(?:[\w.-]+[\\/])+[\w.-]+\.\w+/g;

    // ソースコードの行番号のマッチ
    const lineNumberRegex = /in .*?:line \d+/g;

    // パスと行番号をそれぞれ置換
    let sanitizedOutput = output.replace(pathRegex, "[PATH]");
    sanitizedOutput = sanitizedOutput.replace(lineNumberRegex, "[LINE INFO]");

    return sanitizedOutput.trim();
}

// 改行/空白を正規化
export function normalizeOutput(output: string): string {
    return output
        .replace(/\r\n/g, "\n") // 改行コードを統一
        .trim(); // 両端の空白を削除
}
