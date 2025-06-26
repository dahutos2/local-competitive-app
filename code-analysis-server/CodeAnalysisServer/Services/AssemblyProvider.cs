using CodeAnalysisServer.Api.Interfaces;
using Microsoft.CodeAnalysis;

namespace CodeAnalysisServer.Services
{
    public class AssemblyProvider : IAssemblyProvider
    {
        public List<MetadataReference> GetAssemblies()
        {
            return AppDomain.CurrentDomain.GetAssemblies()
                .Where(a => !a.IsDynamic
                && !string.IsNullOrEmpty(a.Location)
                && (a.GetName().Name?.StartsWith("System", StringComparison.OrdinalIgnoreCase) ?? false))
                .Select(a => (MetadataReference)MetadataReference.CreateFromFile(a.Location))
                .ToList();
        }
    }
}
