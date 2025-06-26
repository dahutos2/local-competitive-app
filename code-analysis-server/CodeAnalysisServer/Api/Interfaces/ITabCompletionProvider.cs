using CodeAnalysisServer.Api.Requests;
using CodeAnalysisServer.Api.Responses;

namespace CodeAnalysisServer.Api.Interfaces
{
    public interface ITabCompletionProvider
    {
        Task<TabCompletionResult[]> ProvideAsync(TabCompletionRequest request);
    }
}
