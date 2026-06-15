using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

[ApiController]
[Route("api/[controller]")]
public class ReportsController : ControllerBase
{
    private readonly AppDbContext _context;

    public ReportsController(AppDbContext context)
    {
        _context = context;
    }

    // GET
    [Authorize]
    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        var reports = await _context.Reports
            .OrderByDescending(r => r.CreatedAt)
            .Select(r => new {
                r.Id,
                r.Title,
                r.Description,
                r.CreatedAt,
                r.UserId
            })
            .ToListAsync();

        return Ok(reports);
    }

    // POST
    [Authorize]
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateReportDto dto)
    {
        // Get the logged-in user's profile Id
        var identityUserId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        var userProfile = await _context.Users
            .FirstOrDefaultAsync(u => u.IdentityUserId == identityUserId);

        if (userProfile == null) return Unauthorized();

        var report = new Report
        {
            Title       = dto.Title,
            Description = dto.Description,
            CreatedAt   = DateTime.UtcNow,
            UserId      = userProfile.Id
        };

        _context.Reports.Add(report);
        await _context.SaveChangesAsync();

        return Ok(new { message = "Report saved.", reportId = report.Id });
    }

    // DELETE
    [Authorize]
    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(int id)
    {
        var report = await _context.Reports.FindAsync(id);
        if (report == null) return NotFound();

        _context.Reports.Remove(report);
        await _context.SaveChangesAsync();
        return Ok(new { message = "Report deleted." });
    }
}

// DTO
public class CreateReportDto
{
    public string Title       { get; set; } = string.Empty;
    public string? Description { get; set; }
}