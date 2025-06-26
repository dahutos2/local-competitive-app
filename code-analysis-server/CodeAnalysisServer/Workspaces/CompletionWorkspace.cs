using CodeAnalysisServer.Api.Interfaces;
using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CSharp;
using Microsoft.CodeAnalysis.Emit;
using Microsoft.CodeAnalysis.Host.Mef;
using Microsoft.CodeAnalysis.Text;

namespace CodeAnalysisServer.Workspaces
{
    public class CompletionWorkspace
    {
        private readonly Project _project;
        private readonly AdhocWorkspace _workspace;

        public CompletionWorkspace(IAssemblyProvider assemblyProvider)
        {
            var host = MefHostServices.DefaultHost;
            _workspace = new AdhocWorkspace(host);

            var metadataReferences = assemblyProvider.GetAssemblies();

            var projectInfo = ProjectInfo.Create(
                ProjectId.CreateNewId(),
                VersionStamp.Create(),
                "TempProject",
                "TempProject",
                LanguageNames.CSharp
            )
            .WithMetadataReferences(metadataReferences)
            .WithCompilationOptions(
                new CSharpCompilationOptions(OutputKind.DynamicallyLinkedLibrary)
            );

            _project = _workspace.AddProject(projectInfo);
        }

        public async Task<Document?> CreateDocumentAsync(string code)
        {
            // 同期的にはやらず、await で待機
            return await Task.Run(() =>
            {
                var document = _workspace.AddDocument(_project.Id, "CSharpDocument.cs", SourceText.From(code));
                return document;
            });
        }

        public async Task<EmitResult> EmitDocumentAsync(Document document, CancellationToken cancellationToken)
        {
            var compilation = await document.Project.GetCompilationAsync(cancellationToken);
            if (compilation == null)
            {
                // Nullを返さないようにするため、例外投げる
                throw new InvalidOperationException("Compilation failed.");
            }

            using var ms = new MemoryStream();
            var emitResult = compilation.Emit(ms, cancellationToken: cancellationToken);
            return emitResult;
        }
    }
}
