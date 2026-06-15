using System.ComponentModel.DataAnnotations;

namespace WeatherAPI.DTOs;

public class CreateCategoryDto
{
    [Required]
    public string Name { get; set; } = string.Empty;
}

public class UpdateCategoryDto
{
    [Required]
    public string Name { get; set; } = string.Empty;
}

public class CategoryDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
}

public class CategoryWithProductsDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public List<ProductSummaryDto> Products { get; set; } = new();
}
public class CategoryWithCountDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public int ProductCount { get; set; }
}