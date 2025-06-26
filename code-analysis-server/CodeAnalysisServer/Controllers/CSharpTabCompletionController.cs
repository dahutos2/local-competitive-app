using CodeAnalysisServer.Api.Interfaces;
using CodeAnalysisServer.Api.Requests;
using Microsoft.AspNetCore.Mvc;

namespace CodeAnalysisServer.Controllers
{
    [ApiController]
    [Route("api/csharp")]
    public class CSharpTabCompletionController : ControllerBase
    {
        private readonly ITabCompletionProvider _tabCompletionProvider;

        public CSharpTabCompletionController(ITabCompletionProvider tabCompletionProvider)
        {
            _tabCompletionProvider = tabCompletionProvider;
        }

        // /api/csharp/tabCompletion
        [HttpPost("tabCompletion")]
        public async Task<IActionResult> TabCompletion([FromBody] TabCompletionRequest request)
        {
            if (request.Code is null)
            {
                return BadRequest(new { message = "Code is null." });
            }

            var tabCompletions = await _tabCompletionProvider.ProvideAsync(request);
            if (tabCompletions == null || tabCompletions.Length == 0)
            {
                return Ok(new { suggestions = Array.Empty<object>() });
            }
            return Ok(new { suggestions = tabCompletions });
        }
    }
}
