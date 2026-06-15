using System.ComponentModel.DataAnnotations;

public class PurchaseDetail
{
    public int PurchaseDetailId { get; set; }

    [Required]
    public int PurchaseId { get; set; }
    public Purchase Purchase { get; set; }

    [Required]
    public int ProductId { get; set; }
    public Product Product { get; set; }

    [Required]
    public int Quantity { get; set; }

    [Required]
    public decimal UnitPrice { get; set; }

    [Required]
    public decimal SubTotal { get; set; }
}
