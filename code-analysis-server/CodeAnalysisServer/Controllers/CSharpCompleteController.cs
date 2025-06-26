using CodeAnalysisServer.Api.Interfaces;
using CodeAnalysisServer.Api.Requests;
using CodeAnalysisServer.Api.Responses;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Caching.Memory;

namespace CodeAnalysisServer.Controllers
{
    [ApiController]
    [Route("api/csharp")]
    public class CSharpCompleteController : ControllerBase
    {
        private readonly IMemoryCache _cache;
        private readonly ICompletionProvider _completionProvider;

        public CSharpCompleteController(IMemoryCache cache, ICompletionProvider completionProvider)
        {
            _cache = cache;
            _completionProvider = completionProvider;
        }

        // /api/csharp/complete
        [HttpPost("complete")]
        public async Task<IActionResult> Complete([FromBody] CompletionRequest request)
        {
            if (request.Code is null) // nullable 対策
            {
                return BadRequest(new { message = "Code is null." });
            }

            if (request.CursorPosition < 0 || request.CursorPosition > request.Code.Length)
            {
                return BadRequest(new { message = "カーソル位置がコードの範囲外です。" });
            }

            var cacheKey = $"{request.UserId}_{request.Code}_{request.CursorPosition}_complete";
            if (_cache.TryGetValue(cacheKey, out CompletionResult[]? cachedCompletions))
            {
                return Ok(new { suggestions = cachedCompletions });
            }

            var completions = await _completionProvider.ProvideCompletionAsync(request);
            if (completions.Length == 0)
            {
                return Ok(new { suggestions = Array.Empty<CompletionResult>() });
            }

            _cache.Set(cacheKey, completions, TimeSpan.FromMinutes(5));
            return Ok(new { suggestions = completions });
        }
    }
}
