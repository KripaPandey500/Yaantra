using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

[ApiController]
[Route("api/notifications")]
public class NotificationsController : ControllerBase
{
    private readonly AppDbContext _context;
    private const string LowStockPrefix = "Low stock alert:";
    private const int LowStockThreshold = 10;

    public NotificationsController(AppDbContext context)
    {
        _context = context;
    }

    private static bool IsAdminRole(string? role)
    {
        return !string.IsNullOrWhiteSpace(role) && role.Trim().Equals("Admin", StringComparison.OrdinalIgnoreCase);
    }

    private static string BuildLowStockMessage(Product product)
    {
        return $"Low stock alert: {product.Name} has only {product.StockQty} units left.";
    }

    private async Task EnsureLowStockNotificationsAsync()
    {
        var lowStockProducts = await _context.Products
            .Where(p => p.StockQty < LowStockThreshold)
            .ToListAsync();

        if (!lowStockProducts.Any())
        {
            return;
        }

        var admins = await _context.Users
            .Where(u => u.Role != null)
            .ToListAsync();

        var adminUsers = admins.Where(u => IsAdminRole(u.Role)).ToList();

        foreach (var product in lowStockProducts)
        {
            var message = BuildLowStockMessage(product);

            if (!adminUsers.Any())
            {
                var existsGlobal = await _context.Notifications.AnyAsync(n =>
                    n.UserId == null &&
                    !n.IsRead &&
                    n.Message == message);

                if (!existsGlobal)
                {
                    _context.Notifications.Add(new Notification
                    {
                        Message = message,
                        CreatedAt = DateTime.UtcNow,
                        IsRead = false,
                        UserId = null
                    });
                }

                continue;
            }

            foreach (var admin in adminUsers)
            {
                var exists = await _context.Notifications.AnyAsync(n =>
                    n.UserId == admin.Id &&
                    !n.IsRead &&
                    n.Message == message);

                if (exists)
                {
                    continue;
                }

                _context.Notifications.Add(new Notification
                {
                    Message = message,
                    CreatedAt = DateTime.UtcNow,
                    IsRead = false,
                    UserId = admin.Id
                });
            }
        }

        await _context.SaveChangesAsync();
    }

    [HttpGet("admin/low-stock")]
    public async Task<IActionResult> GetAdminLowStockNotifications([FromQuery] bool includeRead = false)
    {
        await EnsureLowStockNotificationsAsync();

        var query = _context.Notifications
            .Where(n => n.Message.StartsWith(LowStockPrefix))
            .Where(n => n.UserId == null || (n.User != null && n.User.Role != null && n.User.Role.ToLower() == "admin"));

        if (!includeRead)
        {
            query = query.Where(n => !n.IsRead);
        }

        // Group by message to avoid duplicates when multiple admins exist.
        var notifications = await query
            .OrderByDescending(n => n.CreatedAt)
            .ToListAsync();

        // Get all products to check if they're still low stock
        var allProducts = await _context.Products.ToListAsync();
        
        var latestByMessage = notifications
            .GroupBy(n => n.Message)
            .Select(g => g.OrderByDescending(n => n.CreatedAt).First())
            .Where(n => {
                // Extract product name from message: "Low stock alert: {ProductName} has only {Qty} units left."
                var match = System.Text.RegularExpressions.Regex.Match(n.Message, @"Low stock alert:\s*(.+?)\s+has only");
                if (match.Success)
                {
                    var productName = match.Groups[1].Value;
                    var product = allProducts.FirstOrDefault(p => p.Name == productName);
                    // Only include notification if product still exists and is low stock
                    return product != null && product.StockQty < LowStockThreshold;
                }
                return true; // Keep notification if we can't parse it
            })
            .OrderByDescending(n => n.CreatedAt)
            .Take(20)
            .Select(n => new
            {
                id = n.Id,
                message = n.Message,
                createdAt = n.CreatedAt,
                isRead = n.IsRead
            })
            .ToList();

        return Ok(latestByMessage);
    }

    [HttpPost("admin/low-stock/{id:int}/mark-read")]
    public async Task<IActionResult> MarkAdminLowStockNotificationRead(int id)
    {
        var notification = await _context.Notifications.FirstOrDefaultAsync(n => n.Id == id);
        if (notification == null)
        {
            return NotFound();
        }

        if (!notification.Message.StartsWith(LowStockPrefix))
        {
            return BadRequest("Only low stock notifications can be marked here.");
        }

        var related = await _context.Notifications
            .Where(n => n.Message == notification.Message)
            .Where(n => n.UserId == null || (n.User != null && n.User.Role != null && n.User.Role.Equals("Admin", StringComparison.OrdinalIgnoreCase)))
            .Where(n => !n.IsRead)
            .ToListAsync();

        foreach (var item in related)
        {
            item.IsRead = true;
        }

        await _context.SaveChangesAsync();
        return NoContent();
    }

    [HttpPost("admin/low-stock/mark-all-read")]
    public async Task<IActionResult> MarkAllAdminLowStockNotificationsRead()
    {
        var unread = await _context.Notifications
            .Where(n => !n.IsRead)
            .Where(n => n.Message.StartsWith(LowStockPrefix))
            .Where(n => n.UserId == null || (n.User != null && n.User.Role != null && n.User.Role.Equals("Admin", StringComparison.OrdinalIgnoreCase)))
            .ToListAsync();

        if (!unread.Any())
        {
            return NoContent();
        }

        foreach (var notification in unread)
        {
            notification.IsRead = true;
        }

        await _context.SaveChangesAsync();
        return NoContent();
    }
}