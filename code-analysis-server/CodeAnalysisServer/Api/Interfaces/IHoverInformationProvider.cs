using CodeAnalysisServer.Api.Requests;
using CodeAnalysisServer.Api.Responses;

namespace CodeAnalysisServer.Api.Interfaces
{
    public interface IHoverInformationProvider
    {
        Task<HoverInfoResult?> ProvideAsync(HoverInfoRequest request);
    }
}
