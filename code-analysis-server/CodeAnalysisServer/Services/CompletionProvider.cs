using CodeAnalysisServer.Api.Interfaces;
using CodeAnalysisServer.Api.Requests;
using CodeAnalysisServer.Api.Responses;
using CodeAnalysisServer.Workspaces;
using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.Completion;
using Microsoft.Extensions.Caching.Memory;

namespace CodeAnalysisServer.Services
{
    public class CompletionProvider : ICompletionProvider
    {
        private readonly IAssemblyProvider _assemblyProvider;
        private readonly IMemoryCache _cache;

        public CompletionProvider(IAssemblyProvider assemblyProvider, IMemoryCache cache)
        {
            _assemblyProvider = assemblyProvider;
            _cache = cache;
        }

        public async Task<CompletionResult[]> ProvideCompletionAsync(CompletionRequest request)
        {
            var cacheKey = $"{request.UserId}_{request.Code}_{request.CursorPosition}_completion";
            if (_cache.TryGetValue(cacheKey, out CompletionResult[]? cachedCompletions))
            {
                return cachedCompletions ?? [];
            }

            // Workspace & Document 作成
            var workspace = new CompletionWorkspace(_assemblyProvider);
            var document = await workspace.CreateDocumentAsync(request.Code);
            if (document == null) return [];

            var completionService = CompletionService.GetService(document);
            if (completionService == null) return [];
            var completions = await completionService.GetCompletionsAsync(document, request.CursorPosition);
            if (completions == null) return [];

            var semanticModel = await document.GetSemanticModelAsync();
            var syntaxRoot = await document.GetSyntaxRootAsync();
            if (semanticModel == null || syntaxRoot == null) return [];

            var resultList = new List<CompletionResult>();

            foreach (var item in completions.ItemsList)
            {
                // Roslyn が想定する挿入テキストと置換範囲を取得
                var change = await completionService.GetChangeAsync(document, item);
                if (change == null) continue;

                // 補完アイテムの詳細説明を取得
                var desc = await completionService.GetDescriptionAsync(document, item);
                var detail = desc?.Text ?? string.Empty;

                // 補完処理の詳細を取得
                var textChangeDto = new TextChangeDto
                {
                    Start = change.TextChange.Span.Start,
                    End = change.TextChange.Span.End,
                    NewText = change.TextChange.NewText
                };
                var textChangesDto = change.TextChanges.Select(tc => new TextChangeDto
                {
                    Start = tc.Span.Start,
                    End = tc.Span.End,
                    NewText = tc.NewText
                }).ToArray();

                resultList.Add(new CompletionResult
                {
                    Label = item.DisplayText,
                    Kind = item.Tags.FirstOrDefault() ?? "Text",
                    Detail = detail,
                    MainTextChange = textChangeDto,
                    AdditionalTextChanges = textChangesDto
                });
            }

            var results = resultList.ToArray();
            _cache.Set(cacheKey, results, TimeSpan.FromMinutes(5));

            return results;
        }
    }
}
