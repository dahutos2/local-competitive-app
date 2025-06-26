using CodeAnalysisServer.Api.Interfaces;
using CodeAnalysisServer.Api.Requests;
using CodeAnalysisServer.Api.Responses;
using CodeAnalysisServer.Workspaces;
using Microsoft.CodeAnalysis.Completion;

namespace CodeAnalysisServer.Services
{
    public class TabCompletionProvider : ITabCompletionProvider
    {
        private readonly IAssemblyProvider _assemblyProvider;

        public TabCompletionProvider(IAssemblyProvider assemblyProvider)
        {
            _assemblyProvider = assemblyProvider;
        }

        public async Task<TabCompletionResult[]> ProvideAsync(TabCompletionRequest request)
        {
            var workspace = new CompletionWorkspace(_assemblyProvider);
            var document = await workspace.CreateDocumentAsync(request.Code);
            if (document == null) return [];

            var completionService = CompletionService.GetService(document);
            if (completionService == null) return [];

            var completions = await completionService.GetCompletionsAsync(document, request.Position);
            var items = completions?.ItemsList;
            if (items == null || items.Count == 0) return [];

            // description を含める
            var resultsList = new List<TabCompletionResult>(items.Count);
            foreach (var item in items)
            {
                var desc = await completionService.GetDescriptionAsync(document, item);
                resultsList.Add(new TabCompletionResult
                {
                    Suggestion = item.DisplayText,
                    Description = desc?.Text ?? string.Empty
                });
            }

            return [.. resultsList];
        }
    }
}
