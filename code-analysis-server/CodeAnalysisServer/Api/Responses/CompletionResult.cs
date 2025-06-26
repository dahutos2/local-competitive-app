namespace CodeAnalysisServer.Api.Responses
{
    public class CompletionResult
    {
        public string Label { get; set; } = string.Empty;
        public string Kind { get; set; } = string.Empty;
        public string Detail { get; set; } = string.Empty;
        public TextChangeDto? MainTextChange { get; set; }
        public TextChangeDto[] AdditionalTextChanges { get; set; } = [];
    }

    public class TextChangeDto
    {
        public int Start { get; set; }
        public int End { get; set; }
        public string? NewText { get; set; }
    }
}
