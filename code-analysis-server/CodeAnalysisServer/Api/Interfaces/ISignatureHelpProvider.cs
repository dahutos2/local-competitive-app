using CodeAnalysisServer.Api.Requests;
using CodeAnalysisServer.Api.Responses;

namespace CodeAnalysisServer.Api.Interfaces
{
    public interface ISignatureHelpProvider
    {
        Task<SignatureHelpResult?> ProvideAsync(SignatureHelpRequest request);
    }
}
