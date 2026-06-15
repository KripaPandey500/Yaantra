using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;

public class Purchase
{
   public int PurchaseId { get; set; }

   [Required][MaxLength(450)]
   public string VendorUserId { get; set; } // Identity User Id with role vendor

   [Required]
   public DateTime PurchaseDate { get; set; }

   [Required]
   public decimal TotalAmount { get; set; }

   public ICollection<PurchaseDetail> PurchaseDetails { get; set; }
}