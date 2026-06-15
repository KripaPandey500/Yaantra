using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WeatherAPI.DTOs;

[ApiController]
[Route("api/[controller]")]
public class OrderItemsController : ControllerBase
{
    private readonly AppDbContext _context;
    public OrderItemsController(AppDbContext context) => _context = context;

// GET all order items
    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        var items = await _context.OrderItems
            .Select(oi => new OrderItemDto
            {
                OrderId = oi.OrderId,
                ProductId = oi.ProductId,
                Quantity = oi.Quantity,
                UnitPrice = oi.UnitPrice
            })
            .ToListAsync();
        return Ok(items);
    }

    // Create new order item

    [HttpPost]
    public async Task<IActionResult> Create(CreateOrderItemDto dto)
    {
        var exists = await _context.OrderItems.AnyAsync(x => x.OrderId == dto.OrderId && x.ProductId == dto.ProductId);
        if (exists) return BadRequest("Order item already exists");

        _context.OrderItems.Add(new OrderItem
        {
            OrderId = dto.OrderId,
            ProductId = dto.ProductId,
            Quantity = dto.Quantity,
            UnitPrice = dto.UnitPrice
        });

        await _context.SaveChangesAsync();
        return Ok();
    }

    // Delete order item by orderId and productId (composite key)

    [HttpDelete]
    public async Task<IActionResult> Delete([FromQuery] int orderId, [FromQuery] int productId)
    {
        var item = await _context.OrderItems.FindAsync(orderId, productId);
        if (item == null) return NotFound();

        _context.OrderItems.Remove(item);
        await _context.SaveChangesAsync();
        return NoContent();
    }

    // Bulk insert order items

    [HttpPost("bulk")]
    public async Task<IActionResult> BulkInsert(List<CreateOrderItemDto> dtos)
    {
        var entities = dtos.Select(i => new OrderItem
        {
            OrderId = i.OrderId,
            ProductId = i.ProductId,
            Quantity = i.Quantity,
            UnitPrice = i.UnitPrice
        }).ToList();

        await _context.OrderItems.AddRangeAsync(entities);
        await _context.SaveChangesAsync();
        return Ok(new { inserted = entities.Count });
    }

    // Get order items with product and order details (for dashboard)

    [HttpGet("full-details")]
    public async Task<IActionResult> FullDetails()
    {
        var data = await _context.OrderItems
            .Select(oi => new OrderItemDetailDto
            {
                OrderId = oi.OrderId,
                OrderDate = oi.Order.OrderDate,
                ProductId = oi.ProductId,
                ProductName = oi.Product.Name,
                Quantity = oi.Quantity,
                UnitPrice = oi.UnitPrice
            })
            .ToListAsync();
        return Ok(data);
    }

    // Total count of order items (for dashboard)
    [HttpGet("count")]
    public async Task<IActionResult> Count()
        => Ok(new { totalOrderItems = await _context.OrderItems.CountAsync() });

    // Get order items by date
    [HttpGet("by-date")]
    public async Task<IActionResult> ByDate([FromQuery] DateTime date)
    {
        var start = date.Date;
        var end = start.AddDays(1);

        var data = await _context.OrderItems
            .Where(oi => oi.Order.OrderDate >= start && oi.Order.OrderDate < end)
            .Select(oi => new OrderItemDetailDto
            {
                OrderId = oi.OrderId,
                OrderDate = oi.Order.OrderDate,
                ProductId = oi.ProductId,
                ProductName = oi.Product.Name,
                Quantity = oi.Quantity,
                UnitPrice = oi.UnitPrice
            })
            .ToListAsync();
        return Ok(data);
    }
}