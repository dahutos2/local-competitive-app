using CodeAnalysisServer.Api.Interfaces;
using CodeAnalysisServer.Api.Requests;
using Microsoft.AspNetCore.Mvc;

namespace CodeAnalysisServer.Controllers
{
    [ApiController]
    [Route("api/csharp")]
    public class CSharpCodeFixController : ControllerBase
    {
        private readonly ICodeFixProvider _codeFixProvider;

        public CSharpCodeFixController(ICodeFixProvider codeFixProvider)
        {
            _codeFixProvider = codeFixProvider;
        }

        // POST: /api/csharp/codefix
        [HttpPost("codefix")]
        public async Task<IActionResult> CodeFix([FromBody] CodeFixRequest request)
        {
            if (string.IsNullOrEmpty(request.Code))
            {
                return BadRequest(new { message = "Code is null or empty." });
            }

            if (request.Position < 0 || request.Position > request.Code.Length)
            {
                return BadRequest(new { message = "Position is out of range." });
            }

            try
            {
                var fixes = await _codeFixProvider.ProvideAsync(request);
                if (fixes.Length == 0)
                {
                    return Ok(new { fixes = Array.Empty<object>() });
                }
                return Ok(new { fixes });
            }
            catch (Exception ex)
            {
                // ログにエラーを記録
                Console.WriteLine($"Error in CodeFix: {ex.Message}");
                return StatusCode(500, new { message = "Internal server error." });
            }
        }
    }
}
