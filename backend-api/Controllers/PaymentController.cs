using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using backend_api.DTOs;
using System.Text;
using System.Net.Http;
using System.Linq;
using WeatherAPI.Services;
using WeatherAPI.DTOs;
using Microsoft.EntityFrameworkCore;

[ApiController]
[Route("api/[controller]")]
public class PaymentController : ControllerBase
{
    private readonly ExternalServicesOptions _externalServices;
    private readonly IConfiguration _config;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly AppDbContext _db;
    private readonly IKhaltiPaymentService _khaltiService;
    private readonly IPendingOrderService _pendingOrderService;
    private readonly ILogger<PaymentController> _logger;

    public PaymentController(
        IOptions<ExternalServicesOptions> options,
        IConfiguration config,
        IHttpClientFactory httpClientFactory,
        AppDbContext db,
        IKhaltiPaymentService khaltiService,
        IPendingOrderService pendingOrderService,
        ILogger<PaymentController> logger)
    {
        _externalServices = options.Value;
        _config = config;
        _httpClientFactory = httpClientFactory;
        _db = db;
        _khaltiService = khaltiService;
        _pendingOrderService = pendingOrderService;
        _logger = logger;
    }

    // Configuration endpoint for debugging (for development only)
    
    [HttpGet("url")]
    public IActionResult GetPaymentUrl()
    {
        return Ok(new
        {
            MerchantName = _externalServices.MerchantName,
            MerchantId = _externalServices.MerchantId,
            Method = "IOptions",
            PaymentUrl = _externalServices.PaymentApiUrl,
            Timeout = _externalServices.TimeoutSeconds
        });
    }

    // POST: /api/payment/checkout
    // STEP 1: Create in-memory pending order with status "Pending"
    // STEP 2: Initiate Khalti payment and get payment URL
    // STEP 3: Return payment URL and temp order ID to client

    [HttpPost("checkout")]
    public async Task<IActionResult> Checkout([FromBody] CheckoutRequestDto dto)
    {
        try
        {
            // Validate checkout request
            if (dto == null)
                return BadRequest(new { error = "Checkout request is required." });

            if (dto.Items == null || dto.Items.Count == 0)
                return BadRequest(new { error = "Cart must have at least one item." });

            if (dto.UserId <= 0)
                return BadRequest(new { error = "Valid user ID is required." });

            if (string.IsNullOrWhiteSpace(dto.ReturnUrl) || string.IsNullOrWhiteSpace(dto.WebsiteUrl))
                return BadRequest(new { error = "ReturnUrl and WebsiteUrl are required." });

            _logger.LogInformation($"[Checkout] Starting checkout for UserId={dto.UserId}, Items={dto.Items.Count}");

            // Calculate amounts
            var subtotal = dto.Items.Sum(i => i.UnitPrice * i.Quantity);
            var discount = dto.DiscountAmount ?? 0;
            if (discount < 0) discount = 0;
            var grandTotal = subtotal - discount;
            if (grandTotal <= 0)
                return BadRequest(new { error = "Order total must be greater than 0." });

            // Convert to paisa for Khalti (1 Rs = 100 paisa)
            var amountInPaisa = (int)(grandTotal * 100);
            if (amountInPaisa < 1000)  // Khalti minimum is Rs 10 (1000 paisa)
                return BadRequest(new { error = "Order total must be at least Rs. 10." });

            // Verify user exists
            var user = await _db.Users.FindAsync(dto.UserId);
            if (user == null)
                return NotFound(new { error = "User not found." });

            // Generate better purchase order name with merchant and product info
            var merchantName = _config["ExternalServices:MerchantName"] ?? "YAANTRA";
            var productNames = string.Join(", ", dto.Items.Take(2).Select(i => 
            {
                var name = i.ProductName ?? $"Product {i.ProductId}";
                return $"{name} x{i.Quantity}";
            }));
            if (dto.Items.Count > 2)
                productNames += $" + {dto.Items.Count - 2} more";
            
            var purchaseOrderName = $"{merchantName} - {productNames} - {DateTime.UtcNow:yyyy-MM-dd HH:mm}";
            if (purchaseOrderName.Length > 100) // Khalti might have length limit
                purchaseOrderName = purchaseOrderName.Substring(0, 97) + "...";

            // STEP 1: Create in-memory pending order (NOT in database)
            var orderItemsJson = JsonConvert.SerializeObject(dto.Items);
            var tempOrderId = _pendingOrderService.CreatePendingOrder(
                userId: dto.UserId,
                totalAmount: subtotal,
                discountAmount: discount,
                grandTotal: grandTotal,
                shippingAddress: dto.ShippingAddress,
                customerName: dto.CustomerName,
                customerEmail: dto.CustomerEmail,
                customerPhone: dto.CustomerPhone,
                orderItemsJson: orderItemsJson);

            _logger.LogInformation($"[Checkout] Created in-memory pending order: {tempOrderId}");

            // STEP 2: Initiate Khalti payment
            var (success, paymentUrl, pidx, errorMessage) = await _khaltiService.InitiatePaymentAsync(
                purchaseOrderId: tempOrderId,
                purchaseOrderName: purchaseOrderName,
                amountInPaisa: amountInPaisa,
                customerName: dto.CustomerName,
                customerEmail: dto.CustomerEmail,
                customerPhone: dto.CustomerPhone,
                returnUrl: dto.ReturnUrl,
                websiteUrl: dto.WebsiteUrl);

            if (!success)
            {
                _logger.LogError($"[Checkout] Khalti initiation failed: {errorMessage}");
                return BadRequest(new { error = $"Payment initiation failed: {errorMessage}" });
            }

            // Update in-memory pending order with PIDX
            _pendingOrderService.UpdatePendingOrderWithPidx(tempOrderId, pidx);

            _logger.LogInformation($"[Checkout] Payment initiated successfully. PIDX={pidx}, TempOrderId={tempOrderId}");

            return Ok(new CheckoutResponseDto
            {
                PaymentUrl = paymentUrl,
                Pidx = pidx,
                PurchaseOrderId = tempOrderId,  
                PendingOrderId = 0  
            });
        }
        catch (Exception ex)
        {
            _logger.LogError($"[Checkout] Exception: {ex.Message}\n{ex.StackTrace}");
            return StatusCode(500, new { error = "Internal server error during checkout.", details = ex.Message });
        }
    }

    // POST: /api/payment/verify
    // STEP 1: Verify payment with Khalti using PIDX
    // STEP 2: If successful, create permanent order in database and clear cart

    [HttpPost("verify")]
    public async Task<IActionResult> VerifyPayment([FromBody] KhaltiVerifyDto dto)
    {
        try
        {
            if (dto == null || string.IsNullOrWhiteSpace(dto.Pidx))
                return BadRequest(new { error = "PIDX (Payment Index) is required." });

            _logger.LogInformation($"[VerifyPayment] Verifying payment with PIDX={dto.Pidx}");

            // STEP 1: Get pending order from in-memory cache
            var pendingOrder = _pendingOrderService.GetPendingOrderByPidx(dto.Pidx);
            if (pendingOrder == null)
            {
                _logger.LogWarning($"[VerifyPayment] Pending order not found for PIDX={dto.Pidx}");
                return NotFound(new
                {
                    success = false,
                    error = "Payment not found. Please start checkout again."
                });
            }

            // Check if pending order expired
            if (_pendingOrderService.IsPendingOrderExpired(pendingOrder))
            {
                _pendingOrderService.RemovePendingOrder(pendingOrder.TempId);
                _logger.LogWarning($"[VerifyPayment] Pending order expired for PIDX={dto.Pidx}");
                return BadRequest(new
                {
                    success = false,
                    error = "Payment session expired. Please start checkout again."
                });
            }

            // STEP 2: Call Khalti Lookup API to verify payment
            var (success, status, paidAmount, transactionId, errorMessage) = await _khaltiService.VerifyPaymentAsync(dto.Pidx);

            if (!success)
            {
                _logger.LogError($"[VerifyPayment] Khalti verification failed: {errorMessage}");
                return BadRequest(new
                {
                    success = false,
                    error = "Payment verification failed.",
                    details = errorMessage
                });
            }

            _logger.LogInformation($"[VerifyPayment] Khalti lookup successful. Status={status}, Amount={paidAmount}");

            // STEP 3: Check if payment is Completed (ONLY this status means success)
            if (status != "Completed")
            {
                _logger.LogWarning($"[VerifyPayment] Payment status is '{status}', not 'Completed'. Payment rejected.");
                return BadRequest(new
                {
                    success = false,
                    error = $"Payment was not completed. Status: {status}",
                    status = status
                });
            }

            // STEP 4: Verify amount matches
            var expectedAmountInPaisa = (int)(pendingOrder.GrandTotal * 100);
            if (!_khaltiService.VerifyAmount(paidAmount, expectedAmountInPaisa))
            {
                _logger.LogError($"[VerifyPayment] Amount mismatch. Paid: {paidAmount}, Expected: {expectedAmountInPaisa}");
                return BadRequest(new
                {
                    success = false,
                    error = "Payment amount does not match order total.",
                    paidAmount = paidAmount / 100.0,
                    expectedAmount = expectedAmountInPaisa / 100.0
                });
            }

            _logger.LogInformation($"[VerifyPayment] Amount verified. Creating permanent order...");

            // STEP 5: ONLY NOW create permanent order in database
            List<CheckoutItemDto> orderItems = new();
            try
            {
                orderItems = JsonConvert.DeserializeObject<List<CheckoutItemDto>>(pendingOrder.OrderItemsJson) ?? new();
            }
            catch (Exception ex)
            {
                _logger.LogError($"[VerifyPayment] Failed to deserialize order items: {ex.Message}");
                return BadRequest(new { error = "Invalid order data." });
            }

            if (orderItems.Count == 0)
            {
                _logger.LogWarning($"[VerifyPayment] No items in pending order for PIDX={dto.Pidx}");
                return BadRequest(new { error = "Order has no items." });
            }

            // Create permanent order
            var permanentOrder = new Order
            {
                OrderNumber = $"ORD_{DateTime.UtcNow:yyyyMMddHHmmssfff}_{pendingOrder.UserId}",
                OrderDate = DateTime.UtcNow,
                Status = "Confirmed",
                UserId = pendingOrder.UserId,
                TotalAmount = pendingOrder.TotalAmount,
                DiscountAmount = pendingOrder.DiscountAmount,
                GrandTotal = pendingOrder.GrandTotal,
                PaymentStatus = "Paid",
                PaymentMethod = "Khalti",
                ShippingAddress = pendingOrder.ShippingAddress,
                KhaltiPidx = dto.Pidx,
                KhaltiPurchaseOrderId = pendingOrder.TempId,
                KhaltiTransactionId = transactionId,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = null,
                OrderItems = orderItems.Select(i => new OrderItem
                {
                    ProductId = i.ProductId,
                    Quantity = i.Quantity,
                    UnitPrice = i.UnitPrice,
                    TotalPrice = i.UnitPrice * i.Quantity,
                    CreatedAt = DateTime.UtcNow
                }).ToList()
            };

            _db.Orders.Add(permanentOrder);
            await _db.SaveChangesAsync();

            _logger.LogInformation($"[VerifyPayment] Permanent order created. OrderId={permanentOrder.Id}, OrderNumber={permanentOrder.OrderNumber}");

            // STEP 5b: Create Payment record in Payment table
            var payment = new Payment
            {
                UserId = pendingOrder.UserId,
                OrderId = permanentOrder.Id,
                Amount = permanentOrder.GrandTotal,
                PaymentDate = DateTime.UtcNow,
                PaymentMethod = "Khalti",
                Status = "Completed",
                TransactionId = transactionId
            };
            _db.Payments.Add(payment);
            await _db.SaveChangesAsync();

            _logger.LogInformation($"[VerifyPayment] Payment record created. PaymentId={payment.Id}, TransactionId={transactionId}");

            // STEP 6: Clear user's cart
            try
            {
                var cart = await _db.Carts.Include(c => c.CartItems).FirstOrDefaultAsync(c => c.UserId == pendingOrder.UserId);
                if (cart != null)
                {
                    cart.CartItems.Clear();
                    await _db.SaveChangesAsync();
                    _logger.LogInformation($"[VerifyPayment] Cleared cart for UserId={pendingOrder.UserId}");
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning($"[VerifyPayment] Could not clear cart: {ex.Message}");
               
            }

            // STEP 7: Remove from in-memory cache
            _pendingOrderService.RemovePendingOrder(pendingOrder.TempId);

            _logger.LogInformation($"[VerifyPayment] Payment verification completed successfully. Order={permanentOrder.Id}");

            return Ok(new PaymentVerificationResponseDto
            {
                Success = true,
                Message = "Payment verified successfully. Order has been created.",
                Status = "Completed",
                OrderId = permanentOrder.Id,
                OrderNumber = permanentOrder.OrderNumber,
                Amount = permanentOrder.GrandTotal,
                TransactionId = transactionId
            });
        }
        catch (Exception ex)
        {
            _logger.LogError($"[VerifyPayment] Exception: {ex.Message}\n{ex.StackTrace}");
            return StatusCode(500, new
            {
                success = false,
                error = "Internal server error during payment verification.",
                details = ex.Message
            });
        }
    }

    // Additional endpoints for PayLater and CashOnDelivery can be implemented similarly
    // with appropriate logic for order creation and payment status handling.
    [HttpPost("KhaltiInitiate")]
    [Obsolete("Use /api/payment/checkout instead")]
    public async Task<IActionResult> KhaltiInitiate([FromBody] KhaltiInitiateDto dto)
    {
        var client = _httpClientFactory.CreateClient();
        var secretKey = _config["Khalti:SecretKey"];

        var payload = new
        {
            return_url = dto.ReturnUrl,
            website_url = dto.WebsiteUrl,
            amount = dto.Amount,
            purchase_order_id = dto.PurchaseOrderId,
            purchase_order_name = dto.PurchaseOrderName,
            customer_info = new
            {
                name = dto.Name,
                email = dto.Email,
                phone = dto.Phone
            }
        };

        var request = new HttpRequestMessage(HttpMethod.Post, "https://dev.khalti.com/api/v2/epayment/initiate/")
        {
            Content = new StringContent(JsonConvert.SerializeObject(payload), Encoding.UTF8, "application/json")
        };
        request.Headers.Add("Authorization", $"Key {secretKey}");

        var response = await client.SendAsync(request);
        var body = await response.Content.ReadAsStringAsync();

        if (!response.IsSuccessStatusCode)
            return BadRequest(new { error = body });

        var json = JObject.Parse(body);
        return Ok(new { payment_url = json["payment_url"]?.ToString(), pidx = json["pidx"]?.ToString() });
    }

    // This endpoint is for testing Khalti payment verification using the Lookup API
    
    [HttpPost("KhaltiVerify")]
    [Obsolete("Use /api/payment/verify instead")]
    public async Task<IActionResult> KhaltiVerify([FromBody] KhaltiVerifyDto dto)
    {
        try
        {
            var client = _httpClientFactory.CreateClient();
            var secretKey = _config["Khalti:SecretKey"];
            var payload = new { pidx = dto.Pidx };

            var request = new HttpRequestMessage(HttpMethod.Post, "https://dev.khalti.com/api/v2/epayment/lookup/")
            {
                Content = new StringContent(JsonConvert.SerializeObject(payload), Encoding.UTF8, "application/json")
            };
            request.Headers.Add("Authorization", $"Key {secretKey}");

            var response = await client.SendAsync(request);
            var body = await response.Content.ReadAsStringAsync();

            if (!response.IsSuccessStatusCode)
                return BadRequest(new { error = body });

            var json = JObject.Parse(body);
            var status = json["status"]?.ToString();

            return status == "Completed" ? Ok(new { status = "Completed", message = "Payment successful" })
                : BadRequest(new { error = "Payment not completed", status });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { error = ex.Message });
        }
    }
}