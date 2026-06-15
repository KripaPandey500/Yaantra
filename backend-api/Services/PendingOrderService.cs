using Microsoft.Extensions.Caching.Distributed;

namespace WeatherAPI.Services;

public class PendingOrderData
{
    public string TempId { get; set; }
    public int UserId { get; set; }
    public decimal TotalAmount { get; set; }
    public decimal DiscountAmount { get; set; }
    public decimal GrandTotal { get; set; }
    public string ShippingAddress { get; set; }
    public string CustomerName { get; set; }
    public string CustomerEmail { get; set; }
    public string CustomerPhone { get; set; }
    public string OrderItemsJson { get; set; }
    public string Pidx { get; set; }
    public DateTime CreatedAt { get; set; }
}

public interface IPendingOrderService
{
    string CreatePendingOrder(int userId, decimal totalAmount, decimal discountAmount, decimal grandTotal,
        string shippingAddress, string customerName, string customerEmail, string customerPhone, string orderItemsJson);
    
    PendingOrderData GetPendingOrder(string tempId);
    
    PendingOrderData GetPendingOrderByPidx(string pidx);
    
    void UpdatePendingOrderWithPidx(string tempId, string pidx);
    
    bool IsPendingOrderExpired(PendingOrderData pendingOrder);
    
    void RemovePendingOrder(string tempId);
}

public class PendingOrderService : IPendingOrderService
{
    private readonly IDistributedCache _cache;
    private readonly ILogger<PendingOrderService> _logger;
    private const int EXPIRATION_MINUTES = 30;

    public PendingOrderService(IDistributedCache cache, ILogger<PendingOrderService> logger)
    {
        _cache = cache;
        _logger = logger;
    }

    public string CreatePendingOrder(int userId, decimal totalAmount, decimal discountAmount, decimal grandTotal,
        string shippingAddress, string customerName, string customerEmail, string customerPhone, string orderItemsJson)
    {
        var tempId = Guid.NewGuid().ToString();
        
        var pendingOrder = new PendingOrderData
        {
            TempId = tempId,
            UserId = userId,
            TotalAmount = totalAmount,
            DiscountAmount = discountAmount,
            GrandTotal = grandTotal,
            ShippingAddress = shippingAddress,
            CustomerName = customerName,
            CustomerEmail = customerEmail,
            CustomerPhone = customerPhone,
            OrderItemsJson = orderItemsJson,
            CreatedAt = DateTime.UtcNow
        };

        var json = System.Text.Json.JsonSerializer.Serialize(pendingOrder);
        var cacheOptions = new DistributedCacheEntryOptions
        {
            AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(EXPIRATION_MINUTES)
        };

        _cache.SetString($"pending_order_{tempId}", json, cacheOptions);
        _logger.LogInformation($"[PendingOrderService] Created pending order: {tempId}");
        
        return tempId;
    }

    public PendingOrderData GetPendingOrder(string tempId)
    {
        var json = _cache.GetString($"pending_order_{tempId}");
        if (json == null)
            return null;

        return System.Text.Json.JsonSerializer.Deserialize<PendingOrderData>(json);
    }

    public PendingOrderData GetPendingOrderByPidx(string pidx)
    {
        var tempId = _cache.GetString($"pidx_{pidx}");
        if (tempId == null)
            return null;

        return GetPendingOrder(tempId);
    }

    public void UpdatePendingOrderWithPidx(string tempId, string pidx)
    {
        var pendingOrder = GetPendingOrder(tempId);
        if (pendingOrder == null)
        {
            _logger.LogWarning($"[PendingOrderService] Cannot update PIDX - pending order not found: {tempId}");
            return;
        }

        pendingOrder.Pidx = pidx;
        var json = System.Text.Json.JsonSerializer.Serialize(pendingOrder);
        var cacheOptions = new DistributedCacheEntryOptions
        {
            AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(EXPIRATION_MINUTES)
        };

        _cache.SetString($"pending_order_{tempId}", json, cacheOptions);
        _cache.SetString($"pidx_{pidx}", tempId, cacheOptions);
        _logger.LogInformation($"[PendingOrderService] Updated pending order with PIDX: {pidx}");
    }

    public bool IsPendingOrderExpired(PendingOrderData pendingOrder)
    {
        if (pendingOrder == null)
            return true;

        var age = DateTime.UtcNow - pendingOrder.CreatedAt;
        return age.TotalMinutes > EXPIRATION_MINUTES;
    }

    public void RemovePendingOrder(string tempId)
    {
        var pendingOrder = GetPendingOrder(tempId);
        if (pendingOrder != null && !string.IsNullOrEmpty(pendingOrder.Pidx))
        {
            _cache.Remove($"pidx_{pendingOrder.Pidx}");
        }

        _cache.Remove($"pending_order_{tempId}");
        _logger.LogInformation($"[PendingOrderService] Removed pending order: {tempId}");
    }
}
