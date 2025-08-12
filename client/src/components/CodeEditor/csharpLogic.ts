/* eslint-disable @typescript-eslint/no-explicit-any */

import * as monacoEditor from 'monaco-editor';

/**
 * サーバーにC#の診断を依頼し、markersを更新する。
 * @param code ユーザーの入力C#コード
 * @param model Monacoのテキストモデル
 * @param monaco Monacoインスタンス
 */
export async function diagnoseCSharpCode(
    code: string,
    model: monacoEditor.editor.ITextModel,
    monaco: typeof monacoEditor
) {
    try {
        const response = await fetch('/api/csharp-diagnose', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code }),
        });
        if (!response.ok) {
            throw new Error(`C#診断サーバーエラー: ${response.statusText}`);
        }
        const data = await response.json();
        const { errors = [], warnings = [] } = data;

        const DOC_BASE_URL = 'https://learn.microsoft.com/ja-jp/dotnet/csharp/misc/';

        // エラーと警告を統合し、それぞれに対応するseverityを設定
        const combinedMarkers = [
            ...errors.map((err: any) => ({ ...err, severity: monacoEditor.MarkerSeverity.Error })),
            ...warnings.map((warn: any) => ({ ...warn, severity: monacoEditor.MarkerSeverity.Warning })),
        ];

        // マーカーの生成
        const newMarkers: monacoEditor.editor.IMarkerData[] = combinedMarkers.map((marker: any) => ({
            severity: marker.severity,
            startLineNumber: marker.line,
            startColumn: marker.character,
            endLineNumber: marker.line,
            endColumn: marker.character + 1,
            message: marker.message,
            code: {
                value: marker.id,
                target: monaco.Uri.parse(`${DOC_BASE_URL}${marker.id}`),
            },
        }));

        monaco.editor.setModelMarkers(model, 'csharp', newMarkers);
    } catch (error) {
        console.error('C#の診断リクエストに失敗:', error);
    }
}

/**
 * C#向けの補完・ホバー・シグネチャなどを登録する。
 * サーバーを呼び出して結果を返すイメージ。
 * @param monaco Monacoインスタンス
 * @param userId ユーザーID等（サーバーに渡す想定）
 */
export function registerCSharpProviders(
    monaco: typeof monacoEditor,
    userId: string
) {
    // --- 補完 ---
    monaco.languages.registerCompletionItemProvider('csharp', {
        triggerCharacters: ['.', ' '],
        provideCompletionItems: async (model, position) => {
            const code = model.getValue();
            const cursorPosition = model.getOffsetAt(position);

            try {
                const res = await fetch('/api/csharp-complete', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId, code, cursorPosition }),
                });
                if (!res.ok) {
                    throw new Error(`C#補完サーバーエラー: ${res.statusText}`);
                }
                const data = await res.json();
                const suggestionsRaw = data.suggestions ?? [];

                const suggestions = suggestionsRaw.map((item: any) => {
                    const kindEnum = (monaco.languages.CompletionItemKind as any)[item.kind] ?? monaco.languages.CompletionItemKind.Text;

                    // メイン編集の範囲を算出
                    const main = item.mainTextChange;
                    if (!main.newText) return null;
                    const startPos = model.getPositionAt(main.start);
                    const endPos = model.getPositionAt(main.end);
                    const mainRange = new monaco.Range(
                        startPos.lineNumber, startPos.column,
                        endPos.lineNumber, endPos.column
                    );
                    // 追加編集の範囲を算出
                    const additionalTextEdits: monacoEditor.languages.TextEdit[] = [];
                    if (Array.isArray(item.additionalTextChanges)) {
                        item.additionalTextChanges.forEach((tc: any) => {
                            const s = model.getPositionAt(tc.start);
                            const e = model.getPositionAt(tc.end);
                            additionalTextEdits.push({
                                range: new monaco.Range(s.lineNumber, s.column, e.lineNumber, e.column),
                                text: tc.newText
                            });
                        });
                    }
                    // 複数変更ありの場合は、追加編集のみを行う
                    const isMulti = additionalTextEdits.length > 1;
                    const pos = model.getPositionAt(cursorPosition);
                    const additionalRange = new monaco.Range(pos.lineNumber, pos.column, pos.lineNumber, pos.column);
                    const suggestion: monacoEditor.languages.CompletionItem = {
                        label: item.label,
                        kind: kindEnum,
                        detail: item.detail ?? '',
                        insertText: isMulti ? '' : main.newText,
                        range: isMulti ? additionalRange : mainRange,
                        additionalTextEdits: isMulti ? additionalTextEdits : undefined,
                    };

                    // スニペット候補の場合は、余分なインデントが付加されるのを防ぐ
                    if (kindEnum === monaco.languages.CompletionItemKind.Snippet) {
                        suggestion.insertTextRules =
                            monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet |
                            monaco.languages.CompletionItemInsertTextRule.KeepWhitespace;
                    }

                    return suggestion;
                });

                return { suggestions };
            } catch (err) {
                console.error('C#補完失敗:', err);
                return { suggestions: [] };
            }
        }
    });

    // --- ホバー ---
    monaco.languages.registerHoverProvider('csharp', {
        provideHover: async (model, position) => {
            const code = model.getValue();
            const cursorPosition = model.getOffsetAt(position);

            try {
                const res = await fetch('/api/csharp-hover', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId, code, position: cursorPosition }),
                });
                if (!res.ok) {
                    throw new Error(`C#ホバーサーバーエラー: ${res.statusText}`);
                }
                const data = await res.json();
                if (data.information) {
                    return { contents: [{ value: data.information }] };
                }
                return null;
            } catch (error) {
                console.error('C#ホバーリクエスト失敗:', error);
                return null;
            }
        }
    });

    // --- シグネチャヘルプ ---
    monaco.languages.registerSignatureHelpProvider('csharp', {
        signatureHelpTriggerCharacters: ['(', ','],
        provideSignatureHelp: async (model, position) => {
            const code = model.getValue();
            const cursorPosition = model.getOffsetAt(position);
            try {
                const res = await fetch('/api/csharp-signatureHelp', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId, code, position: cursorPosition }),
                });
                if (!res.ok) {
                    throw new Error(`C#シグネチャサーバーエラー: ${res.statusText}`);
                }

                const data = await res.json();
                if (data.signatures && data.activeSignature !== undefined && data.activeParameter !== undefined) {
                    return {
                        value: {
                            signatures: data.signatures,
                            activeSignature: data.activeSignature,
                            activeParameter: data.activeParameter
                        },
                        dispose: () => { }
                    };
                }
            } catch (error) {
                console.error('C#シグネチャヘルプリクエスト失敗:', error);
            }
            return null;
        }
    });

    // --- タブ補完 ---
    monaco.languages.registerCompletionItemProvider('csharp', {
        triggerCharacters: ['.', ' '],
        provideCompletionItems: async (model, position) => {
            const code = model.getValue();
            const cursorPosition = model.getOffsetAt(position);

            try {
                const res = await fetch('/api/csharp-tabCompletion', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId, code, position: cursorPosition }),
                });
                if (!res.ok) {
                    throw new Error(`C#タブ補完サーバーエラー: ${res.statusText}`);
                }

                const data = await res.json();
                const items = data.suggestions ?? [];
                const suggestions = items.map((item: any) => ({
                    label: item.suggestion,
                    kind: monaco.languages.CompletionItemKind.Function,
                    insertText: item.suggestion,
                    detail: item.description ?? ''
                }));

                return { suggestions };
            } catch (error) {
                console.error('C#タブ補完リクエスト失敗:', error);
                return { suggestions: [] };
            }
        }
    });

    // --- クイックフィックスの登録 ---
    monaco.languages.registerCodeActionProvider('csharp', {
        provideCodeActions: async (model, range, context) => {
            const code = model.getValue();
            const position = model.getOffsetAt(range.getStartPosition());

            // 診断情報を取得
            const diagnostics = context.markers
                .filter(marker =>
                    (marker.severity === monaco.MarkerSeverity.Warning ||
                        marker.severity === monaco.MarkerSeverity.Error) &&
                    range.startLineNumber === marker.startLineNumber &&
                    range.startColumn === marker.startColumn &&
                    range.endLineNumber === marker.endLineNumber &&
                    range.endColumn === marker.endColumn
                );

            if (diagnostics.length === 0) {
                return {
                    actions: [],
                    dispose: () => { }
                };
            }

            try {
                // 診断情報をまとめて送信
                const res = await fetch('/api/csharp-codefix', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId, code, position: position }),
                });

                if (!res.ok) {
                    throw new Error(`C#CodeFixサーバーエラー: ${res.statusText}`);
                }

                interface CodeFix {
                    diagnostic: string;
                    title: string;
                    text: string;
                    range: {
                        startLineNumber: number;
                        startColumn: number;
                        endLineNumber: number;
                        endColumn: number;
                    };
                }
                const data: { fixes: CodeFix[] } = await res.json();
                if (!data.fixes || data.fixes.length === 0) {
                    return {
                        actions: [],
                        dispose: () => { }
                    };
                }

                const actions: monacoEditor.languages.CodeAction[] = [];
                const appliedFixes = new Set<string>();

                for (const diagnostic of diagnostics) {
                    // 現在の診断に対応する修正のみを抽出
                    const fixesForDiagnostic = data.fixes.filter(fix => fix.diagnostic === diagnostic.message);
                    for (const fix of fixesForDiagnostic) {
                        const fixIdentifier = `${fix.text}-${fix.diagnostic}`;
                        if (appliedFixes.has(fixIdentifier)) {
                            continue; // 同じ修正はスキップ
                        }
                        appliedFixes.add(fixIdentifier);

                        actions.push({
                            title: fix.title,
                            edit: {
                                edits: [
                                    {
                                        resource: model.uri,
                                        textEdit: {
                                            range: new monaco.Range(
                                                fix.range.startLineNumber,
                                                fix.range.startColumn,
                                                fix.range.endLineNumber,
                                                fix.range.endColumn
                                            ),
                                            text: fix.text,
                                        },
                                        versionId: model.getVersionId()
                                    }
                                ],
                            },
                            diagnostics: [diagnostic],
                            kind: 'quickfix'
                        });
                    }
                }

                return {
                    actions,
                    dispose: () => { }
                };
            } catch (error) {
                console.error('C#CodeFixリクエスト失敗:', error);
                return {
                    actions: [],
                    dispose: () => { }
                };
            }
        }
    });
}