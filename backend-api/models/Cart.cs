using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;

public class Cart
{
    public int Id { get; set; }

    [Required]
    public int UserId { get; set; }
    public User User { get; set; }

    public ICollection<CartItem> CartItems { get; set; }
}