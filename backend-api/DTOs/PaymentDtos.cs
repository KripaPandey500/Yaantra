using System.ComponentModel.DataAnnotations;

// Khalti DTOs for payment
namespace backend_api.DTOs
{
    public class KhaltiInitiateDto
    {
        public string ReturnUrl { get; set; }
        public string WebsiteUrl { get; set; }
        public int Amount { get; set; } // in paisa
        public string PurchaseOrderId { get; set; }
        public string PurchaseOrderName { get; set; }
        public string Name { get; set; }
        public string Email { get; set; }
        public string Phone { get; set; }
    }

    public class KhaltiVerifyDto
    {
        [Required]
        public string Pidx { get; set; }
    }

    
    // Request to initiate Khalti payment from cart/checkout
    
    public class CheckoutRequestDto
    {
        [Required]
        public int UserId { get; set; }

        [Required]
        public List<CheckoutItemDto> Items { get; set; } = new();

        public decimal? DiscountAmount { get; set; }

        [MaxLength(500)]
        public string? ShippingAddress { get; set; }

        [Required]
        [MaxLength(100)]
        public string CustomerName { get; set; }

        [Required]
        [EmailAddress]
        [MaxLength(100)]
        public string CustomerEmail { get; set; }

        [Required]
        [Phone]
        [MaxLength(20)]
        public string CustomerPhone { get; set; }

        [Required]
        [Url]
        public string ReturnUrl { get; set; }

        [Required]
        [Url]
        public string WebsiteUrl { get; set; }
    }

    public class CheckoutItemDto
    {
        [Required]
        public int ProductId { get; set; }

        public string? ProductName { get; set; }

        [Required]
        [Range(1, int.MaxValue)]
        public int Quantity { get; set; }

        [Required]
        [Range(0.01, double.MaxValue)]
        public decimal UnitPrice { get; set; }

        [Range(0, double.MaxValue)]
        public decimal? DiscountPerItem { get; set; }
    }

    
    // Response after successful Khalti initiation
    public class CheckoutResponseDto
    {
        public string PaymentUrl { get; set; }
        public string Pidx { get; set; }
        public string PurchaseOrderId { get; set; }
        public int PendingOrderId { get; set; }
    }

    // Response for payment verification
    public class PaymentVerificationResponseDto
    {
        public bool Success { get; set; }
        public string Message { get; set; }
        public string Status { get; set; } // Completed, Pending, Cancelled, etc.
        public int? OrderId { get; set; }
        public string? OrderNumber { get; set; }
        public decimal? Amount { get; set; }
        public string? TransactionId { get; set; }
    }

    // Khalti API response payload
    public class KhaltiApiResponse
    {
        public string pidx { get; set; }
        public string payment_url { get; set; }
        public string status { get; set; }
        public int amount { get; set; }
        public string mobile { get; set; }
        public string transaction_id { get; set; }
        public string purchase_order_id { get; set; }
    }

    // Khalti verification response
    public class KhaltiVerificationResponse
    {
        public string pidx { get; set; }
        public string status { get; set; }
        public int amount { get; set; }
        public string mobile { get; set; }
        public string transaction_id { get; set; }
        public string purchase_order_id { get; set; }
    }
}

