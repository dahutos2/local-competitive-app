using CodeAnalysisServer.Api.Interfaces;
using CodeAnalysisServer.Api.Requests;
using Microsoft.AspNetCore.Mvc;

namespace CodeAnalysisServer.Controllers
{
    [ApiController]
    [Route("api/csharp")]
    public class CSharpHoverController : ControllerBase
    {
        private readonly IHoverInformationProvider _hoverInfoProvider;

        public CSharpHoverController(IHoverInformationProvider hoverInfoProvider)
        {
            _hoverInfoProvider = hoverInfoProvider;
        }

        // /api/csharp/hover
        [HttpPost("hover")]
        public async Task<IActionResult> Hover([FromBody] HoverInfoRequest request)
        {
            if (request.Code is null)
            {
                return BadRequest(new { message = "Code is null." });
            }

            var hoverInfo = await _hoverInfoProvider.ProvideAsync(request);
            if (hoverInfo == null)
            {
                return Ok(new { information = string.Empty });
            }
            return Ok(hoverInfo);
        }
    }
}
