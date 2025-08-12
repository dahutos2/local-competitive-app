import * as monacoEditor from 'monaco-editor';

/**
 * TypeScriptコンパイラオプションを設定する関数。
 * ハードコーディングは行わず、strictチェック等を標準で有効化。
 * @param monaco Monacoインスタンス
 */
export function setupTypeScriptDefaults(monaco: typeof monacoEditor) {
    // TypeScriptのコンパイラオプションを設定
    monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
        target: monaco.languages.typescript.ScriptTarget.ES2019,
        allowNonTsExtensions: true,
        strict: true,
        noEmit: true,
        module: monaco.languages.typescript.ModuleKind.ESNext,
        jsx: monaco.languages.typescript.JsxEmit.React,
    });

    monaco.languages.typescript.typescriptDefaults.addExtraLib(
        `
        declare var require: { (name: string): any; };
        declare var module: any;
        declare module 'fs' { const x: any; export = x; }
        `,
        'ts:node-shims.d.ts'
    );
}

/**
 * TypeScript向けの各種Providerを登録する。
 * @param monaco MonacoEditor インスタンス
 */
export function registerTypeScriptProviders(monaco: typeof monacoEditor) {
    // --- CodeAction(QuickFix) Provider ---
    monaco.languages.registerCodeActionProvider('typescript', {
        /**
         * コードアクションを返すメソッド。
         */
        async provideCodeActions(model, _range, context) {
            const actions: monacoEditor.languages.CodeAction[] = [];

            try {
                // TSワーカーを取得
                const workerGetter = await monaco.languages.typescript.getTypeScriptWorker();
                const worker = await workerGetter(model.uri);

                const fileName = model.uri.toString();

                // markers に対して Quick Fix を探す
                for (const marker of context.markers) {
                    if (!marker.code) {
                        continue;
                    }
                    // markerの行列を0-based offsetに変換
                    const startOffset = model.getOffsetAt({
                        lineNumber: marker.startLineNumber,
                        column: marker.startColumn
                    });
                    const endOffset = model.getOffsetAt({
                        lineNumber: marker.endLineNumber,
                        column: marker.endColumn
                    });

                    // marker.code が string か numberか分からないので Number()で変換
                    const errorCode = Number(marker.code);
                    const codeFixes = await worker.getCodeFixesAtPosition(
                        fileName,
                        startOffset,
                        endOffset,
                        [errorCode],
                        {},
                    );

                    // 取得した CodeFixAction を Monaco CodeAction 形式に変換
                    for (const fix of codeFixes) {
                        // fix.changes: FileTextChanges[]
                        //  -> それぞれの textChanges を IWorkspaceTextEdit に変換する
                        const allEdits: (monacoEditor.languages.IWorkspaceTextEdit | monacoEditor.languages.IWorkspaceFileEdit)[] = [];

                        for (const change of fix.changes) {
                            // "change" の型を (ts.FileTextChanges) として扱うなら import type { FileTextChanges } from 'typescript'
                            const resource = monacoEditor.Uri.parse(change.fileName);

                            for (const tc of change.textChanges) {
                                // 0-based offset => Monaco Range
                                const startPos = model.getPositionAt(tc.span.start);
                                const endPos = model.getPositionAt(tc.span.start + tc.span.length);

                                const text: monacoEditor.languages.IWorkspaceTextEdit = {
                                    resource,
                                    textEdit: {
                                        range: new monacoEditor.Range(
                                            startPos.lineNumber,
                                            startPos.column,
                                            endPos.lineNumber,
                                            endPos.column
                                        ),
                                        text: tc.newText,
                                    },
                                    versionId: tc.id
                                };
                                allEdits.push(text);
                            }
                        }

                        actions.push({
                            title: fix.description,
                            diagnostics: [marker],
                            edit: {
                                edits: allEdits
                            },
                            kind: 'quickfix',
                            // fixMissingImportを優先
                            isPreferred: fix.fixId === 'fixMissingImport'
                        });
                    }
                }
            } catch (error) {
                console.error('TypeScript QuickFix取得失敗:', error);
            }

            return {
                actions,
                dispose() { }
            };
        }
    });
}
