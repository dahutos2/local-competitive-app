using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CSharp;
using Microsoft.CodeAnalysis.CSharp.Syntax;

namespace CodeAnalysisServer.Services
{
    internal class InvocationContext
    {
        private InvocationContext(
            SemanticModel semModel,
            int position,
            SyntaxNode receiver,
            IEnumerable<TypeInfo> argTypes,
            IEnumerable<SyntaxToken> separators)
        {
            SemanticModel = semModel;
            Position = position;
            Receiver = receiver;
            ArgumentTypes = argTypes;
            Separators = separators;
        }

        public SemanticModel SemanticModel { get; }
        public int Position { get; }
        public SyntaxNode Receiver { get; }
        public IEnumerable<TypeInfo> ArgumentTypes { get; }
        public IEnumerable<SyntaxToken> Separators { get; }

        /// <summary>
        /// エントリポイント
        /// </summary>
        public static async Task<InvocationContext?> GetInvocation(Document document, int position)
        {
            var tree = await document.GetSyntaxTreeAsync();
            if (tree == null) return null;

            var root = await tree.GetRootAsync();
            var node = root.FindToken(position).Parent;
            if (node == null) return null;

            return FindInvocationSyntax(node, document, position);
        }

        /// <summary>
        /// Cognitive Complexity を下げるため、判定をメソッド分割
        /// </summary>
        private static InvocationContext? FindInvocationSyntax(SyntaxNode? node, Document doc, int position)
        {
            while (node != null)
            {
                var result = TryGetInvocationContext(node, doc, position)
                          ?? TryGetObjectCreationContext(node, doc, position)
                          ?? TryGetAttributeContext(node, doc, position);

                if (result != null)
                {
                    return result;
                }

                node = node.Parent;
            }
            return null;
        }

        private static InvocationContext? TryGetInvocationContext(SyntaxNode node, Document doc, int position)
        {
            if (node is InvocationExpressionSyntax invocation && invocation.ArgumentList.Span.Contains(position))
            {
                var sem = doc.GetSemanticModelAsync().Result;
                if (sem == null) return null;
                return CreateInvocationContext(sem, position, invocation.Expression, invocation.ArgumentList);
            }
            return null;
        }

        private static InvocationContext? TryGetObjectCreationContext(SyntaxNode node, Document doc, int position)
        {
            if (node is BaseObjectCreationExpressionSyntax creation && creation.ArgumentList?.Span.Contains(position) == true)
            {
                var sem = doc.GetSemanticModelAsync().Result;
                if (sem == null) return null;
                return CreateInvocationContext(sem, position, creation, creation.ArgumentList);
            }
            return null;
        }

        private static InvocationContext? TryGetAttributeContext(SyntaxNode node, Document doc, int position)
        {
            if (node is AttributeSyntax attr && attr.ArgumentList?.Span.Contains(position) == true)
            {
                var sem = doc.GetSemanticModelAsync().Result;
                if (sem == null) return null;
                return CreateInvocationContext(sem, position, attr, attr.ArgumentList);
            }
            return null;
        }

        private static InvocationContext? CreateInvocationContext(SemanticModel sem, int position, SyntaxNode receiver, ArgumentListSyntax? argList)
        {
            if (argList == null) return null;

            var argTypes = argList.Arguments.Select(a => sem.GetTypeInfo(a.Expression));
            var separators = argList.Arguments.GetSeparators();
            return new InvocationContext(sem, position, receiver, argTypes, separators);
        }

        private static InvocationContext? CreateInvocationContext(SemanticModel sem, int position, SyntaxNode receiver, AttributeArgumentListSyntax? attrList)
        {
            if (attrList == null) return null;

            var argTypes = attrList.Arguments.Select(a => sem.GetTypeInfo(a.Expression));
            var separators = attrList.Arguments.GetSeparators();
            return new InvocationContext(sem, position, receiver, argTypes, separators);
        }
    }
}
