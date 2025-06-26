using CodeAnalysisServer.Api.Enums;

namespace CodeAnalysisServer.Api.Responses
{
    public class CodeCheckResult
    {
        public string Id { get; set; } = string.Empty;
        public string Message { get; set; } = string.Empty;
        public int Line { get; set; }
        public int Character { get; set; }
        public CodeCheckSeverity Severity { get; set; }
    }
}
