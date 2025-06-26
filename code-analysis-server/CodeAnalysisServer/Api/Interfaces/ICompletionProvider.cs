using CodeAnalysisServer.Api.Requests;
using CodeAnalysisServer.Api.Responses;

namespace CodeAnalysisServer.Api.Interfaces
{
    public interface ICompletionProvider
    {
        Task<CompletionResult[]> ProvideCompletionAsync(CompletionRequest request);
    }
}
