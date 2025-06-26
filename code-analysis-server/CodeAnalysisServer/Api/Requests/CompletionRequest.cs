namespace CodeAnalysisServer.Api.Requests
{
    public class CompletionRequest
    {
        public string UserId { get; set; } = string.Empty;
        public string Code { get; set; } = string.Empty;
        public int CursorPosition { get; set; }
    }
}
