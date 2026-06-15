using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

[ApiController]
[Route("api/[controller]")]
public class DashboardController : ControllerBase
{
    private readonly AppDbContext _context;
    public DashboardController(AppDbContext context) => _context = context;

    [HttpGet("summary")]
    public async Task<IActionResult> Summary()
    {

        var result = new
        {
            totalCategories = await _context.Categories.CountAsync(),
            totalVendors = await _context.Set<User>().CountAsync(u => u.Role.ToLower() == "vendor" && u.IdentityUserId != null),
            totalProducts = await _context.Products.CountAsync(),
            totalUsers = await _context.Set<User>().CountAsync(u => u.IdentityUserId != null),
            totalOrders = await _context.Orders.CountAsync(),
            totalOrderItems = await _context.OrderItems.CountAsync()
        };

        return Ok(result);
    }
}