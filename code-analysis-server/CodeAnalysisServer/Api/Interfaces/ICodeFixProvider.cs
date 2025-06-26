using CodeAnalysisServer.Api.Requests;
using CodeAnalysisServer.Api.Responses;

namespace CodeAnalysisServer.Api.Interfaces
{
    public interface ICodeFixProvider
    {
        Task<CodeFixResult[]> ProvideAsync(CodeFixRequest request);
    }
}
