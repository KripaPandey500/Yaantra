namespace WeatherAPI.DTOs
{
    public class AddCartItemDto
    {
        public int ProductId { get; set; }
        public int Quantity { get; set; }
        // Removed Price field
    }

    public class UpdateCartItemDto
    {
        public int Quantity { get; set; }
        // Removed Price field
    }

    public class CartItemDto
    {
        public int Id { get; set; }
        public int ProductId { get; set; }
        public int Quantity { get; set; }
        public decimal Price { get; set; } 
        public string? ProductName { get; set; }
        public string? ProductImageUrl { get; set; } 
    }

    public class CartResponseDto
    {
        public List<CartItemDto>? Items { get; set; }
        public decimal TotalAmount { get; set; }
    }

    
    // DTO for preparing cart checkout with Khalti payment
   
    public class CartCheckoutDto
    {
        public string? ShippingAddress { get; set; }

        public string ReturnUrl { get; set; } = string.Empty;

        public string WebsiteUrl { get; set; } = string.Empty;
    }
}
