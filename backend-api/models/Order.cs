
using System.ComponentModel.DataAnnotations;

public class Order
{
   public int Id { get; set; }

   [Required][MaxLength(30)]
   public string OrderNumber { get; set; } = string.Empty;

   [Required]
   public DateTime OrderDate { get; set; }

   [Required][MaxLength(50)]
   public string Status { get; set; } = "Pending";  

   [Required]
   public decimal TotalAmount { get; set; }

   public decimal? DiscountAmount { get; set; }

   [Required]
   public decimal GrandTotal { get; set; }

   [Required][MaxLength(20)]
   public string PaymentStatus { get; set; } = "Unpaid"; 

   [MaxLength(50)]
   public string? PaymentMethod { get; set; } 

   [MaxLength(500)]
   public string? ShippingAddress { get; set; }

   // Khalti Payment Reference Information
   [MaxLength(100)]
   public string? KhaltiPidx { get; set; } // Khalti Payment Index ID (transaction reference)

   [MaxLength(50)]
   public string? KhaltiPurchaseOrderId { get; set; }

   [MaxLength(50)]
   public string? KhaltiTransactionId { get; set; }

   public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

   public DateTime? UpdatedAt { get; set; }

   // Many Orders belong to one User (M-to-1)
   [Required]
   public int UserId { get; set; }
   public User User { get; set; } = null!;

   // One Order has many OrderItems (1-to-M)
   public ICollection<OrderItem> OrderItems { get; set; } = new List<OrderItem>();
}
