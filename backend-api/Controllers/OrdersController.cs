    
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using WeatherAPI.DTOs;
using WeatherAPI.Services;

[ApiController]
[Route("api/[controller]")]
public class OrdersController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly IEmailSender _emailSender;
    private static readonly TimeSpan OverdueReminderThreshold = TimeSpan.FromDays(30);

    public OrdersController(AppDbContext context, IEmailSender emailSender)
    {
        _context = context;
        _emailSender = emailSender;
    }
    
    [Authorize]

    // GET: /api/orders - Get all orders (admin) or user's own orders (user)
    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        var data = await _context.Orders
            .Select(o => new OrderDto
            {
                Id = o.Id,
                OrderNumber = o.OrderNumber,
                OrderDate = o.OrderDate,
                Status = o.Status,
                UserId = o.UserId,
                TotalAmount = o.TotalAmount,
                DiscountAmount = o.DiscountAmount,
                GrandTotal = o.GrandTotal,
                PaymentStatus = o.PaymentStatus,
                PaymentMethod = o.PaymentMethod,
                ShippingAddress = o.ShippingAddress,
                CreatedAt = o.CreatedAt,
                UpdatedAt = o.UpdatedAt,
                ItemCount = o.OrderItems.Count
            })
            .ToListAsync();
        return Ok(data);
    }

   
    // POST: /api/orders/validate-details
    // Validates order details (customer information) before order creation
    // Returns validation errors if any fields are invalid
   
    [HttpPost("validate-details")]
    public IActionResult ValidateOrderDetails([FromBody] OrderDetailsValidationDto dto)
    {
        var response = new ValidationErrorResponseDto { IsValid = true };

        if (!ModelState.IsValid)
        {
            response.IsValid = false;
            foreach (var state in ModelState.Values)
            {
                foreach (var error in state.Errors)
                {
                    response.Errors.Add(error.ErrorMessage, error.ErrorMessage);
                }
            }
            return Ok(response);
        }

       
        // Check if email contains valid characters
        if (dto.Email != null && dto.Email.Contains("@") && !dto.Email.Contains("."))
        {
            response.IsValid = false;
            response.Errors.Add("email", "Please enter a valid email address.");
        }

        // Check if phone contains valid characters (at least some digits)
        if (dto.Phone != null && !System.Text.RegularExpressions.Regex.IsMatch(dto.Phone, @"\d"))
        {
            response.IsValid = false;
            response.Errors.Add("phone", "Phone number must contain at least one digit.");
        }

        return Ok(response);
    }

[HttpPost("pending")]
    public async Task<IActionResult> CreatePendingOrder([FromBody] CreateOrderDto dto)
    {
        try
        {
            // Log received data for debugging
            Console.WriteLine($"[CreatePendingOrder] Received: UserId={dto.UserId}, Items={dto.Items?.Count ?? 0}");

            if (dto.Items == null || dto.Items.Count == 0)
                return BadRequest(new { error = "Order must have at least one item." });

            var subtotal = dto.Items.Sum(i => i.UnitPrice * i.Quantity);
            var discount = dto.DiscountAmount ?? 0;
            var grandTotal = subtotal - discount;
            if (grandTotal < 0) grandTotal = 0;

            // Determine payment status based on payment method
            
            string paymentStatus = dto.PaymentMethod?.ToLower() switch
            {
                "khalti" => "Paid",
                "paylater" => "Unpaid",
                "cashondelivery" => "Pending",
                _ => "Unpaid"
            };

            var order = new Order
            {
                OrderNumber = $"ORDER_{DateTime.UtcNow:yyyyMMddHHmmssfff}",
                OrderDate = DateTime.UtcNow,
                Status = "Pending",
                UserId = dto.UserId,
                TotalAmount = subtotal,
                DiscountAmount = discount,
                GrandTotal = grandTotal,
                PaymentStatus = paymentStatus,
                PaymentMethod = dto.PaymentMethod,
                ShippingAddress = dto.ShippingAddress,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = null,
                OrderItems = dto.Items.Select(i => new OrderItem
                {
                    ProductId = i.ProductId,
                    Quantity = i.Quantity,
                    UnitPrice = i.UnitPrice,
                    TotalPrice = i.UnitPrice * i.Quantity,
                    CreatedAt = DateTime.UtcNow
                }).ToList()
            };

            _context.Orders.Add(order);
            await _context.SaveChangesAsync();

            // Store pending order ID in session (if available)
            try {
                HttpContext.Session?.SetInt32("PendingOrderId", order.Id);
            } catch { /* Session may not be enabled, ignore */ }

            return Ok(new { orderId = order.Id, amount = order.GrandTotal });
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[CreatePendingOrder] Exception: {ex.Message}\n{ex.StackTrace}");
            return StatusCode(500, new { error = "Failed to create pending order", details = ex.Message });
        }
    }
    [Authorize]
    [HttpGet("user-orders")]
    public async Task<IActionResult> GetUserOrders()
    {
        var userIdStr = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrWhiteSpace(userIdStr))
            return Unauthorized(new { error = "User not authenticated." });

        var user = await _context.Users.FirstOrDefaultAsync(u => u.IdentityUserId == userIdStr);
        if (user == null)
            return Unauthorized(new { error = "User not found." });

        var orders = await _context.Orders
            .Where(o => o.UserId == user.Id)
            .OrderByDescending(o => o.OrderDate)
            .Select(o => new OrderDetailDto
            {
                Id = o.Id,
                OrderNumber = o.OrderNumber,
                OrderDate = o.OrderDate,
                Status = o.Status,
                UserId = o.UserId,
                TotalAmount = o.TotalAmount,
                DiscountAmount = o.DiscountAmount,
                GrandTotal = o.GrandTotal,
                PaymentStatus = o.PaymentStatus,
                PaymentMethod = o.PaymentMethod,
                ShippingAddress = o.ShippingAddress,
                CreatedAt = o.CreatedAt,
                UpdatedAt = o.UpdatedAt,
                OrderItems = o.OrderItems.Select(oi => new OrderItemSummaryDto
                {
                    Id = oi.Id,
                    ProductId = oi.ProductId,
                    ProductName = oi.Product.Name,
                    Quantity = oi.Quantity,
                    UnitPrice = oi.UnitPrice,
                    TotalPrice = oi.TotalPrice,
                    CreatedAt = oi.CreatedAt
                }).ToList()
            })
            .ToListAsync();

        return Ok(orders);
    }

    [Authorize]
    [HttpGet("user-orders/history")]
    public async Task<IActionResult> GetUserOrderHistory(
        int page = 1,
        int pageSize = 6,
        string? search = null)
    {
        if (page < 1) page = 1;

        var userIdStr = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrWhiteSpace(userIdStr))
            return Unauthorized(new { error = "User not authenticated." });

        var user = await _context.Users.FirstOrDefaultAsync(u => u.IdentityUserId == userIdStr);
        if (user == null)
            return Unauthorized(new { error = "User not found." });

        var query = _context.Orders
            .Where(o => o.UserId == user.Id)
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(search))
        {
            var lowered = search.Trim().ToLower();
            query = query.Where(o =>
                o.OrderNumber.ToLower().Contains(lowered)
                || o.Status.ToLower().Contains(lowered)
                || o.PaymentStatus.ToLower().Contains(lowered)
                || (o.PaymentMethod ?? string.Empty).ToLower().Contains(lowered));
        }

        var totalRecords = await query.CountAsync();

        var data = await query
            .OrderByDescending(o => o.OrderDate)
            .ThenByDescending(o => o.Id)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(o => new OrderDto
            {
                Id = o.Id,
                OrderNumber = o.OrderNumber,
                OrderDate = o.OrderDate,
                Status = o.Status,
                UserId = o.UserId,
                TotalAmount = o.TotalAmount,
                DiscountAmount = o.DiscountAmount,
                GrandTotal = o.GrandTotal,
                PaymentStatus = o.PaymentStatus,
                PaymentMethod = o.PaymentMethod,
                ShippingAddress = o.ShippingAddress,
                CreatedAt = o.CreatedAt,
                UpdatedAt = o.UpdatedAt,
                ItemCount = o.OrderItems.Count
            })
            .ToListAsync();

        return Ok(new
        {
            page,
            pageSize,
            totalRecords,
            totalPages = (int)Math.Ceiling((double)totalRecords / pageSize),
            data
        });
    }

    [Authorize(Roles = "ADMIN,STAFF")]
    [HttpPost("send-overdue-payment-reminders")]
    public async Task<IActionResult> SendOverduePaymentReminders(CancellationToken cancellationToken)
    {
        var overdueOrders = await GetOverdueUnpaidOrdersQuery(DateTime.UtcNow)
            .Include(o => o.User)
            .ToListAsync(cancellationToken);

        var sentCount = await SendReminderEmailsAsync(overdueOrders, cancellationToken);

        return Ok(new
        {
            message = $"Processed {overdueOrders.Count} overdue unpaid orders.",
            sentCount
        });
    }

    [Authorize]
    [HttpDelete("user-orders/{id:int}")]
    public async Task<IActionResult> DeleteUserOrder(int id)
    {
        var userIdStr = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrWhiteSpace(userIdStr))
            return Unauthorized(new { error = "User not authenticated." });

        var user = await _context.Users.FirstOrDefaultAsync(u => u.IdentityUserId == userIdStr);
        if (user == null)
            return Unauthorized(new { error = "User not found." });

        var order = await _context.Orders
            .FirstOrDefaultAsync(o => o.Id == id && o.UserId == user.Id);

        if (order == null)
            return NotFound(new { error = "Order not found." });

        try
        {
            using (var transaction = await _context.Database.BeginTransactionAsync())
            {
                try
                {
                    // Delete order items first (handle foreign key constraint)
                    var orderItems = await _context.OrderItems
                        .Where(oi => oi.OrderId == id)
                        .ToListAsync();
                    if (orderItems.Any())
                    {
                        _context.OrderItems.RemoveRange(orderItems);
                        await _context.SaveChangesAsync();
                    }

                    // Delete order
                    _context.Orders.Remove(order);
                    await _context.SaveChangesAsync();

                    await transaction.CommitAsync();
                    return NoContent();
                }
                catch
                {
                    await transaction.RollbackAsync();
                    throw;
                }
            }
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { error = "Failed to delete order: " + ex.InnerException?.Message ?? ex.Message });
        }
    }

    [Authorize]
    [HttpGet("user-orders/{id:int}")]
    public async Task<IActionResult> GetUserOrderDetail(int id)
    {
        var userIdStr = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrWhiteSpace(userIdStr))
            return Unauthorized(new { error = "User not authenticated." });

        var user = await _context.Users.FirstOrDefaultAsync(u => u.IdentityUserId == userIdStr);
        if (user == null)
            return Unauthorized(new { error = "User not found." });

        var order = await _context.Orders
            .Include(o => o.OrderItems)
                .ThenInclude(oi => oi.Product)
            .FirstOrDefaultAsync(o => o.Id == id && o.UserId == user.Id);

        if (order == null)
            return NotFound(new { error = "Order not found." });

        return Ok(new OrderDetailDto
        {
            Id = order.Id,
            OrderNumber = order.OrderNumber,
            OrderDate = order.OrderDate,
            Status = order.Status,
            UserId = order.UserId,
            TotalAmount = order.TotalAmount,
            DiscountAmount = order.DiscountAmount,
            GrandTotal = order.GrandTotal,
            PaymentStatus = order.PaymentStatus,
            PaymentMethod = order.PaymentMethod,
            ShippingAddress = order.ShippingAddress,
            CreatedAt = order.CreatedAt,
            UpdatedAt = order.UpdatedAt,
            OrderItems = order.OrderItems.Select(oi => new OrderItemSummaryDto
            {
                Id = oi.Id,
                ProductId = oi.ProductId,
                ProductName = oi.Product.Name,
                Quantity = oi.Quantity,
                UnitPrice = oi.UnitPrice,
                TotalPrice = oi.TotalPrice,
                CreatedAt = oi.CreatedAt
            }).ToList()
        });
    }

    [Authorize]
    [HttpPut("{id:int}/cancel")]
    public async Task<IActionResult> CancelUserOrder(int id)
    {
        var userIdStr = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrWhiteSpace(userIdStr))
            return Unauthorized(new { error = "User not authenticated." });

        var user = await _context.Users.FirstOrDefaultAsync(u => u.IdentityUserId == userIdStr);
        if (user == null)
            return Unauthorized(new { error = "User not found." });

        var order = await _context.Orders
            .FirstOrDefaultAsync(o => o.Id == id && o.UserId == user.Id);

        if (order == null)
            return NotFound(new { error = "Order not found." });

        // Check if order can be cancelled
        string normalizedStatus = (order.Status ?? "").ToLower();
        if (normalizedStatus == "delivered" || normalizedStatus == "shipped" || normalizedStatus == "cancelled")
            return BadRequest(new { error = "This order cannot be cancelled as it is already completed or cancelled." });

        // Update order status to cancelled
        order.Status = "Cancelled";
        order.UpdatedAt = DateTime.UtcNow;

        _context.Orders.Update(order);
        await _context.SaveChangesAsync();

        return Ok(new { 
            message = $"Order {order.OrderNumber} has been cancelled successfully.",
            orderId = order.Id,
            status = order.Status
        });
    }

    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetById(int id)
    {
        var order = await _context.Orders
            .Include(o => o.OrderItems)
                .ThenInclude(oi => oi.Product)
            .FirstOrDefaultAsync(o => o.Id == id);

        if (order == null) return NotFound();

        return Ok(new OrderDetailDto
        {
            Id = order.Id,
            OrderNumber = order.OrderNumber,
            OrderDate = order.OrderDate,
            Status = order.Status,
            UserId = order.UserId,
            TotalAmount = order.TotalAmount,
            DiscountAmount = order.DiscountAmount,
            GrandTotal = order.GrandTotal,
            PaymentStatus = order.PaymentStatus,
            PaymentMethod = order.PaymentMethod,
            ShippingAddress = order.ShippingAddress,
            CreatedAt = order.CreatedAt,
            UpdatedAt = order.UpdatedAt,
            OrderItems = order.OrderItems.Select(oi => new OrderItemSummaryDto
            {
                Id = oi.Id,
                ProductId = oi.ProductId,
                ProductName = oi.Product.Name,
                Quantity = oi.Quantity,
                UnitPrice = oi.UnitPrice,
                TotalPrice = oi.TotalPrice,
                CreatedAt = oi.CreatedAt
            }).ToList()
        });
    }

    internal IQueryable<Order> GetOverdueUnpaidOrdersQuery(DateTime nowUtc)
    {
        var overdueCutoff = nowUtc.Subtract(OverdueReminderThreshold);

        return _context.Orders
            .Where(o => o.OrderDate <= overdueCutoff)
            .Where(o => o.PaymentStatus.ToLower() == "unpaid");
    }

    internal async Task<int> SendReminderEmailsAsync(IEnumerable<Order> orders, CancellationToken cancellationToken = default)
    {
        var sentCount = 0;

        foreach (var order in orders)
        {
            if (order.User == null || string.IsNullOrWhiteSpace(order.User.Email))
            {
                continue;
            }

            var subject = $"Payment reminder for order {order.OrderNumber}";
            var body = BuildReminderEmailBody(order);

            await _emailSender.SendEmailAsync(order.User.Email, subject, body);
            sentCount++;
        }

        return sentCount;
    }

    private static string BuildReminderEmailBody(Order order)
    {
        return $@"
            <h2>Payment Reminder</h2>
            <p>Hello,</p>
            <p>Your order <strong>{order.OrderNumber}</strong> placed on <strong>{order.OrderDate:yyyy-MM-dd}</strong> is still marked as unpaid.</p>
            <p>Outstanding amount: <strong>{order.GrandTotal:0.00}</strong></p>
            <p>Please complete your payment as soon as possible.</p>
            <p>Thank you,<br/>Yaantra</p>";
    }

    [HttpGet("{id:int}/items")]
    public async Task<IActionResult> GetItems(int id)
    {
        var exists = await _context.Orders.AnyAsync(o => o.Id == id);
        if (!exists) return NotFound();

        var items = await _context.OrderItems
            .Where(oi => oi.OrderId == id)
            .Select(oi => new OrderItemSummaryDto
            {
                Id = oi.Id,
                ProductId = oi.ProductId,
                ProductName = oi.Product.Name,
                Quantity = oi.Quantity,
                UnitPrice = oi.UnitPrice,
                TotalPrice = oi.TotalPrice,
                CreatedAt = oi.CreatedAt
            })
            .ToListAsync();
        return Ok(items);
    }

    [HttpGet("{id:int}/user")]
    public async Task<IActionResult> GetUser(int id)
    {
        var order = await _context.Orders
            .Include(o => o.User)
            .FirstOrDefaultAsync(o => o.Id == id);

        if (order == null) return NotFound();

        var u = order.User;
        return Ok(new UserDto
        {
            Id = u.Id,
            FirstName = u.FirstName,
            LastName = u.LastName,
            Email = u.Email,
            Phone = u.Phone,
            Role = u.Role
        });
    }

    [HttpPost]
    public async Task<IActionResult> Create(CreateOrderDto dto)
    {
        if (dto.Items == null || !dto.Items.Any())
            return BadRequest(new { error = "Order must contain at least one item." });

        var now = DateTime.UtcNow;
        var orderLevelDiscount = NormalizeDiscount(dto.DiscountAmount);

        var mappedItems = dto.Items.Select(i =>
        {
            return new OrderItem
            {
                ProductId = i.ProductId,
                Quantity = i.Quantity,
                UnitPrice = i.UnitPrice,
                TotalPrice = i.UnitPrice * i.Quantity,
                CreatedAt = now
            };
        }).ToList();

        var totalAmount = mappedItems.Sum(i => i.UnitPrice * i.Quantity);
        var discountedSubtotal = mappedItems.Sum(i => i.TotalPrice);
        var grandTotal = Math.Max(0m, discountedSubtotal - orderLevelDiscount);

        var order = new Order
        {
            OrderNumber = await GenerateOrderNumberAsync(),
            OrderDate = dto.OrderDate == default ? now : dto.OrderDate,
            Status = string.IsNullOrWhiteSpace(dto.Status) ? "Pending" : dto.Status.Trim(),
            UserId = dto.UserId,
            TotalAmount = totalAmount,
            DiscountAmount = orderLevelDiscount,
            GrandTotal = grandTotal,
            PaymentStatus = string.IsNullOrWhiteSpace(dto.PaymentStatus) ? "Unpaid" : dto.PaymentStatus.Trim(),
            PaymentMethod = string.IsNullOrWhiteSpace(dto.PaymentMethod) ? null : dto.PaymentMethod.Trim(),
            ShippingAddress = string.IsNullOrWhiteSpace(dto.ShippingAddress) ? null : dto.ShippingAddress.Trim(),
            CreatedAt = now,
            UpdatedAt = now,
            OrderItems = mappedItems
        };

        _context.Orders.Add(order);
        await _context.SaveChangesAsync();

        return CreatedAtAction(nameof(GetById), new { id = order.Id }, new OrderDto
        {
            Id = order.Id,
            OrderNumber = order.OrderNumber,
            OrderDate = order.OrderDate,
            Status = order.Status,
            UserId = order.UserId,
            TotalAmount = order.TotalAmount,
            DiscountAmount = order.DiscountAmount,
            GrandTotal = order.GrandTotal,
            PaymentStatus = order.PaymentStatus,
            PaymentMethod = order.PaymentMethod,
            ShippingAddress = order.ShippingAddress,
            CreatedAt = order.CreatedAt,
            UpdatedAt = order.UpdatedAt,
            ItemCount = order.OrderItems?.Count ?? 0
        });
    }

    [HttpPost("{id:int}/items")]
    public async Task<IActionResult> AddItem(int id, CreateOrderLineDto item)
    {
        var orderExists = await _context.Orders.AnyAsync(o => o.Id == id);
        if (!orderExists) return NotFound("Order not found");

        var exists = await _context.OrderItems.AnyAsync(oi => oi.OrderId == id && oi.ProductId == item.ProductId);
        if (exists) return BadRequest("Item already exists in order");

        _context.OrderItems.Add(new OrderItem
        {
            OrderId = id,
            ProductId = item.ProductId,
            Quantity = item.Quantity,
            UnitPrice = item.UnitPrice,
            TotalPrice = item.UnitPrice * item.Quantity,
            CreatedAt = DateTime.UtcNow
        });

        await _context.SaveChangesAsync();
        await RecalculateOrderTotalsAsync(id);
        return Ok();
    }

    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(int id, UpdateOrderDto dto)
    {
        var order = await _context.Orders.Include(o => o.OrderItems).FirstOrDefaultAsync(o => o.Id == id);
        if (order == null) return NotFound();

        var now = DateTime.UtcNow;
        var orderLevelDiscount = NormalizeDiscount(dto.DiscountAmount);

        order.OrderDate = dto.OrderDate == default ? order.OrderDate : dto.OrderDate;
        order.Status = dto.Status;
        order.UserId = dto.UserId;
        order.PaymentStatus = string.IsNullOrWhiteSpace(dto.PaymentStatus) ? order.PaymentStatus : dto.PaymentStatus.Trim();
        order.PaymentMethod = string.IsNullOrWhiteSpace(dto.PaymentMethod) ? null : dto.PaymentMethod.Trim();
        order.ShippingAddress = string.IsNullOrWhiteSpace(dto.ShippingAddress) ? null : dto.ShippingAddress.Trim();
        order.DiscountAmount = orderLevelDiscount;
        order.UpdatedAt = now;

        _context.OrderItems.RemoveRange(order.OrderItems);

        var mappedItems = new List<OrderItem>();
        if (dto.Items != null && dto.Items.Any())
        {
            mappedItems = dto.Items.Select(i =>
            {
                return new OrderItem
                {
                    OrderId = id,
                    ProductId = i.ProductId,
                    Quantity = i.Quantity,
                    UnitPrice = i.UnitPrice,
                    TotalPrice = i.UnitPrice * i.Quantity,
                    CreatedAt = now
                };
            }).ToList();

            order.OrderItems = mappedItems;
        }

        order.TotalAmount = mappedItems.Sum(i => i.UnitPrice * i.Quantity);
        var discountedSubtotal = mappedItems.Sum(i => i.TotalPrice);
        order.GrandTotal = Math.Max(0m, discountedSubtotal - orderLevelDiscount);

        await _context.SaveChangesAsync();
        return NoContent();
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        var order = await _context.Orders.FindAsync(id);
        if (order == null) return NotFound();

        _context.Orders.Remove(order);
        await _context.SaveChangesAsync();
        return NoContent();
    }

    [HttpPost("bulk")]
    public async Task<IActionResult> BulkInsert(List<CreateOrderDto> dtos)
    {
        var now = DateTime.UtcNow;
        var orders = new List<Order>();

        foreach (var dto in dtos)
        {
            var orderLevelDiscount = NormalizeDiscount(dto.DiscountAmount);
            var mappedItems = (dto.Items ?? new List<CreateOrderLineDto>()).Select(i =>
            {
                return new OrderItem
                {
                    ProductId = i.ProductId,
                    Quantity = i.Quantity,
                    UnitPrice = i.UnitPrice,
                    TotalPrice = i.UnitPrice * i.Quantity,
                    CreatedAt = now
                };
            }).ToList();

            var totalAmount = mappedItems.Sum(i => i.UnitPrice * i.Quantity);
            var discountedSubtotal = mappedItems.Sum(i => i.TotalPrice);
            var grandTotal = Math.Max(0m, discountedSubtotal - orderLevelDiscount);

            orders.Add(new Order
            {
                OrderNumber = await GenerateOrderNumberAsync(),
                OrderDate = dto.OrderDate == default ? now : dto.OrderDate,
                Status = string.IsNullOrWhiteSpace(dto.Status) ? "Pending" : dto.Status.Trim(),
                UserId = dto.UserId,
                TotalAmount = totalAmount,
                DiscountAmount = orderLevelDiscount,
                GrandTotal = grandTotal,
                PaymentStatus = string.IsNullOrWhiteSpace(dto.PaymentStatus) ? "Unpaid" : dto.PaymentStatus.Trim(),
                PaymentMethod = string.IsNullOrWhiteSpace(dto.PaymentMethod) ? null : dto.PaymentMethod.Trim(),
                ShippingAddress = string.IsNullOrWhiteSpace(dto.ShippingAddress) ? null : dto.ShippingAddress.Trim(),
                CreatedAt = now,
                UpdatedAt = now,
                OrderItems = mappedItems
            });
        }

        await _context.Orders.AddRangeAsync(orders);
        await _context.SaveChangesAsync();
        return Ok(new { inserted = orders.Count });
    }

    [HttpGet("with-details")]
    public async Task<IActionResult> WithDetails()
    {
        var data = await _context.Orders
            .Select(o => new OrderWithDetailsDto
            {
                Id = o.Id,
                OrderNumber = o.OrderNumber,
                OrderDate = o.OrderDate,
                Status = o.Status,
                TotalAmount = o.TotalAmount,
                DiscountAmount = o.DiscountAmount,
                GrandTotal = o.GrandTotal,
                PaymentStatus = o.PaymentStatus,
                PaymentMethod = o.PaymentMethod,
                ShippingAddress = o.ShippingAddress,
                CreatedAt = o.CreatedAt,
                UpdatedAt = o.UpdatedAt,
                User = new UserDto
                {
                    Id = o.User.Id,
                    FirstName = o.User.FirstName,
                    LastName = o.User.LastName,
                    Email = o.User.Email,
                    Phone = o.User.Phone,
                    Role = o.User.Role
                },
                OrderItems = o.OrderItems.Select(oi => new OrderItemSummaryDto
                {
                    Id = oi.Id,
                    ProductId = oi.ProductId,
                    ProductName = oi.Product.Name,
                    Quantity = oi.Quantity,
                    UnitPrice = oi.UnitPrice,
                    TotalPrice = oi.TotalPrice,
                    CreatedAt = oi.CreatedAt
                }).ToList()
            })
            .ToListAsync();
        return Ok(data);
    }

    [HttpGet("count")]
    public async Task<IActionResult> Count()
        => Ok(new { totalOrders = await _context.Orders.CountAsync() });

    [HttpGet("total-amount")]
    public async Task<IActionResult> TotalAmount()
    {
        var total = await _context.Orders
            .SumAsync(o => o.GrandTotal);
        return Ok(new { totalAmount = total });
    }

    [HttpGet("top-users")]
    public async Task<IActionResult> TopUsers()
    {
        var data = await _context.Orders
            .GroupBy(o => new { o.UserId, o.User.FirstName, o.User.LastName })
            .Select(g => new
            {
                g.Key.UserId,
                UserName = g.Key.FirstName + " " + g.Key.LastName,
                OrderCount = g.Count()
            })
            .OrderByDescending(x => x.OrderCount)
            .ToListAsync();
        return Ok(data);
    }

    private static decimal NormalizeDiscount(decimal? value)
    {
        if (!value.HasValue || value.Value < 0)
            return 0m;

        return value.Value;
    }

    private async Task RecalculateOrderTotalsAsync(int orderId)
    {
        var order = await _context.Orders
            .Include(o => o.OrderItems)
            .FirstOrDefaultAsync(o => o.Id == orderId);

        if (order == null)
            return;

        var totalAmount = order.OrderItems.Sum(i => i.UnitPrice * i.Quantity);
        var discountedSubtotal = order.OrderItems.Sum(i => i.TotalPrice);
        var orderDiscount = NormalizeDiscount(order.DiscountAmount);

        order.TotalAmount = totalAmount;
        order.GrandTotal = Math.Max(0m, discountedSubtotal - orderDiscount);
        order.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();
    }

    private async Task<string> GenerateOrderNumberAsync()
    {
        var year = DateTime.UtcNow.Year;
        var prefix = $"ORD-{year}-";

        var latest = await _context.Orders
            .Where(o => o.OrderNumber.StartsWith(prefix))
            .OrderByDescending(o => o.OrderNumber)
            .Select(o => o.OrderNumber)
            .FirstOrDefaultAsync();

        var nextNumber = 1;
        if (!string.IsNullOrWhiteSpace(latest) && latest.Length > prefix.Length)
        {
            var numericPart = latest.Substring(prefix.Length);
            if (int.TryParse(numericPart, out var parsed))
                nextNumber = parsed + 1;
        }

        return $"{prefix}{nextNumber:D4}";
    }
}