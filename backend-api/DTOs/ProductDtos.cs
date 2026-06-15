
using System.ComponentModel.DataAnnotations;

namespace WeatherAPI.DTOs;

public class ImageDto
{
    public int Id { get; set; }
    public string FileUrl { get; set; } = string.Empty;
    public int ProductId { get; set; }
}

public class CreateProductDto
{
    [Required]
    [MaxLength(200)]
    public string Name { get; set; } = string.Empty;

    [Required]
    [MaxLength(100)]
    public string SKU { get; set; } = string.Empty;

    [Required]
    [MaxLength(1000)]
    public string Description { get; set; } = string.Empty;

    [Required]
    [Range(0.01, double.MaxValue)]
    public decimal Price { get; set; }

    [Range(0, double.MaxValue)]
    public decimal? DiscountPrice { get; set; }

    [Range(0, int.MaxValue)]
    public int StockQty { get; set; }

    [Required]
    [Range(1, int.MaxValue)]
    public int CategoryId { get; set; }
}

public class UpdateProductDto
{
    [Required]
    public string Name { get; set; } = string.Empty;

    [Required]
    public string SKU { get; set; } = string.Empty;

    [Required]
    [Range(0.01, double.MaxValue)]
    public decimal Price { get; set; }

    public int StockQty { get; set; }

    [Required]
    public int CategoryId { get; set; }
}

public class ProductDto
{
    public int Id { get; set; }

    public string Name { get; set; } = string.Empty;

    public string SKU { get; set; } = string.Empty;

    public string Description { get; set; } = string.Empty;

    public decimal Price { get; set; }

    public decimal? DiscountPrice { get; set; }

    public int StockQty { get; set; }

    public int CategoryId { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }
}
public class ProductSummaryDto
{
    public int Id { get; set; }

    public string Name { get; set; } = string.Empty;

    public decimal Price { get; set; }

    public int StockQty { get; set; }
}
public class BulkPriceUpdateDto
{
    public int ProductId { get; set; }

    [Range(0.01, double.MaxValue)]
    public decimal NewPrice { get; set; }
}
