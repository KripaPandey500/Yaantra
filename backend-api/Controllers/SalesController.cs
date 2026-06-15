using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Authorization;
using WeatherAPI.DTOs;

using WeatherAPI.Services;

[Authorize]
[ApiController]
[Route("api/[controller]")]
public class SalesController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly ILogger<SalesController> _logger;
    private readonly IEmailSender _emailSender; // Added for Feature #11

    public SalesController(AppDbContext db, ILogger<SalesController> logger, IEmailSender emailSender)
    {
        _db = db;
        _logger = logger;
        _emailSender = emailSender;
    }

    // Get all sales with optional filters for date range and staff
    [HttpGet]
    public async Task<ActionResult<List<SaleSummaryDto>>> GetAllSales(
        [FromQuery] DateTime? from,
        [FromQuery] DateTime? to,
        [FromQuery] int? staffId)
    {
        var query = _db.Sales
            .Include(s => s.Staff)
            .Include(s => s.Customer)
            .Include(s => s.SaleItems)
            .AsQueryable();

        if (from.HasValue) query = query.Where(s => s.SaleDate >= from.Value);
        if (to.HasValue)   query = query.Where(s => s.SaleDate <= to.Value);
        if (staffId.HasValue) query = query.Where(s => s.StaffId == staffId.Value);

        var sales = await query.OrderByDescending(s => s.SaleDate).ToListAsync();

        return Ok(sales.Select(s => new SaleSummaryDto
        {
            Id            = s.Id,
            InvoiceNumber = s.InvoiceNumber,
            SaleDate      = s.SaleDate,
            CustomerName  = s.Customer != null
                ? $"{s.Customer.FirstName} {s.Customer.LastName}".Trim()
                : s.WalkInCustomerName ?? "Walk-in Customer",
            ItemCount     = s.SaleItems.Count,
            GrandTotal    = s.GrandTotal,
            PaymentMethod = s.PaymentMethod,
            PaymentStatus = s.PaymentStatus,
            StaffName     = $"{s.Staff.FirstName} {s.Staff.LastName}".Trim()
        }));
    }

    // Get a single sale with all details
    [HttpGet("{id}")]
    public async Task<ActionResult<SaleResponseDto>> GetSale(int id)
    {
        var sale = await _db.Sales
            .Include(s => s.Staff)
            .Include(s => s.Customer)
            .Include(s => s.SaleItems).ThenInclude(si => si.Product)
            .FirstOrDefaultAsync(s => s.Id == id);

        if (sale == null) return NotFound(new { message = "Sale not found" });

        return Ok(MapToResponse(sale));
    }

    // Create a new sale
    [HttpPost]
    public async Task<ActionResult<SaleResponseDto>> CreateSale([FromBody] CreateSaleDto dto)
    {
        if (dto.Items == null || dto.Items.Count == 0)
            return BadRequest(new { message = "Sale must have at least one item." });

        var staff = await _db.Users.FindAsync(dto.StaffId);
        if (staff == null) return NotFound(new { message = "Staff not found." });

        if (dto.CustomerId.HasValue)
        {
            var customer = await _db.Users.FindAsync(dto.CustomerId.Value);
            if (customer == null) return NotFound(new { message = "Customer not found." });
        }

        if (!dto.CustomerId.HasValue && string.IsNullOrWhiteSpace(dto.WalkInCustomerName))
            return BadRequest(new { message = "Please provide a customer or walk-in customer name." });

        foreach (var item in dto.Items)
        {
            var product = await _db.Products.FindAsync(item.ProductId);
            if (product == null)
                return NotFound(new { message = $"Product ID {item.ProductId} not found." });
            if (product.StockQty < item.Quantity)
                return BadRequest(new { message = $"Insufficient stock for '{product.Name}'. Available: {product.StockQty}" });
        }

        var saleItems = dto.Items.Select(i => new SaleItem
        {
            ProductId      = i.ProductId,
            Quantity       = i.Quantity,
            UnitPrice      = i.UnitPrice,
            DiscountPerItem = i.DiscountPerItem,
            TotalPrice     = (i.UnitPrice - i.DiscountPerItem) * i.Quantity
        }).ToList();

        decimal subTotal   = saleItems.Sum(i => i.TotalPrice);
        decimal grandTotal = subTotal - dto.DiscountAmount;
        if (grandTotal < 0) grandTotal = 0;

        var invoiceNumber = $"INV-{DateTime.UtcNow:yyyyMMdd}-{new Random().Next(10000, 99999)}";

        var sale = new Sale
        {
            InvoiceNumber        = invoiceNumber,
            SaleDate             = DateTime.UtcNow,
            StaffId              = dto.StaffId,
            CustomerId           = dto.CustomerId,
            WalkInCustomerName   = dto.WalkInCustomerName,
            WalkInCustomerPhone  = dto.WalkInCustomerPhone,
            SubTotal             = subTotal,
            DiscountAmount       = dto.DiscountAmount,
            GrandTotal           = grandTotal,
            PaymentMethod        = dto.PaymentMethod,
            PaymentStatus        = dto.PaymentStatus,
            Notes                = dto.Notes,
            SaleItems            = saleItems,
            CreatedAt            = DateTime.UtcNow
        };

        _db.Sales.Add(sale);

        foreach (var item in dto.Items)
        {
            var product = await _db.Products.FindAsync(item.ProductId);
            if (product != null)
            {
                product.StockQty -= item.Quantity;
                product.UpdatedAt = DateTime.UtcNow;
            }
        }

        await _db.SaveChangesAsync();

        var created = await _db.Sales
            .Include(s => s.Staff)
            .Include(s => s.Customer)
            .Include(s => s.SaleItems).ThenInclude(si => si.Product)
            .FirstAsync(s => s.Id == sale.Id);

        return CreatedAtAction(nameof(GetSale), new { id = sale.Id }, MapToResponse(created));
    }

 [HttpPost("{id}/send-email")]
public async Task<IActionResult> SendEmail(int id, [FromQuery] string manualEmail)
{
   
    var sale = await _db.Sales
        .Include(s => s.Customer)
        .Include(s => s.SaleItems).ThenInclude(si => si.Product)
        .FirstOrDefaultAsync(s => s.Id == id);

  
    if (sale == null) 
    {
        return NotFound(new { message = $"Database Error: Sale ID {id} does not exist." });
    }

    // 1. Determine recipient
    string targetEmail = manualEmail ?? sale.Customer?.Email;
    
    if (string.IsNullOrEmpty(targetEmail)) 
        return BadRequest(new { message = "Recipient email address not found. Please type an email manually." });

    // 2. Validate Email Format (Prevents sending to a 'Name' instead of 'Email')
    if (!System.Text.RegularExpressions.Regex.IsMatch(targetEmail, @"^[^@\s]+@[^@\s]+\.[^@\s]+$"))
    {
        return BadRequest(new { message = $"'{targetEmail}' is not a valid email address." });
    }

    
    string rows = string.Join("", sale.SaleItems.Select(i => 
        $@"<tr>
            <td style='padding: 12px 16px; border-bottom: 1px solid #e5e7eb; color: #374151;'>{i.Product?.Name ?? "Unknown"}</td>
            <td style='padding: 12px 16px; border-bottom: 1px solid #e5e7eb; text-align: center; color: #374151;'>{i.Quantity}</td>
            <td style='padding: 12px 16px; border-bottom: 1px solid #e5e7eb; text-align: right; color: #374151;'>Rs. {i.UnitPrice:N2}</td>
            <td style='padding: 12px 16px; border-bottom: 1px solid #e5e7eb; text-align: right; color: #111827; font-weight: 600;'>Rs. {i.TotalPrice:N2}</td>
        </tr>"));

    // Professional email template
    string htmlMessage = $@"
<!DOCTYPE html>
<html lang='en'>
<head>
    <meta charset='UTF-8'>
    <meta name='viewport' content='width=device-width, initial-scale=1.0'>
    <title>Yaantra Invoice</title>
</head>
<body style='margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, ""Segoe UI"", Roboto, ""Helvetica Neue"", Arial, sans-serif; background-color: #f9fafb;'>
    <div style='background-color: #f9fafb; padding: 40px 20px;'>
        <div style='max-width: 600px; margin: 0 auto; background-color: white; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); overflow: hidden;'>
            
            <!-- Header with Brand -->
            <div style='background: linear-gradient(135deg, #062621 0%, #0a362f 100%); padding: 40px 30px; text-align: center;'>
                <h1 style='margin: 0; font-size: 32px; color: white; font-weight: 700; letter-spacing: 1px;'>YAANTRA</h1>
                <p style='margin: 8px 0 0 0; font-size: 13px; color: #c1e5e1; text-transform: uppercase; letter-spacing: 2px; font-weight: 600;'>Vehicle & Parts Service</p>
                <div style='margin-top: 16px; padding-top: 16px; border-top: 1px solid rgba(255,255,255,0.2);'>
                    <p style='margin: 0; font-size: 12px; color: #c1e5e1;'>🚗 Professional Auto Service | 📞 24/7 Support</p>
                </div>
            </div>

            <!-- Invoice Info -->
            <div style='padding: 30px; background-color: #f9fafb; border-bottom: 1px solid #e5e7eb;'>
                <div style='display: grid; grid-template-columns: 1fr 1fr; gap: 20px; font-size: 13px;'>
                    <div>
                        <p style='margin: 0 0 4px 0; color: #6b7280; font-weight: 600; text-transform: uppercase;'>Invoice Number</p>
                        <p style='margin: 0; color: #111827; font-weight: 700; font-size: 15px;'>#{sale.InvoiceNumber}</p>
                    </div>
                    <div>
                        <p style='margin: 0 0 4px 0; color: #6b7280; font-weight: 600; text-transform: uppercase;'>Date</p>
                        <p style='margin: 0; color: #111827; font-weight: 700; font-size: 15px;'>{sale.SaleDate:MMMM dd, yyyy HH:mm}</p>
                    </div>
                    <div>
                        <p style='margin: 0 0 4px 0; color: #6b7280; font-weight: 600; text-transform: uppercase;'>Customer</p>
                        <p style='margin: 0; color: #111827; font-weight: 600;'>{(sale.Customer != null ? (sale.Customer.FirstName + " " + sale.Customer.LastName) : sale.WalkInCustomerName)}</p>
                    </div>
                    <div>
                        <p style='margin: 0 0 4px 0; color: #6b7280; font-weight: 600; text-transform: uppercase;'>Status</p>
                        <p style='margin: 0; color: #059669; font-weight: 700;'>{sale.PaymentStatus}</p>
                    </div>
                </div>
            </div>

            <!-- Items Table -->
            <div style='padding: 30px;'>
                <p style='margin: 0 0 16px 0; color: #6b7280; font-weight: 600; text-transform: uppercase; font-size: 12px;'>Order Details</p>
                <table style='width: 100%; border-collapse: collapse; margin-bottom: 20px;'>
                    <thead>
                        <tr style='background-color: #f3f4f6; border-bottom: 2px solid #e5e7eb;'>
                            <th style='padding: 12px 16px; text-align: left; color: #374151; font-weight: 700; font-size: 13px; text-transform: uppercase;'>Item</th>
                            <th style='padding: 12px 16px; text-align: center; color: #374151; font-weight: 700; font-size: 13px; text-transform: uppercase;'>Qty</th>
                            <th style='padding: 12px 16px; text-align: right; color: #374151; font-weight: 700; font-size: 13px; text-transform: uppercase;'>Unit Price</th>
                            <th style='padding: 12px 16px; text-align: right; color: #374151; font-weight: 700; font-size: 13px; text-transform: uppercase;'>Amount</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows}
                    </tbody>
                </table>
            </div>

            <!-- Totals Section -->
            <div style='padding: 20px 30px; background-color: #f9fafb; border-top: 2px solid #e5e7eb; border-bottom: 2px solid #e5e7eb;'>
                <div style='display: flex; justify-content: space-between; margin-bottom: 12px; font-size: 13px;'>
                    <span style='color: #6b7280;'>Subtotal:</span>
                    <span style='color: #111827; font-weight: 600;'>Rs. {sale.SubTotal:N2}</span>
                </div>
                {(sale.DiscountAmount > 0 ? $@"
                <div style='display: flex; justify-content: space-between; margin-bottom: 12px; font-size: 13px;'>
                    <span style='color: #dc2626;'>Discount:</span>
                    <span style='color: #dc2626; font-weight: 600;'>- Rs. {sale.DiscountAmount:N2}</span>
                </div>
                " : "")}
                <div style='display: flex; justify-content: space-between; font-size: 16px; padding-top: 12px; border-top: 1px solid #e5e7eb;'>
                    <span style='color: #111827; font-weight: 700;'>Grand Total:</span>
                    <span style='color: #062621; font-weight: 700; font-size: 18px;'>Rs. {sale.GrandTotal:N2}</span>
                </div>
            </div>

            <!-- Payment Info -->
            <div style='padding: 30px; background-color: #f0fdf4; border-bottom: 1px solid #e5e7eb;'>
                <div style='display: flex; justify-content: space-between; font-size: 13px;'>
                    <div>
                        <p style='margin: 0 0 4px 0; color: #6b7280; font-weight: 600; text-transform: uppercase;'>Payment Method</p>
                        <p style='margin: 0; color: #111827; font-weight: 600;'>{sale.PaymentMethod}</p>
                    </div>
                    <div style='text-align: right;'>
                        <p style='margin: 0 0 4px 0; color: #6b7280; font-weight: 600; text-transform: uppercase;'>Payment Status</p>
                        <p style='margin: 0; color: #059669; font-weight: 700;'>{sale.PaymentStatus}</p>
                    </div>
                </div>
            </div>

            <!-- Footer -->
            <div style='padding: 40px 30px; text-align: center; background-color: #f9fafb; border-top: 1px solid #e5e7eb;'>
                <p style='margin: 0 0 12px 0; font-size: 12px; color: #6b7280;'>Thank you for your business!</p>
                <p style='margin: 0 0 20px 0; font-size: 12px; color: #9ca3af;'>This is a computer-generated invoice. Please keep it for your records.</p>
                <div style='padding-top: 20px; border-top: 1px solid #e5e7eb;'>
                    <p style='margin: 0; font-size: 11px; color: #9ca3af;'>
                        <strong>YAANTRA</strong> • Vehicle & Parts Service<br/>
                        Email: contact@yaantra.com | Phone: +977-1-XXXX-XXXX
                    </p>
                </div>
            </div>
        </div>
    </div>
</body>
</html>";

    // Try to Send and Catch SMTP Errors
    try 
    {
        await _emailSender.SendEmailAsync(targetEmail, $"Yaantra Invoice #{sale.InvoiceNumber}", htmlMessage);
        return Ok(new { message = $"Invoice successfully sent to {targetEmail}" });
    }
    catch (Exception ex)
    {
        
        _logger.LogError(ex, "SMTP failure when sending invoice {Invoice}", sale.InvoiceNumber);
        
        
        return BadRequest(new { 
            message = "Email service failed. Please verify your Gmail App Password and SMTP settings.",
            error = ex.Message 
        });
    }
}
    

    // Delete a sale (for cancellations) - This will also restore stock quantities
    [HttpDelete("{id}")]
    public async Task<IActionResult> CancelSale(int id)
    {
        var sale = await _db.Sales.Include(s => s.SaleItems).FirstOrDefaultAsync(s => s.Id == id);
        if (sale == null) return NotFound();

        foreach (var item in sale.SaleItems)
        {
            var product = await _db.Products.FindAsync(item.ProductId);
            if (product != null) product.StockQty += item.Quantity;
        }

        _db.Sales.Remove(sale);
        await _db.SaveChangesAsync();
        return Ok(new { message = $"Sale {sale.InvoiceNumber} cancelled and stock restored." });
    }

    private static SaleResponseDto MapToResponse(Sale s) => new()
    {
        Id            = s.Id,
        InvoiceNumber = s.InvoiceNumber,
        SaleDate      = s.SaleDate,
        StaffId       = s.StaffId,
        StaffName     = $"{s.Staff.FirstName} {s.Staff.LastName}".Trim(),
        CustomerId    = s.CustomerId,
        CustomerName  = s.Customer != null
            ? $"{s.Customer.FirstName} {s.Customer.LastName}".Trim()
            : s.WalkInCustomerName ?? "Walk-in Customer",
        CustomerPhone = s.Customer?.Phone ?? s.WalkInCustomerPhone,
        Items         = s.SaleItems.Select(si => new SaleItemResponseDto
        {
            ProductId      = si.ProductId,
            ProductName    = si.Product?.Name ?? "Unknown",
            Quantity       = si.Quantity,
            UnitPrice      = si.UnitPrice,
            DiscountPerItem = si.DiscountPerItem,
            TotalPrice     = si.TotalPrice
        }).ToList(),
        SubTotal      = s.SubTotal,
        DiscountAmount = s.DiscountAmount,
        GrandTotal    = s.GrandTotal,
        PaymentMethod = s.PaymentMethod,
        PaymentStatus = s.PaymentStatus,
        Notes         = s.Notes,
        CreatedAt     = s.CreatedAt
    };
}
