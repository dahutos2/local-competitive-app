namespace CodeAnalysisServer.Api.Responses
{
    public class SignatureHelpResult
    {
        public Signature[] Signatures { get; set; } = [];
        public int ActiveSignature { get; set; }
        public int ActiveParameter { get; set; }
    }

    public class Signature
    {
        public string Label { get; set; } = string.Empty;
        public string Documentation { get; set; } = string.Empty;
        public Parameter[] Parameters { get; set; } = [];
    }

    public class Parameter
    {
        public string Label { get; set; } = string.Empty;
        public string Documentation { get; set; } = string.Empty;
    }
}
