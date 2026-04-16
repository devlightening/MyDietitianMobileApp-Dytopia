using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc;
using MyDietitianMobileApp.Api.Models;
using MyDietitianMobileApp.Api.Services;

namespace MyDietitianMobileApp.Api.Controllers;

[ApiController]
[Route("api/dev/database")]
[ApiExplorerSettings(GroupName = "dev")]
public sealed class DatabaseAuditController : ControllerBase
{
    private readonly DatabaseAuditService _auditService;
    private readonly IWebHostEnvironment _environment;

    public DatabaseAuditController(
        DatabaseAuditService auditService,
        IWebHostEnvironment environment)
    {
        _auditService = auditService;
        _environment = environment;
    }

    [HttpGet("consolidation-report")]
    [ProducesResponseType(typeof(DatabaseAuditReport), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> GetConsolidationReport(CancellationToken cancellationToken)
    {
        if (_environment.IsProduction())
        {
            return StatusCode(StatusCodes.Status403Forbidden, new
            {
                error = "Database audit endpoints are disabled in Production."
            });
        }

        var report = await _auditService.BuildReportAsync(cancellationToken);
        return Ok(report);
    }
}
