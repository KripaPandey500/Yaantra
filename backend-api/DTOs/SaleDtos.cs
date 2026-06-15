using System.ComponentModel.DataAnnotations;

namespace WeatherAPI.DTOs
{
    // ── Request: Create a new sale invoice ──────────────────────
    public class CreateSaleDto
    {
        [Required]
        public int StaffId { get; set; }

        // Registered customer (optional — null for walk-in)
        public int? CustomerId { get; set; }

        // Walk-in customer info (used when CustomerId is null)
        [MaxLength(100)]
        public string? WalkInCustomerName { get; set; }

        [MaxLength(20)]
        public string? WalkInCustomerPhone { get; set; }

        [Required]
        public List<SaleItemRequestDto> Items { get; set; } = new();

        public decimal DiscountAmount { get; set; } = 0;

        [Required][MaxLength(50)]
        public string PaymentMethod { get; set; } = "Cash";

        [Required][MaxLength(30)]
        public string PaymentStatus { get; set; } = "Paid";

        [MaxLength(500)]
        public string? Notes { get; set; }
    }

    public class SaleItemRequestDto
    {
        [Required]
        public int ProductId { get; set; }

        [Required][Range(1, int.MaxValue)]
        public int Quantity { get; set; }

        [Required][Range(0.01, double.MaxValue)]
        public decimal UnitPrice { get; set; }

        public decimal DiscountPerItem { get; set; } = 0;
    }

    // ── Response: Full sale invoice details ─────────────────────
    public class SaleResponseDto
    {
        public int Id { get; set; }
        public string InvoiceNumber { get; set; } = string.Empty;
        public DateTime SaleDate { get; set; }

        public int StaffId { get; set; }
        public string StaffName { get; set; } = string.Empty;

        public int? CustomerId { get; set; }
        public string? CustomerName { get; set; }
        public string? CustomerPhone { get; set; }

        public List<SaleItemResponseDto> Items { get; set; } = new();

        public decimal SubTotal { get; set; }
        public decimal DiscountAmount { get; set; }
        public decimal GrandTotal { get; set; }

        public string PaymentMethod { get; set; } = string.Empty;
        public string PaymentStatus { get; set; } = string.Empty;
        public string? Notes { get; set; }
        public DateTime CreatedAt { get; set; }
    }

    public class SaleItemResponseDto
    {
        public int ProductId { get; set; }
        public string ProductName { get; set; } = string.Empty;
        public int Quantity { get; set; }
        public decimal UnitPrice { get; set; }
        public decimal DiscountPerItem { get; set; }
        public decimal TotalPrice { get; set; }
    }

    // ── Response: Summary list for dashboard ────────────────────
    public class SaleSummaryDto
    {
        public int Id { get; set; }
        public string InvoiceNumber { get; set; } = string.Empty;
        public DateTime SaleDate { get; set; }
        public string CustomerName { get; set; } = string.Empty;
        public int ItemCount { get; set; }
        public decimal GrandTotal { get; set; }
        public string PaymentMethod { get; set; } = string.Empty;
        public string PaymentStatus { get; set; } = string.Empty;
        public string StaffName { get; set; } = string.Empty;
    }
}