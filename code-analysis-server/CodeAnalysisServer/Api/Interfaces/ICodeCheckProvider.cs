using CodeAnalysisServer.Api.Requests;
using CodeAnalysisServer.Api.Responses;

namespace CodeAnalysisServer.Api.Interfaces
{
    public interface ICodeCheckProvider
    {
        Task<CodeCheckResult[]> ProvideAsync(CodeCheckRequest request);
    }
}
