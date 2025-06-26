using CodeAnalysisServer.Api.Interfaces;
using CodeAnalysisServer.Api.Requests;
using CodeAnalysisServer.Api.Responses;
using CodeAnalysisServer.Workspaces;
using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CSharp;

namespace CodeAnalysisServer.Services
{
    public class HoverInformationProvider : IHoverInformationProvider
    {
        private readonly IAssemblyProvider _assemblyProvider;

        public HoverInformationProvider(IAssemblyProvider assemblyProvider)
        {
            _assemblyProvider = assemblyProvider;
        }

        public async Task<HoverInfoResult?> ProvideAsync(HoverInfoRequest request)
        {
            var workspace = new CompletionWorkspace(_assemblyProvider);
            var document = await workspace.CreateDocumentAsync(request.Code);
            if (document == null) return null;

            var semanticModel = await document.GetSemanticModelAsync();
            if (semanticModel == null) return null;

            var syntaxTree = await document.GetSyntaxTreeAsync();
            if (syntaxTree == null) return null;

            var root = await syntaxTree.GetRootAsync();
            var token = root.FindToken(request.Position);

            // トークンの親ノードを取得
            var node = token.Parent;
            if (node == null) return null;

            // シンボル情報の取得
            var symbolInfo = semanticModel.GetSymbolInfo(node);
            var symbol = symbolInfo.Symbol;
            if (symbol == null) return null;

            // まずビルダーで基本情報を組み立てる
            var infoText = HoverInfoBuilder.Build(symbolInfo);

            // ドキュメントコメントXMLも加えたい場合
            var xmlDocs = symbol.GetDocumentationCommentXml();
            if (!string.IsNullOrWhiteSpace(xmlDocs))
            {
                infoText += "\n" + xmlDocs.Trim();
            }

            return new HoverInfoResult
            {
                Information = infoText
            };
        }
    }
}
