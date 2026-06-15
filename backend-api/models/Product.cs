using System.ComponentModel.DataAnnotations;

public class Product
{
    public int Id { get; set; }

    [Required][MaxLength(200)]
    public string Name { get; set; }

    [Required][MaxLength(100)]
    public string SKU { get; set; }

    [Required][MaxLength(1000)]
    public string Description { get; set; }

    [Required]
    public decimal Price { get; set; }

    public decimal? DiscountPrice { get; set; }

    [Required]
    public int StockQty { get; set; }

    [Required]
    public int CategoryId { get; set; }


    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }
}
