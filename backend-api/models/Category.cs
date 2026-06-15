using System.ComponentModel.DataAnnotations;

public class Category
{
    public int Id { get; set; }

    [Required][MaxLength(100)]
    public string Name { get; set; }

    // One Category has many Products (1-to-M)
    public ICollection<Product> Products { get; set; }
}
