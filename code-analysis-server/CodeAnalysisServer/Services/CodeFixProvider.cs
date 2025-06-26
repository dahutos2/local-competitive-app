using CodeAnalysisServer.Api.Interfaces;
using CodeAnalysisServer.Api.Requests;
using CodeAnalysisServer.Api.Responses;
using CodeAnalysisServer.Workspaces;
using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CSharp;
using Microsoft.CodeAnalysis.CSharp.Syntax;

namespace CodeAnalysisServer.Services
{
    public class CodeFixProvider : ICodeFixProvider
    {
        private readonly IAssemblyProvider _assemblyProvider;

        public CodeFixProvider(IAssemblyProvider assemblyProvider)
        {
            _assemblyProvider = assemblyProvider;
        }

        /// <summary>
        /// コードを解析し、診断結果に基づいてコード修正案を生成します。
        /// </summary>
        /// <param name="request">解析対象のコードを含むリクエスト</param>
        /// <returns>生成されたコード修正案のリスト</returns>
        public async Task<CodeFixResult[]> ProvideAsync(CodeFixRequest request)
        {
            var workspace = new CompletionWorkspace(_assemblyProvider);
            var document = await workspace.CreateDocumentAsync(request.Code);
            if (document == null) return [];

            var semanticModel = await document.GetSemanticModelAsync();
            var syntaxRoot = await document.GetSyntaxRootAsync();
            var compilation = await document.Project.GetCompilationAsync();

            if (semanticModel == null || syntaxRoot == null || compilation == null) return [];

            // エラーまたは警告で、リクエストと同じ診断情報を取得
            var diagnostics = semanticModel.GetDiagnostics()
                .Where(d =>
                    (d.Severity == DiagnosticSeverity.Error ||
                    d.Severity == DiagnosticSeverity.Warning) &&
                    d.Location.SourceSpan.Contains(request.Position)
                );

            // 診断ごとにコード修正案を生成
            return diagnostics
                .SelectMany(diagnostic => HandleDiagnostic(diagnostic, compilation, semanticModel, syntaxRoot))
                .Where(result => result != null).OfType<CodeFixResult>()
                .ToArray();
        }

        /// <summary>
        /// 特定の診断情報に基づいて対応する修正案を生成します。
        /// </summary>
        private static IEnumerable<CodeFixResult?> HandleDiagnostic(
            Diagnostic diagnostic, Compilation compilation, SemanticModel semanticModel, SyntaxNode syntaxRoot)
        {
            var diagnosticSpan = diagnostic.Location.SourceSpan;
            if (syntaxRoot.FindNode(diagnosticSpan) is not CSharpSyntaxNode node) yield break;

            switch (diagnostic.Id)
            {
                case "CS0246": // 型または名前空間が見つからない場合
                case "CS0103": // 未定義の識別子の場合
                    foreach (var fix in HandleMissingTypeOrNamespace(diagnostic, compilation, syntaxRoot, node))
                    {
                        yield return fix;
                    }
                    break;

                case "CS1061": // メソッドやプロパティが見つからない場合
                    foreach (var fix in HandleMissingMember(diagnostic, compilation, semanticModel, syntaxRoot, node))
                    {
                        yield return fix;
                    }
                    break;

                default:
                    // その他のエラーコードは未対応
                    yield break;
            }
        }

        /// <summary>
        /// 型や名前空間が不足している診断に対応した修正案を生成します。
        /// </summary>
        private static IEnumerable<CodeFixResult?> HandleMissingTypeOrNamespace(
            Diagnostic diagnostic, Compilation compilation, SyntaxNode syntaxRoot, CSharpSyntaxNode node)
        {
            // 不足している型や名前空間の名前を取得
            var missingName = node switch
            {
                GenericNameSyntax genericNode => genericNode.Identifier.Text,
                IdentifierNameSyntax identifierNode => identifierNode.Identifier.Text,
                _ => null
            };

            if (missingName == null) yield break;

            // 該当する名前空間を探索し、修正案を生成
            foreach (var namespaceToAdd in FindNamespacesForMissingTypeOrSymbol(compilation, missingName))
            {
                yield return CreateUsingDirectiveFix(diagnostic, syntaxRoot, namespaceToAdd);
            }
        }

        /// <summary>
        /// メンバーが不足している診断に対応した修正案を生成します。
        /// </summary>
        private static IEnumerable<CodeFixResult?> HandleMissingMember(
            Diagnostic diagnostic, Compilation compilation, SemanticModel semanticModel, SyntaxNode syntaxRoot, CSharpSyntaxNode node)
        {
            // 親ノードがMemberAccessExpressionSyntaxか確認
            if (node.Parent is not MemberAccessExpressionSyntax parent) yield break;

            // 不足しているメンバー名を取得
            var missingMemberName = parent.Name.Identifier.Text;
            if (parent.Expression is not IdentifierNameSyntax containingType) yield break;

            var typeInfo = semanticModel.GetTypeInfo(containingType);

            // 該当する名前空間を探索し、修正案を生成
            foreach (var namespaceToAdd in FindNamespacesForMissingTypeOrSymbol(compilation, missingMemberName, typeInfo.Type))
            {
                yield return CreateUsingDirectiveFix(diagnostic, syntaxRoot, namespaceToAdd);
            }
        }

        /// <summary>
        /// 不足している型やシンボルに対応する名前空間を検索します。
        /// </summary>
        private static IEnumerable<string> FindNamespacesForMissingTypeOrSymbol(
            Compilation compilation, string name, ITypeSymbol? memberType = null)
        {
            foreach (var reference in compilation.References)
            {
                if (compilation.GetAssemblyOrModuleSymbol(reference) is not IAssemblySymbol assemblySymbol) continue;

                foreach (var namespaceSymbol in GetAllNamespaces(assemblySymbol.GlobalNamespace))
                {
                    foreach (var typeSymbol in namespaceSymbol.GetTypeMembers())
                    {
                        if (typeSymbol.Name == name || (memberType != null && IsSameOrDerived(typeSymbol, memberType)))
                        {
                            yield return typeSymbol.ContainingNamespace.ToDisplayString();
                        }
                    }
                }
            }
        }

        /// <summary>
        /// 指定された型がターゲット型と同一または派生しているかを判定します。
        /// </summary>
        private static bool IsSameOrDerived(ITypeSymbol type, ITypeSymbol target)
        {
            if (SymbolEqualityComparer.Default.Equals(type, target)) return true;

            // 基底クラスをチェック
            var baseType = target.BaseType;
            while (baseType != null)
            {
                if (SymbolEqualityComparer.Default.Equals(baseType, type)) return true;
                baseType = baseType.BaseType;
            }

            // 実装されたインターフェイスをチェック
            return target.AllInterfaces.Any(i =>
                type.GetMembers().OfType<IMethodSymbol>()
                    .Where(m => m.IsExtensionMethod)
                    .Any(m => SymbolEqualityComparer.Default.Equals(m.Parameters.FirstOrDefault()?.Type, i)));
        }

        /// <summary>
        /// 指定された名前空間をすべて再帰的に取得します。
        /// </summary>
        private static IEnumerable<INamespaceSymbol> GetAllNamespaces(INamespaceSymbol root)
        {
            foreach (var ns in root.GetNamespaceMembers())
            {
                yield return ns;
                foreach (var child in GetAllNamespaces(ns))
                {
                    yield return child;
                }
            }
        }

        /// <summary>
        /// usingディレクティブを追加する修正案を生成します。
        /// </summary>
        private static CodeFixResult? CreateUsingDirectiveFix(Diagnostic diagnostic, SyntaxNode syntaxRoot, string namespaceToAdd)
        {
            var compilationUnit = syntaxRoot as CompilationUnitSyntax;
            if (compilationUnit == null || compilationUnit.Usings.Any(u => u.Name?.ToString() == namespaceToAdd)) return null;

            var lastUsing = compilationUnit.Usings.LastOrDefault();
            var insertionLine = lastUsing != null
                ? lastUsing.GetLocation().GetLineSpan().EndLinePosition.Line + 1
                : 0;

            return new CodeFixResult
            {
                Diagnostic = diagnostic.GetMessage(),
                Title = $"using {namespaceToAdd};",
                Text = $"using {namespaceToAdd};\n",
                Range = new Api.Responses.Range
                {
                    StartLineNumber = insertionLine + 1,
                    StartColumn = 1,
                    EndLineNumber = insertionLine + 1,
                    EndColumn = 1
                }
            };
        }
    }
}
