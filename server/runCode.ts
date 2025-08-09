import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import {
  UserState,
  TaskMode,
  CommandError,
  TestCaseResult,
  TestCase,
} from "./types";

const tempDir = path.join(process.cwd(), "temp");
const resultDir = path.join(process.cwd(), "results");

// tempDirとresultDirが存在しない場合は作成
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}
if (!fs.existsSync(resultDir)) {
  fs.mkdirSync(resultDir, { recursive: true });
}

const userStates: { [userId: string]: UserState } = {};

// ユーザーの初期化
export function initializeUser(
  userId: string,
  mode: TaskMode,
  timeLimitSec?: number
): void {
  if (!userStates[userId]) {
    userStates[userId] = {
      disqualified: false,
      completed: false,
      mode,
      taskStartTime: mode === "task" ? Date.now() : undefined,
      timeLimitSec: mode === "task" && timeLimitSec ? timeLimitSec : undefined,
    };
  } else {
    userStates[userId].mode = mode;
  }
}

// ユーザーの失格状態を更新
export function disqualifyUser(userId: string): void {
  const userState = userStates[userId];

  if (userState && userState.mode === "task") {
    userState.disqualified = true;
    writeResultToFile(userId, "失格");
  }
}

// ユーザー状態の取得
export function getUserState(userId: string): UserState | null {
  return userStates[userId] || null;
}

// ユーザーの完了状態を更新
function completeUser(userId: string): void {
  const userState = userStates[userId];
  if (userState && userState.mode === "task") {
    userState.completed = true;
    writeResultToFile(userId, "提出完了");
  }
}

// ユーザー結果をファイルに書き込む関数
function writeResultToFile(userId: string, result: string): void {
  const filePath = path.join(resultDir, `${userId}.txt`);
  const timestamp = new Date().toISOString();
  const content = `結果: ${result}\n日時: ${timestamp}\n`;
  fs.appendFileSync(filePath, content, "utf8");
}

// テストケースごとの結果を保存する関数
function saveTestCaseResults(
  userId: string,
  testCaseResults: TestCaseResult[]
): void {
  const filePath = path.join(resultDir, `${userId}_test_results.json`);
  fs.writeFileSync(filePath, JSON.stringify(testCaseResults, null, 2), "utf8");
}

// ユーザーの検証と残り時間の更新
function validateUser(userId: string): void {
  const userState = userStates[userId];

  if (!userState) {
    throw new Error("ユーザーが初期化されていません。");
  }

  if (userState.mode === "task") {
    if (userState.disqualified) {
      throw new Error("ユーザーは失格状態です。");
    }

    // 残り時間のチェック
    if (userState.taskStartTime && userState.timeLimitSec !== undefined) {
      const elapsed = Math.floor((Date.now() - userState.taskStartTime) / 1000);
      const timeLeft = userState.timeLimitSec - elapsed;

      if (timeLeft <= 0) {
        disqualifyUser(userId);
        throw new Error("時間切れで失格しました。");
      }
    }
  }
}

function sanitizeOutput(output: string): string {
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

function normalizeOutput(output: string): string {
  return output
    .replace(/\r\n/g, "\n") // 改行コードを統一
    .trim(); // 両端の空白を削除
}

// -------------------------------------------------------------------------
// コマンド実行ロジック
// -------------------------------------------------------------------------

/**
 * コマンドを実行し、標準出力と標準エラーを取得する。
 *
 * @param cmd 実行コマンド
 * @param args コマンド引数
 * @param cwd カレントディレクトリ
 * @param input 標準入力に書き込む内容
 * @param enableTimeout 実行時にタイムアウトをかけるか (ビルド時は false, 実行時は true)
 * @param timeoutMs タイムアウトまでのミリ秒 (デフォルトは 15000ms)
 */
function executeCommand(
  cmd: string,
  args: string[],
  cwd: string,
  input?: string,

  // タイムアウト機能を有効にするフラグ、デフォルト無効
  enableTimeout: boolean = false,

  // タイムアウト時間 (ms)
  timeoutMs: number = 15000
): Promise<{ stdout: string; stderr: string }> {

  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { cwd, shell: true });

    let stdout = "";
    let stderr = "";
    let isTimeout = false;

    // タイムアウトを設定するかどうか
    let timeoutId: NodeJS.Timeout | null = null;
    if (enableTimeout) {
      timeoutId = setTimeout(() => {
        // タイムアウト時に子プロセスを強制終了
        isTimeout = true;
        child.kill("SIGTERM");
      }, timeoutMs);
    }

    child.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    child.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    child.on("error", (error) => {
      if (timeoutId) clearTimeout(timeoutId);
      reject(
        new CommandError(
          `コマンド実行エラー: ${sanitizeOutput(error.message)}`,
          sanitizeOutput(stdout),
          sanitizeOutput(stderr)
        )
      );
    });

    child.on("close", (code) => {
      if (timeoutId) clearTimeout(timeoutId);
      const sanitizedStdout = sanitizeOutput(stdout);
      const sanitizedStderr = sanitizeOutput(stderr);

      if (code !== 0) {
        let timeOutText = "";
        if (isTimeout) {
          timeOutText = "実行時間が15秒を超えたため強制終了しました。";
        }

        reject(
          new CommandError(
            `コマンドが非正常終了しました。終了コード: ${code}`,
            `${timeOutText}${sanitizedStdout}`,
            `${timeOutText}${sanitizedStderr}`
          )
        );
      } else {
        resolve({
          stdout: sanitizedStdout,
          stderr: sanitizedStderr,
        });
      }
    });

    if (input) {
      child.stdin.write(input);
      child.stdin.end();
    }
  });
}

// -------------------------------------------------------------------------
// .NET関係
// -------------------------------------------------------------------------

// プロジェクトの初期化
async function initializeCsProject(
  projectDir: string,
  userId: string
): Promise<void> {
  try {
    await executeCommand(
      "dotnet",
      ["new", "console", "-o", `Project_${userId}`],
      path.dirname(projectDir)
    );
  } catch (error: any) {
    throw new Error(
      `.NET プロジェクトの初期化エラー:\n${error.stderr || error.message}`
    );
  }
}

// C#コードのビルド
async function buildCsProject(
  projectDir: string,
  userId: string
): Promise<void> {
  try {
    const buildResult = await executeCommand(
      "dotnet",
      ["build", "--no-restore", "--nologo", "-c", "Release"],
      projectDir
    );
    if (buildResult.stderr) {
      // 警告のみをサーバー側でログに記録
      console.warn(`Build stderr for user ${userId}: ${buildResult.stderr}`);
    }
  } catch (error: any) {
    if (error instanceof CommandError) {
      console.error(`C#ビルドエラー for user ${userId}: ${error.stderr}`);
      throw new Error(`C#ビルドエラーが発生しました。\n${error.stderr}`);
    } else {
      throw new Error(`C#ビルドエラーが発生しました。\n${error.message}`);
    }
  }
}

// C#プロジェクトの実行
async function runCsProject(
  projectDir: string,
  userId: string,
  input: string
): Promise<string> {
  const projectFilePath = path.join(projectDir, `Project_${userId}.csproj`);
  const runArgs = [
    "run",
    "--no-restore",
    "--nologo",
    "--no-build",
    "-c",
    "Release",
    "--project",
    projectFilePath,
  ];

  try {
    const runResult = await executeCommand(
      "dotnet",
      runArgs,
      projectDir,
      input,
      true
    );
    if (runResult.stderr) {
      console.error(`Run stderr for user ${userId}: ${runResult.stderr}`);
    }
    return runResult.stdout;
  } catch (error: any) {
    if (error instanceof CommandError) {
      console.error(`C#実行エラー for user ${userId}: ${error.stderr}`);
      throw new Error(`C#実行エラーが発生しました。\n${error.stderr}`);
    } else {
      throw new Error(`C#実行エラーが発生しました。\n${error.message}`);
    }
  }
}

// C#コードのコンパイルと実行
export async function runCsCode(
  code: string,
  testCases: TestCase[],
  userId: string,
  isSubmit: boolean = false
): Promise<TestCaseResult[]> {
  validateUser(userId);

  const userState = userStates[userId];
  const projectDir = path.join(tempDir, `Project_${userId}`);

  // プロジェクトディレクトリの存在確認と初期化
  if (!fs.existsSync(projectDir)) {
    await initializeCsProject(projectDir, userId);
  }

  // Program.cs の書き換え
  const programCsPath = path.join(projectDir, "Program.cs");
  fs.writeFileSync(programCsPath, code, "utf8");

  // ビルド
  await buildCsProject(projectDir, userId);

  // 実行（テストケースごとに実行）
  const testCaseResults = await Promise.all(
    testCases.map(async (tc) => {
      try {
        const output = await runCsProject(projectDir, userId, tc.input);
        const success =
          normalizeOutput(output) === normalizeOutput(tc.expectedOutput);
        return {
          input: tc.input,
          expectedOutput: tc.expectedOutput,
          actualOutput: output,
          status: success ? "success" : "failure",
          isPublic: tc.isPublic,
        } as TestCaseResult;
      } catch (error: any) {
        return {
          input: tc.input,
          expectedOutput: tc.expectedOutput,
          actualOutput: error.message,
          status: "error",
          isPublic: tc.isPublic,
        } as TestCaseResult;
      }
    })
  );

  if (isSubmit && userState.mode === "task") {
    completeUser(userId);
  }
  if (isSubmit) {
    // テストケース結果を保存
    saveTestCaseResults(userId, testCaseResults);
    return [];
  }

  return testCaseResults;
}

// -------------------------------------------------------------------------
// TypeScript関係
// -------------------------------------------------------------------------

// TypeScriptコードのコンパイルと実行
export async function runTsCode(
  code: string,
  testCases: TestCase[],
  userId: string,
  isSubmit: boolean = false
): Promise<TestCaseResult[]> {
  validateUser(userId);

  const userState = userStates[userId];
  const tsFilePath = path.join(tempDir, `temp_${userId}.ts`);
  const jsFilePath = path.join(tempDir, `temp_${userId}.js`);

  // TypeScript ファイルの保存
  fs.writeFileSync(tsFilePath, code, "utf8");

  // コンパイル
  try {
    const compileResult = await executeCommand(
      "tsc",
      [tsFilePath, "--outDir", tempDir],
      tempDir
    );

    if (compileResult.stderr) {
      console.warn(
        `TypeScript Build warnings for user ${userId}: ${compileResult.stderr}`
      );
    }
  } catch (compileError: any) {
    if (compileError instanceof CommandError) {
      console.error(
        `TypeScriptコンパイルエラー for user ${userId}: ${compileError.stderr}`
      );

      throw new Error(
        `TypeScriptコンパイルエラーが発生しました。\n${compileError.stderr}`
      );
    } else {
      throw new Error(
        `TypeScriptコンパイルエラーが発生しました。\n${compileError.message}`
      );
    }
  }

  // 実行（テストケースごとに実行）
  const testCaseResults = await Promise.all(
    testCases.map(async (tc) => {
      try {
        const runResult = await executeCommand(
          "node",
          [jsFilePath],
          tempDir,
          tc.input,
          true
        );

        const output = runResult.stdout;
        const success =
          normalizeOutput(output) === normalizeOutput(tc.expectedOutput);

        return {
          input: tc.input,
          expectedOutput: tc.expectedOutput,
          actualOutput: output,
          status: success ? "success" : "failure",
          isPublic: tc.isPublic,
        } as TestCaseResult;
      } catch (error: any) {
        return {
          input: tc.input,
          expectedOutput: tc.expectedOutput,
          actualOutput: error.message,
          status: "error",
          isPublic: tc.isPublic,
        } as TestCaseResult;
      }
    })
  );

  if (isSubmit && userState.mode === "task") {
    completeUser(userId);
  }

  if (isSubmit) {
    // テストケース結果を保存
    saveTestCaseResults(userId, testCaseResults);
    return [];
  }
  return testCaseResults;
}

// 提出結果の取得
export async function getResult(userId: string): Promise<TestCaseResult[]> {
  const testResultPath = path.join(resultDir, `${userId}_test_results.json`);
  let testCaseResults: TestCaseResult[] = [];

  if (fs.existsSync(testResultPath)) {
    const testContent = fs.readFileSync(testResultPath, "utf8");
    testCaseResults = JSON.parse(testContent);
  }
  return testCaseResults;
}