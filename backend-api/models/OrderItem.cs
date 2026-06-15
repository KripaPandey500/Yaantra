

using System.ComponentModel.DataAnnotations;

public class OrderItem
{
    public int Id { get; set; }

    // FK to Orders table
    [Required]
    public int OrderId { get; set; }
    public Order Order { get; set; } = null!;

    // FK to Products table
    [Required]
    public int ProductId { get; set; }
    public Product Product { get; set; } = null!;

    [Required]
    public int Quantity { get; set; }

    [Required]
    public decimal UnitPrice { get; set; }

    [Required]
    public decimal TotalPrice { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}


