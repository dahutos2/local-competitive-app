using CodeAnalysisServer.Api.Enums;
using CodeAnalysisServer.Api.Interfaces;
using CodeAnalysisServer.Api.Requests;
using CodeAnalysisServer.Api.Responses;
using CodeAnalysisServer.Workspaces;
using Microsoft.CodeAnalysis;

namespace CodeAnalysisServer.Services
{
    public class CodeCheckProvider : ICodeCheckProvider
    {
        private readonly IAssemblyProvider _assemblyProvider;

        public CodeCheckProvider(IAssemblyProvider assemblyProvider)
        {
            _assemblyProvider = assemblyProvider;
        }

        public async Task<CodeCheckResult[]> ProvideAsync(CodeCheckRequest request)
        {
            var workspace = new CompletionWorkspace(_assemblyProvider);
            var document = await workspace.CreateDocumentAsync(request.Code);
            if (document == null) return [];

            // Roslyn での Emit（コンパイル）結果を取得
            var emitResult = await workspace.EmitDocumentAsync(document, default);

            // 取得した Diagnostic の中からエラーと警告のみフィルタ
            var diagnostics = emitResult.Diagnostics
                .Where(d => d.Severity == DiagnosticSeverity.Error ||
                            d.Severity == DiagnosticSeverity.Warning)
                .Select(d =>
                {
                    // Roslyn は 0-based 行列のため +1 して返却
                    var lineSpan = d.Location.GetLineSpan();
                    int line = lineSpan.StartLinePosition.Line + 1;
                    int character = lineSpan.StartLinePosition.Character + 1;

                    return new CodeCheckResult
                    {
                        Id = d.Id,
                        Message = d.GetMessage(),
                        Line = line,
                        Character = character,
                        Severity = (d.Severity == DiagnosticSeverity.Error)
                            ? CodeCheckSeverity.Error
                            : CodeCheckSeverity.Warning
                    };
                })
                .ToArray();

            return diagnostics;
        }
    }
}
