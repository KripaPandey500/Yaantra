using System.ComponentModel.DataAnnotations;

public class CartItem
{
    public int Id { get; set; }

    [Required]
    public int CartId { get; set; }
    public Cart Cart { get; set; }

    [Required]
    public int ProductId { get; set; }
    public Product Product { get; set; }

    [Required]
    public int Quantity { get; set; }

    
}