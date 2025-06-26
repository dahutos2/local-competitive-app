using Microsoft.CodeAnalysis;
using System.Text;

namespace CodeAnalysisServer.Services
{
  internal static class HoverInfoBuilder
  {
    public static string Build(SymbolInfo symbolInfo)
    {
      var symbol = symbolInfo.Symbol;
      if (symbol == null) return string.Empty;

      return symbol switch
      {
        IMethodSymbol method => BuildMethodInfo(method),
        ILocalSymbol local => BuildLocalInfo(local),
        IFieldSymbol field => BuildFieldInfo(field),
        IPropertySymbol prop => BuildPropertyInfo(prop),
        _ => symbol.ToDisplayString() // それ以外は単純表示
      };
    }

    private static string BuildMethodInfo(IMethodSymbol methodSymbol)
    {
      var sb = new StringBuilder()
          .Append("(method) ")
          .Append(methodSymbol.DeclaredAccessibility.ToString().ToLower())
          .Append(' ');

      if (methodSymbol.IsStatic) sb.Append("static ");

      sb.Append(methodSymbol.Name).Append('(');
      for (int i = 0; i < methodSymbol.Parameters.Length; i++)
      {
        var param = methodSymbol.Parameters[i];
        sb.Append(param.Type.ToDisplayString()).Append(' ').Append(param.Name);
        if (i < methodSymbol.Parameters.Length - 1)
          sb.Append(", ");
      }
      sb.Append(") : ")
        .Append(methodSymbol.ReturnType.ToDisplayString());

      return sb.ToString();
    }

    private static string BuildLocalInfo(ILocalSymbol localSymbol)
    {
      var sb = new StringBuilder();
      sb.Append("(local) ")
        .Append(localSymbol.Name)
        .Append(" : ");

      if (localSymbol.IsConst)
      {
        sb.Append("const ");
      }
      sb.Append(localSymbol.Type.ToDisplayString());

      return sb.ToString();
    }

    private static string BuildFieldInfo(IFieldSymbol fieldSymbol)
    {
      var sb = new StringBuilder();
      sb.Append("(field) ")
        .Append(fieldSymbol.DeclaredAccessibility.ToString().ToLower())
        .Append(' ');

      if (fieldSymbol.IsStatic) sb.Append("static ");
      if (fieldSymbol.IsReadOnly) sb.Append("readonly ");
      if (fieldSymbol.IsConst) sb.Append("const ");

      sb.Append(fieldSymbol.Type.ToDisplayString())
        .Append(' ')
        .Append(fieldSymbol.Name);

      return sb.ToString();
    }

    private static string BuildPropertyInfo(IPropertySymbol propSymbol)
    {
      var sb = new StringBuilder();
      sb.Append("(property) ")
        .Append(propSymbol.DeclaredAccessibility.ToString().ToLower())
        .Append(' ');

      if (propSymbol.IsStatic) sb.Append("static ");

      sb.Append(propSymbol.Type.ToDisplayString())
        .Append(' ')
        .Append(propSymbol.Name);

      return sb.ToString();
    }
  }
}
