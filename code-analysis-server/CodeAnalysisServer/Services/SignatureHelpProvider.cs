using CodeAnalysisServer.Api.Interfaces;
using CodeAnalysisServer.Api.Requests;
using CodeAnalysisServer.Api.Responses;
using CodeAnalysisServer.Workspaces;
using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CSharp.Syntax;

namespace CodeAnalysisServer.Services
{
    public class SignatureHelpProvider : ISignatureHelpProvider
    {
        private readonly IAssemblyProvider _assemblyProvider;

        public SignatureHelpProvider(IAssemblyProvider assemblyProvider)
        {
            _assemblyProvider = assemblyProvider;
        }

        public async Task<SignatureHelpResult?> ProvideAsync(SignatureHelpRequest request)
        {
            var workspace = new CompletionWorkspace(_assemblyProvider);
            var document = await workspace.CreateDocumentAsync(request.Code);
            if (document == null) return null;

            var invocation = await InvocationContext.GetInvocation(document, request.Position);
            if (invocation == null) return null;

            // ActiveParameter の計算 (カンマごとに引数Indexを増加)
            int activeParameter = CalculateActiveParameter(invocation);

            // メソッド群を取得してフィルタリング
            var methodGroup = GetMethodGroup(invocation);
            if (!methodGroup.Any()) return null;

            var signaturesSet = new HashSet<Signature>();
            var bestScore = int.MinValue;
            Signature? bestSignature = null;

            foreach (var methodOverload in methodGroup)
            {
                var sig = BuildSignature(methodOverload);
                signaturesSet.Add(sig);

                var score = InvocationScore(methodOverload, invocation.ArgumentTypes);
                if (score > bestScore)
                {
                    bestScore = score;
                    bestSignature = sig;
                }
            }

            var signaturesArray = signaturesSet.ToArray();
            int activeSignatureIndex = bestSignature == null ? 0 :
                Array.IndexOf(signaturesArray, bestSignature);

            return new SignatureHelpResult
            {
                Signatures = signaturesArray,
                ActiveParameter = activeParameter,
                ActiveSignature = (activeSignatureIndex >= 0) ? activeSignatureIndex : 0
            };
        }

        // 引数Indexを計算 (Comma区切りごとに+1)
        private static int CalculateActiveParameter(InvocationContext invocation)
        {
            int activeParam = 0;
            foreach (var comma in invocation.Separators)
            {
                if (comma.SpanStart > invocation.Position) break;
                activeParam++;
            }
            return activeParam;
        }

        private static IEnumerable<IMethodSymbol> GetMethodGroup(InvocationContext invocation)
        {
            var semanticModel = invocation.SemanticModel;
            var methodGroup = semanticModel.GetMemberGroup(invocation.Receiver).OfType<IMethodSymbol>();

            if (invocation.Receiver is MemberAccessExpressionSyntax memberAccess)
            {
                var throughExpression = memberAccess.Expression;
                var typeInfo = semanticModel.GetTypeInfo(throughExpression);
                var throughSymbol = semanticModel.GetSpeculativeSymbolInfo(invocation.Position, throughExpression, SpeculativeBindingOption.BindAsExpression).Symbol;
                var speculativeType = semanticModel.GetSpeculativeTypeInfo(invocation.Position, throughExpression, SpeculativeBindingOption.BindAsTypeOrNamespace).Type;

                // static or instance 判定
                bool includeInstance = (throughSymbol != null && !(throughSymbol is ITypeSymbol))
                                       || throughExpression is LiteralExpressionSyntax
                                       || throughExpression is TypeOfExpressionSyntax;
                bool includeStatic = (throughSymbol is INamedTypeSymbol) || speculativeType != null;

                if (speculativeType == null)
                {
                    // static でない場合
                    // (typeInfo.Type が null の場合は instance にならないため)
                    includeInstance = typeInfo.Type != null;
                }

                methodGroup = methodGroup.Where(m =>
                    (m.IsStatic && includeStatic) ||
                    (!m.IsStatic && includeInstance)
                );
            }

            return methodGroup;
        }

        // IMethodSymbol からシグネチャ情報を組み立て
        private static Signature BuildSignature(IMethodSymbol symbol)
        {
            var xmlDocs = symbol.GetDocumentationCommentXml() ?? "";
            var parameters = symbol.Parameters.Select(p => new Parameter
            {
                Label = p.ToDisplayString(SymbolDisplayFormat.MinimallyQualifiedFormat),
                Documentation = p.GetDocumentationCommentXml() ?? ""
            }).ToArray();

            return new Signature
            {
                Label = symbol.ToDisplayString(SymbolDisplayFormat.MinimallyQualifiedFormat),
                Documentation = xmlDocs,
                Parameters = parameters
            };
        }

        // 引数の型とパラメータの型を比較してスコアリング
        private static int InvocationScore(IMethodSymbol symbol, IEnumerable<TypeInfo> argumentTypes)
        {
            var parameters = symbol.Parameters;
            var argCount = argumentTypes.Count();
            if (parameters.Length < argCount)
                return int.MinValue; // 引数超過

            int score = 0;
            var paramEnum = parameters.GetEnumerator();
            var argEnum = argumentTypes.GetEnumerator();

            while (argEnum.MoveNext() && paramEnum.MoveNext())
            {
                var argType = argEnum.Current.ConvertedType;
                var paramType = paramEnum.Current.Type;

                if (argType == null)
                {
                    score += 1; // 型解決できなかったら少し加点
                }
                else if (SymbolEqualityComparer.Default.Equals(argType, paramType))
                {
                    score += 2; // 型が完全一致
                }
            }

            return score;
        }
    }
}
