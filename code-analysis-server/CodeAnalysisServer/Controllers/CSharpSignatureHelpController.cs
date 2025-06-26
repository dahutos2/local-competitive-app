using CodeAnalysisServer.Api.Interfaces;
using CodeAnalysisServer.Api.Requests;
using Microsoft.AspNetCore.Mvc;

namespace CodeAnalysisServer.Controllers
{
    [ApiController]
    [Route("api/csharp")]
    public class CSharpSignatureHelpController : ControllerBase
    {
        private readonly ISignatureHelpProvider _signatureHelpProvider;

        public CSharpSignatureHelpController(ISignatureHelpProvider signatureHelpProvider)
        {
            _signatureHelpProvider = signatureHelpProvider;
        }

        // /api/csharp/signatureHelp
        [HttpPost("signatureHelp")]
        public async Task<IActionResult> SignatureHelp([FromBody] SignatureHelpRequest request)
        {
            if (request.Code is null)
            {
                return BadRequest(new { message = "Code is null." });
            }

            var signatureHelp = await _signatureHelpProvider.ProvideAsync(request);
            if (signatureHelp == null)
            {
                return Ok(new { });
            }
            return Ok(signatureHelp);
        }
    }
}
