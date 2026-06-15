using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

public class Sale
{
    public int Id { get; set; }

    [Required][MaxLength(30)]
    public string InvoiceNumber { get; set; } = string.Empty;

    [Required]
    public DateTime SaleDate { get; set; } = DateTime.UtcNow;

    // Staff member who made the sale
    [Required]
    public int StaffId { get; set; }
    public User Staff { get; set; } = null!;

    // Customer who bought (can be null for walk-in)
    public int? CustomerId { get; set; }
    public User? Customer { get; set; }

    // Customer name for walk-in (when no account)
    [MaxLength(100)]
    public string? WalkInCustomerName { get; set; }

    [MaxLength(20)]
    public string? WalkInCustomerPhone { get; set; }

    [Required]
    [Column(TypeName = "decimal(18,2)")]
    public decimal SubTotal { get; set; }

    [Column(TypeName = "decimal(18,2)")]
    public decimal DiscountAmount { get; set; } = 0;

    [Required]
    [Column(TypeName = "decimal(18,2)")]
    public decimal GrandTotal { get; set; }

    [Required][MaxLength(50)]
    public string PaymentMethod { get; set; } = "Cash"; // Cash, Card, Khalti, Credit

    [Required][MaxLength(30)]
    public string PaymentStatus { get; set; } = "Paid"; // Paid, Pending, Credit

    [MaxLength(500)]
    public string? Notes { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // Navigation
    public ICollection<SaleItem> SaleItems { get; set; } = new List<SaleItem>();
}

public class SaleItem
{
    public int Id { get; set; }

    [Required]
    public int SaleId { get; set; }
    public Sale Sale { get; set; } = null!;

    [Required]
    public int ProductId { get; set; }
    public Product Product { get; set; } = null!;

    [Required]
    public int Quantity { get; set; }

    [Required]
    [Column(TypeName = "decimal(18,2)")]
    public decimal UnitPrice { get; set; }

    [Column(TypeName = "decimal(18,2)")]
    public decimal DiscountPerItem { get; set; } = 0;

    [Required]
    [Column(TypeName = "decimal(18,2)")]
    public decimal TotalPrice { get; set; }
}