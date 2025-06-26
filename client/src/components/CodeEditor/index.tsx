import React, { useRef, useEffect } from 'react';
import MonacoEditor, {
    type OnMount,
    type BeforeMount,
    type Monaco
} from '@monaco-editor/react';
import * as monacoEditor from 'monaco-editor';
import debounce from 'lodash.debounce';
import styles from './CodeEditor.module.css';
import Button from '../shared/Button';
import type { LangOption } from '../../utils/types';

// C#用の診断・補完ロジック（サーバー呼び出し）
import { diagnoseCSharpCode, registerCSharpProviders } from './csharpLogic';
// TypeScript用のローカル診断・補完ロジック
import { setupTypeScriptDefaults, registerTypeScriptProviders } from './typescriptLogic';

interface CodeEditorProps {
    userId: string;
    initialCode: string;
    onCodeChange: (code: string) => void;
    language: LangOption; // 'csharp' or 'typescript'
}

const CodeEditor: React.FC<CodeEditorProps> = ({
    userId,
    initialCode,
    onCodeChange,
    language
}) => {
    // エディタおよびMonacoインスタンスを参照保持するRef
    const editorRef = useRef<monacoEditor.editor.IStandaloneCodeEditor | null>(null);
    const monacoRef = useRef<Monaco | null>(null);

    // テーマやフォントサイズなどのUI用ステート
    const [fontSize, setFontSize] = React.useState<number>(14);
    const [theme, setTheme] = React.useState<'light' | 'dark'>('light');

    // 言語別のダーク/ライトテーマ名を設定
    const darkTheme: string = (language === 'csharp') ? 'csharp-dark' : 'typescript-dark';
    const lightTheme: string = (language === 'csharp') ? 'csharp-light' : 'typescript-light';
    const editorTheme: string = (theme === 'dark') ? darkTheme : lightTheme;

    // Editor内でコピーしたテキストを保持するための変数
    const lastEditorCopiedText = useRef<string | null>(null);
    const isLineCopyRef = useRef<boolean | null>(null);

    // Monaco Editor の各種オプション
    const editorOptions: monacoEditor.editor.IStandaloneEditorConstructionOptions = {
        fontSize,
        automaticLayout: true,
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        wordWrap: 'on',
        tabSize: 2,
        insertSpaces: true,
        folding: true,
        renderLineHighlight: 'all',
        cursorStyle: 'line',
        cursorBlinking: 'smooth',
        acceptSuggestionOnEnter: 'on',
        renderValidationDecorations: 'on',
        acceptSuggestionOnCommitCharacter: true,
        quickSuggestions: { other: true, comments: false, strings: true },
        tabCompletion: 'on',
        contextmenu: false,
        scrollbar: { alwaysConsumeMouseWheel: false },
    };

    /**
     * エディタがマウントする前に呼ばれるコールバック。
     * 言語別にテーマを定義する。
     */
    const handleEditorWillMount: BeforeMount = (monaco) => {
        if (language === 'csharp') {
            // C#用テーマを定義
            monaco.editor.defineTheme('csharp-dark', {
                base: 'vs-dark',
                inherit: true,
                rules: [
                    { token: 'keyword', foreground: '569CD6', fontStyle: 'bold' },
                    { token: 'string', foreground: 'D69D85' },
                    { token: 'comment', foreground: '6A9955', fontStyle: 'italic' },
                    { token: 'function', foreground: 'DCDCAA' },
                ],
                colors: { 'editor.background': '#1E1E1E' },
            });
            monaco.editor.defineTheme('csharp-light', {
                base: 'vs',
                inherit: true,
                rules: [
                    { token: 'keyword', foreground: '0000FF', fontStyle: 'bold' },
                    { token: 'string', foreground: 'A31515' },
                    { token: 'comment', foreground: '6A9955', fontStyle: 'italic' },
                    { token: 'function', foreground: '795E26' },
                ],
                colors: { 'editor.background': '#FFFFFF' },
            });
        } else {
            // TypeScript用テーマを定義
            monaco.editor.defineTheme('typescript-dark', {
                base: 'vs-dark',
                inherit: true,
                rules: [
                    { token: 'keyword', foreground: '569CD6', fontStyle: 'bold' },
                    { token: 'string', foreground: 'D69D85' },
                    { token: 'comment', foreground: '6A9955', fontStyle: 'italic' },
                    { token: 'function', foreground: 'DCDCAA' },
                ],
                colors: { 'editor.background': '#1E1E1E' },
            });
            monaco.editor.defineTheme('typescript-light', {
                base: 'vs',
                inherit: true,
                rules: [
                    { token: 'keyword', foreground: '0000FF', fontStyle: 'bold' },
                    { token: 'string', foreground: 'A31515' },
                    { token: 'comment', foreground: '6A9955', fontStyle: 'italic' },
                    { token: 'function', foreground: '795E26' },
                ],
                colors: { 'editor.background': '#FFFFFF' },
            });
        }
    };

    /**
     * エディタがマウント完了した後に呼ばれるコールバック。
     * エディタインスタンス・monacoインスタンスをRefに保持し、
     * 言語別のプロバイダー登録などを行う。
     */
    const handleEditorDidMount: OnMount = (editor, monaco) => {
        editorRef.current = editor;
        monacoRef.current = monaco;

        if (language === 'csharp') {
            // C#向け：補完やシグネチャなどのプロバイダーを設定
            registerCSharpProviders(monaco, userId);
        } else {
            // TypeScript向け：TypeScriptのデフォルト設定やプロバイダー
            setupTypeScriptDefaults(monaco);
            registerTypeScriptProviders(monaco);
        }

        // monaco-editorのKeyコードは以下になる
        // https://microsoft.github.io/monaco-editor/typedoc/enums/KeyCode.html
        // C: 33、S: 49、V: 52、X: 54
        const KeyC = 33, KeyS = 49, KeyV = 52, KeyX = 54;

        /**
         * Editor内でコピー／カットされたテキストを記録する
         */
        const handleCopyOrCut = () => {
            const selection = editor.getSelection();
            if (!selection) return;
            const model = editor.getModel();
            if (!model) return;

            let copiedText = '';
            if (selection.isEmpty()) {
                // 行コピー/行カット
                const lineNumber = selection.startLineNumber;
                const lineContent = model.getLineContent(lineNumber);
                isLineCopyRef.current = true;
                copiedText = `${lineContent}\n`;
            } else {
                // 通常の選択範囲
                isLineCopyRef.current = false;
                copiedText = model.getValueInRange(selection);
            }
            lastEditorCopiedText.current = copiedText;
        }

        /**
         * 「Editor 内コピーだけ貼り付け可能」にする貼り付け処理
         * - 行コピーの場合は「現在の行に挿入」してカーソルを最後へ移動
         * - 範囲コピーの場合は現在の選択範囲を上書きし、カーソルを末尾へ
         */
        const handlePaste = async () => {
            try {
                // クリップボード文字列を取得 & 改行コードを LF(\n) に統一
                let clipText = await navigator.clipboard.readText();
                clipText = clipText.replace(/\r\n/g, '\n');

                // Editor 内コピーと一致しなければ、
                if (clipText !== lastEditorCopiedText.current) {
                    window.dispatchEvent(new CustomEvent('monaco-editor-paste'));
                    return;
                }

                // 選択範囲(= カーソル情報)が無い場合は何もせず終了
                const selection = editor.getSelection();
                if (!selection) return;

                // 行コピー or 通常コピーで分岐
                if (isLineCopyRef.current) {
                    // ---- 行コピーの場合 ----
                    const lineNumber = selection.startLineNumber;

                    // 挿入先: (lineNumber, col=1) の位置に clipText を差し込む
                    // ※ ここで "行を押し下げる" 挙動
                    const insertPos = new monacoEditor.Range(
                        lineNumber, 1,
                        lineNumber, 1
                    );

                    // テキストの行数・最終行の文字長を算出
                    const lines = clipText.split('\n');
                    if (lines[lines.length - 1] === '') {
                        // 最終行が空文字列(末尾改行)の場合は pop
                        lines.pop();
                    }
                    const lineCount = lines.length;
                    const lastLineLen = lines[lineCount - 1].length;

                    // 貼り付け後のカーソル位置を、挿入した最終行の末尾に設定
                    editor.executeEdits(
                        null,
                        [
                            {
                                range: insertPos,
                                text: clipText,
                                forceMoveMarkers: true
                            }
                        ],
                        [
                            // 貼り付け後のカーソル位置 (最後の行末尾)
                            new monacoEditor.Selection(
                                lineNumber + lineCount,
                                lastLineLen + 1,
                                lineNumber + lineCount,
                                lastLineLen + 1
                            )
                        ]
                    );
                } else {
                    // ---- 通常の範囲コピーの場合 ----
                    // 選択範囲を上書きし、その末尾にカーソルを移動
                    const lines = clipText.split('\n');
                    if (lines[lines.length - 1] === '') {
                        lines.pop();
                    }
                    const lineCount = lines.length;
                    const lastLineLen = lines[lineCount - 1].length;

                    const { startLineNumber, startColumn } = selection;
                    const endLine = startLineNumber + (lineCount - 1);

                    // 単一行 or 複数行でカーソル末尾の計算が変わる
                    const endColumn = (lineCount === 1)
                        ? (startColumn + lastLineLen)
                        : (lastLineLen + 1);

                    editor.executeEdits(
                        null,
                        [
                            {
                                range: selection,
                                text: clipText,
                                forceMoveMarkers: true
                            }
                        ],
                        [
                            new monacoEditor.Selection(
                                endLine,
                                endColumn,
                                endLine,
                                endColumn
                            )
                        ]
                    );
                }
            } catch (err) {
                console.warn('Clipboard read failed:', err);
            }
        }

        // Ctrl/Cmd + C / V / S / X をフック
        editor.onKeyDown(async (event) => {
            // “Ctrl/Cmd が押されていなければ” 早期 return
            if (!event.ctrlKey && !event.metaKey) return;

            switch (event.keyCode) {
                case KeyC:
                case KeyX:
                    handleCopyOrCut();
                    break;

                case KeyS:
                    // 保存ショートカットをブロック
                    event.preventDefault();
                    break;

                case KeyV:
                    // 一旦標準の貼り付けをブロック
                    event.preventDefault();
                    await handlePaste();
                    break;

                default:
                    // それ以外は何もしない
                    break;
            }
        });
    };

    /**
     * C#の診断をサーバーに依頼するのをdebounceして呼び出す。
     * TypeScriptの場合は不要だが、フロントで一元管理している。
     */
    const debouncedGetDiagnostics = useRef(
        debounce((code: string) => {
            if (language === 'csharp') {
                // C#のみサーバー診断を実行
                const monaco = monacoRef.current;
                const editor = editorRef.current;
                if (monaco && editor) {
                    const model = editor.getModel();
                    if (model) {
                        diagnoseCSharpCode(code, model, monaco);
                    }
                }
            }
            // コールバックを呼んで上位コンポーネントに反映
            onCodeChange(code);
        }, 500)
    ).current;

    /**
     * 親から initialCode が変わったときに診断を再走させる
     */
    useEffect(() => {
        debouncedGetDiagnostics(initialCode);
    }, [initialCode, debouncedGetDiagnostics]);

    /**
     * ユーザーがエディタでタイプした時のコールバック。
     * (monacoEditor が onChange で呼び出す)
     */
    const handleEditorChange = (value?: string) => {
        if (value !== undefined) {
            debouncedGetDiagnostics(value);
        }
    };

    return (
        <div style={{ position: 'relative', height: '100%' }}>
            <div className={styles.editorContainer}>
                {/* エディタのヘッダ（ボタン類） */}
                <div className={styles.editorHeader}>
                    <div className={styles.editorTitle}>解答コード入力欄</div>
                    <div className={styles.editorControls}>
                        <Button onClick={() => setFontSize(prev => Math.min(prev + 1, 32))}>拡大</Button>
                        <Button onClick={() => setFontSize(prev => Math.max(prev - 1, 8))}>縮小</Button>
                        <Button onClick={() => setTheme('light')}>ライト</Button>
                        <Button onClick={() => setTheme('dark')}>ダーク</Button>
                    </div>
                </div>

                <div className={styles.editorBody}>
                    {/* MonacoEditor本体 */}
                    <MonacoEditor
                        height="400px"
                        language={language === 'csharp' ? 'csharp' : 'typescript'}
                        theme={editorTheme}
                        value={initialCode}
                        onChange={handleEditorChange}
                        beforeMount={handleEditorWillMount}
                        onMount={handleEditorDidMount}
                        options={editorOptions}
                    />
                </div>
            </div>
        </div>
    );
};

export default CodeEditor;