using Microsoft.CodeAnalysis;

namespace CodeAnalysisServer.Api.Interfaces
{
    public interface IAssemblyProvider
    {
        List<MetadataReference> GetAssemblies();
    }
}
