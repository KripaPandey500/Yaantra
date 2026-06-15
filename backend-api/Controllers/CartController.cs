
	using Microsoft.AspNetCore.Mvc;
	using Microsoft.EntityFrameworkCore;
	using System.Threading.Tasks;
	using System.Linq;
	using System.Collections.Generic;
	using WeatherAPI.DTOs;
	using backend_api.DTOs;

	[ApiController]
	[Route("api/[controller]")]
	public class CartController : ControllerBase
	{
		private readonly AppDbContext _context;
		private readonly ILogger<CartController> _logger;

		public CartController(AppDbContext context, ILogger<CartController> logger)
		{
			_context = context;
			_logger = logger;
		}

		// DELETE cart for a user (clear cart)
		[HttpDelete("{userId}/clear")]
		public async Task<IActionResult> ClearCart(int userId)
		{
			var cart = await _context.Carts.Include(c => c.CartItems).FirstOrDefaultAsync(c => c.UserId == userId);
			if (cart == null)
				return NotFound();
			cart.CartItems.Clear();
			await _context.SaveChangesAsync();
			return NoContent();
		}

	// GET user id for cart retrieval	
	[HttpGet("{userId}")]
	public async Task<ActionResult<CartResponseDto>> GetCart(int userId)
	{
		var cart = await _context.Carts
			.Include(c => c.CartItems)
				.ThenInclude(ci => ci.Product)
			.FirstOrDefaultAsync(c => c.UserId == userId);
		if (cart == null)
			return NotFound();

		var items = cart.CartItems.Select(ci => new CartItemDto
		{
			Id = ci.Id,
			ProductId = ci.ProductId,
			Quantity = ci.Quantity,
			Price = ci.Product != null ? (ci.Product.DiscountPrice ?? ci.Product.Price) : 0,
			ProductName = ci.Product != null ? ci.Product.Name : "Unknown",
			ProductImageUrl = ci.Product != null
				? (_context.Images
					.Where(img => img.EntityType == "product" && img.EntityId == ci.Product.Id)
					.Select(img => "http://localhost:5033" + img.FileUrl)
					.FirstOrDefault() ?? "http://localhost:5033/assets/img/no-image.png")
				: "http://localhost:5033/assets/img/no-image.png"
		}).ToList();

		var total = items.Sum(i => i.Price * i.Quantity);

		// Apply 10% discount if total > 5000
		decimal discountedTotal = total;
		if (total > 5000)
		{
			discountedTotal = total * 0.9m; // 10% discount
		}

		var response = new CartResponseDto
		{
			Items = items,
			TotalAmount = discountedTotal
		};
		return Ok(response);
	}

	// POST add item to cart for a user
	[HttpPost("{userId}/items")]
	public async Task<IActionResult> AddCartItem(int userId, [FromBody] AddCartItemDto dto)
	{
		var cart = await _context.Carts.Include(c => c.CartItems).FirstOrDefaultAsync(c => c.UserId == userId);
		if (cart == null)
		{
			cart = new Cart { UserId = userId, CartItems = new List<CartItem>() };
			_context.Carts.Add(cart);
			await _context.SaveChangesAsync();
		}

		var existingItem = cart.CartItems.FirstOrDefault(ci => ci.ProductId == dto.ProductId);
		if (existingItem != null)
		{
			existingItem.Quantity += dto.Quantity;
		}
		else
		{
			cart.CartItems.Add(new CartItem
			{
				ProductId = dto.ProductId,
				Quantity = dto.Quantity
			});
		}

		await _context.SaveChangesAsync();
		return Ok();
	}

	// PUT update cart item for a user
	[HttpPut("{userId}/items/{itemId}")]
	public async Task<IActionResult> UpdateCartItem(int userId, int itemId, [FromBody] UpdateCartItemDto dto)
	{
		var cart = await _context.Carts.Include(c => c.CartItems).FirstOrDefaultAsync(c => c.UserId == userId);
		if (cart == null)
			return NotFound();

		var item = cart.CartItems.FirstOrDefault(ci => ci.Id == itemId);
		if (item == null)
			return NotFound();

		if (dto.Quantity <= 0)
		{
			cart.CartItems.Remove(item);
		}
		else
		{
			item.Quantity = dto.Quantity;
		}
		await _context.SaveChangesAsync();
		return Ok();
	}

	// DELETE cart item for a user
	[HttpDelete("{userId}/items/{itemId}")]
	public async Task<IActionResult> DeleteCartItem(int userId, int itemId)
	{
		var cart = await _context.Carts.Include(c => c.CartItems).FirstOrDefaultAsync(c => c.UserId == userId);
		if (cart == null)
			return NotFound();

		var item = cart.CartItems.FirstOrDefault(ci => ci.Id == itemId);
		if (item == null)
			return NotFound();

		cart.CartItems.Remove(item);
		await _context.SaveChangesAsync();
		return NoContent();
	}

	
	// POST checkout cart for a user
	// Prepares cart for checkout with Khalti payment
	
	[HttpPost("{userId}/checkout")]
	public async Task<IActionResult> CheckoutCart(int userId, [FromBody] CartCheckoutDto checkoutDto)
	{
		try
		{
			if (checkoutDto == null)
				return BadRequest(new { error = "Checkout data is required." });

			var cart = await _context.Carts
				.Include(c => c.CartItems)
					.ThenInclude(ci => ci.Product)
				.FirstOrDefaultAsync(c => c.UserId == userId);

			if (cart == null || cart.CartItems.Count == 0)
				return BadRequest(new { error = "Cart is empty." });

			var user = await _context.Users.FindAsync(userId);
			if (user == null)
				return NotFound(new { error = "User not found." });

			// Build checkout items from cart
			var checkoutItems = new List<CheckoutItemDto>();
			foreach (var cartItem in cart.CartItems)
			{
				if (cartItem.Product == null)
					continue;

				var price = cartItem.Product.DiscountPrice ?? cartItem.Product.Price;
				checkoutItems.Add(new CheckoutItemDto
				{
					ProductId = cartItem.ProductId,
					ProductName = cartItem.Product.Name,
					Quantity = cartItem.Quantity,
					UnitPrice = price,
					DiscountPerItem = null
				});
			}

			if (checkoutItems.Count == 0)
				return BadRequest(new { error = "No valid items in cart." });

			// Calculate totals
			var subtotal = checkoutItems.Sum(i => i.UnitPrice * i.Quantity);
			decimal discount = 0;
			
			// Apply 10% discount if subtotal > 5000
			if (subtotal > 5000)
				discount = subtotal * 0.1m;

			// Create checkout request
			var checkoutRequest = new CheckoutRequestDto
			{
				UserId = userId,
				Items = checkoutItems,
				DiscountAmount = discount > 0 ? discount : null,
				ShippingAddress = checkoutDto.ShippingAddress,
				CustomerName = $"{user.FirstName} {user.LastName}".Trim(),
				CustomerEmail = user.Email ?? string.Empty,
				CustomerPhone = user.Phone ?? string.Empty,
				ReturnUrl = checkoutDto.ReturnUrl,
				WebsiteUrl = checkoutDto.WebsiteUrl
			};

			_logger.LogInformation($"[Checkout] Cart checkout initiated for UserId={userId}, Items={checkoutItems.Count}");

			return Ok(new
			{
				message = "Checkout prepared successfully",
				checkoutRequest = checkoutRequest,
				summary = new
				{
					itemCount = checkoutItems.Count,
					subtotal = subtotal,
					discount = discount,
					grandTotal = subtotal - discount
				}
			});
		}
		catch (Exception ex)
		{
			_logger.LogError($"[Checkout] Exception: {ex.Message}\n{ex.StackTrace}");
			return StatusCode(500, new { error = "Error preparing checkout." });
		}
	}
}
