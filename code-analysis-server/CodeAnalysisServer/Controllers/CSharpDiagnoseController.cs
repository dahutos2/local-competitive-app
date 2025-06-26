using CodeAnalysisServer.Api.Enums;
using CodeAnalysisServer.Api.Interfaces;
using CodeAnalysisServer.Api.Requests;
using Microsoft.AspNetCore.Mvc;

namespace CodeAnalysisServer.Controllers
{
    [ApiController]
    [Route("api/csharp")]
    public class CSharpDiagnoseController : ControllerBase
    {
        private readonly ICodeCheckProvider _codeCheckProvider;

        public CSharpDiagnoseController(ICodeCheckProvider codeCheckProvider)
        {
            _codeCheckProvider = codeCheckProvider;
        }

        // /api/csharp/diagnose
        [HttpPost("diagnose")]
        public async Task<IActionResult> Diagnose([FromBody] CodeCheckRequest request)
        {
            if (request.Code is null)
            {
                return BadRequest(new { message = "Code is null." });
            }

            var diagnostics = await _codeCheckProvider.ProvideAsync(request);

            var errors = diagnostics
                .Where(d => d.Severity == CodeCheckSeverity.Error)
                .Select(d => new
                {
                    id = d.Id,
                    message = d.Message,
                    line = d.Line,
                    character = d.Character
                })
                .ToArray();

            var warnings = diagnostics
                .Where(d => d.Severity == CodeCheckSeverity.Warning)
                .Select(d => new
                {
                    id = d.Id,
                    message = d.Message,
                    line = d.Line,
                    character = d.Character
                })
                .ToArray();

            return Ok(new { errors, warnings });
        }
    }
}
