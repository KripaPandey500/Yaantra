
using Microsoft.AspNetCore.Mvc;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using WeatherAPI.DTOs;

[ApiController]
[Route("api/purchases")]
public class PurchaseController : ControllerBase
{
	private readonly AppDbContext _context;
	private const int LowStockThreshold = 10;

	public PurchaseController(AppDbContext context)
	{
		_context = context;
	}

	private static string GetVendorDisplayName(User? vendor)
	{
		if (vendor == null)
		{
			return string.Empty;
		}

		return $"{vendor.FirstName} {vendor.LastName}".Trim();
	}

	private static Dictionary<string, string> BuildVendorNameLookup(IEnumerable<User> users)
	{
		var lookup = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);

		foreach (var user in users)
		{
			var displayName = GetVendorDisplayName(user);

			if (!string.IsNullOrWhiteSpace(user.IdentityUserId) && !lookup.ContainsKey(user.IdentityUserId))
			{
				lookup[user.IdentityUserId] = displayName;
			}

			var localUserId = user.Id.ToString();
			if (!lookup.ContainsKey(localUserId))
			{
				lookup[localUserId] = displayName;
			}
		}

		return lookup;
	}

	private async Task CleanupResolvedLowStockNotificationsAsync(HashSet<int> productIds)
	{
		if (productIds.Count == 0)
		{
			return;
		}

		// Get products that are no longer low stock
		var resolvedProducts = await _context.Products
			.Where(p => productIds.Contains(p.Id) && p.StockQty >= LowStockThreshold)
			.ToListAsync();

		if (!resolvedProducts.Any())
		{
			return;
		}

		// Delete notifications for products that are now back in stock
		foreach (var product in resolvedProducts)
		{
			var messagePattern = $"Low stock alert: {product.Name}";
			var notificationsToDelete = await _context.Notifications
				.Where(n => n.Message.StartsWith(messagePattern) && !n.IsRead)
				.ToListAsync();

			_context.Notifications.RemoveRange(notificationsToDelete);
		}
	}

	private async Task AddLowStockNotificationsForProductsAsync(HashSet<int> productIds)
	{
		if (productIds.Count == 0)
		{
			return;
		}

		var users = await _context.Users
			.Where(u => u.Role != null)
			.ToListAsync();

		var admins = users
			.Where(u => u.Role.Equals("Admin", StringComparison.OrdinalIgnoreCase))
			.ToList();

		var products = await _context.Products
			.Where(p => productIds.Contains(p.Id))
			.ToListAsync();

		var lowStockProducts = products
			.Where(p => p.StockQty < LowStockThreshold)
			.ToList();

		if (!lowStockProducts.Any())
		{
			return;
		}

		foreach (var product in lowStockProducts)
		{
			var message = $"Low stock alert: {product.Name} has only {product.StockQty} units left.";

			if (admins.Count == 0)
			{
				var existsGlobal = await _context.Notifications.AnyAsync(n =>
					n.UserId == null &&
					n.Message == message &&
					!n.IsRead);

				if (!existsGlobal)
				{
					_context.Notifications.Add(new Notification
					{
						Message = message,
						CreatedAt = DateTime.UtcNow,
						IsRead = false,
						UserId = null
					});
				}

				continue;
			}

			foreach (var admin in admins)
			{
				var exists = await _context.Notifications.AnyAsync(n =>
					n.UserId == admin.Id &&
					n.Message == message &&
					!n.IsRead);

				if (exists)
				{
					continue;
				}

				_context.Notifications.Add(new Notification
				{
					Message = message,
					CreatedAt = DateTime.UtcNow,
					IsRead = false,
					UserId = admin.Id
				});
			}
		}
	}


		// 1. Create Purchase
		[HttpPost]
		public async Task<IActionResult> CreatePurchase([FromBody] CreatePurchaseDto dto)
		{
			if (dto == null || dto.PurchaseItems == null || !dto.PurchaseItems.Any())
				return BadRequest("Invalid purchase data.");

			var affectedProductIds = new HashSet<int>();

			var purchase = new Purchase
			{
				VendorUserId = dto.VendorUserId,
				PurchaseDate = dto.PurchaseDate,
				PurchaseDetails = new List<PurchaseDetail>()
			};

			decimal totalAmount = 0;

			foreach (var item in dto.PurchaseItems)
			{
				var product = await _context.Products.FirstOrDefaultAsync(p => p.Id == item.ProductId);
				if (product == null)
					return BadRequest($"Product with ID {item.ProductId} not found.");

				// Update stock
				product.StockQty += item.Quantity;
				affectedProductIds.Add(product.Id);

				var unitPrice = product.Price;
				var subTotal = item.Quantity * unitPrice;
				totalAmount += subTotal;

				purchase.PurchaseDetails.Add(new PurchaseDetail
				{
					ProductId = item.ProductId,
					Quantity = item.Quantity,
					UnitPrice = unitPrice,
					SubTotal = subTotal
				});
			}

			purchase.TotalAmount = totalAmount;
			await CleanupResolvedLowStockNotificationsAsync(affectedProductIds);
			await AddLowStockNotificationsForProductsAsync(affectedProductIds);

			_context.Purchases.Add(purchase);
			await _context.SaveChangesAsync();

			// Fetch products for names
			var products = await _context.Products.ToListAsync();
			var vendor = await _context.Users.FirstOrDefaultAsync(u =>
				u.IdentityUserId == purchase.VendorUserId ||
				u.Id.ToString() == purchase.VendorUserId);

			var result = new PurchaseDto
			{
				PurchaseId = purchase.PurchaseId,
				VendorUserId = purchase.VendorUserId,
				VendorName = GetVendorDisplayName(vendor),
				PurchaseDate = purchase.PurchaseDate,
				TotalAmount = purchase.TotalAmount,
				PurchaseDetails = purchase.PurchaseDetails.Select(d => new PurchaseDetailDto
				{
					PurchaseDetailId = d.PurchaseDetailId,
					ProductId = d.ProductId,
					ProductName = products.FirstOrDefault(prod => prod.Id == d.ProductId)?.Name ?? string.Empty,
					Quantity = d.Quantity,
					UnitPrice = d.UnitPrice,
					SubTotal = d.SubTotal
				}).ToList()
			};

			return Ok(result);
		}

		// 5. Update Purchase (PUT)
		[HttpPut("{id}")]
		public async Task<IActionResult> UpdatePurchase(int id, [FromBody] CreatePurchaseDto dto)
		{
			var purchase = await _context.Purchases
				.Include(p => p.PurchaseDetails)
				.FirstOrDefaultAsync(p => p.PurchaseId == id);

			if (purchase == null)
				return NotFound();

			var affectedProductIds = new HashSet<int>();

			// Rollback old stock
			foreach (var detail in purchase.PurchaseDetails)
			{
				var product = await _context.Products.FirstOrDefaultAsync(p => p.Id == detail.ProductId);
				if (product != null)
				{
					product.StockQty -= detail.Quantity;
					affectedProductIds.Add(product.Id);
				}
			}

			// Remove old details
			_context.PurchaseDetails.RemoveRange(purchase.PurchaseDetails);

			// Add new details
			purchase.PurchaseDetails = new List<PurchaseDetail>();
			decimal totalAmount = 0;
			foreach (var item in dto.PurchaseItems)
			{
				var product = await _context.Products.FirstOrDefaultAsync(p => p.Id == item.ProductId);
				if (product == null)
					return BadRequest($"Product with ID {item.ProductId} not found.");
				product.StockQty += item.Quantity;
				affectedProductIds.Add(product.Id);
				
				var unitPrice = product.Price;
				var subTotal = item.Quantity * unitPrice;
				totalAmount += subTotal;
				
				purchase.PurchaseDetails.Add(new PurchaseDetail
				{
					ProductId = item.ProductId,
					Quantity = item.Quantity,
					UnitPrice = unitPrice,
					SubTotal = subTotal
				});
			}
			purchase.TotalAmount = totalAmount;
			purchase.PurchaseDate = dto.PurchaseDate;
			purchase.VendorUserId = dto.VendorUserId;
			await CleanupResolvedLowStockNotificationsAsync(affectedProductIds);
			await AddLowStockNotificationsForProductsAsync(affectedProductIds);

			await _context.SaveChangesAsync();
			return NoContent();
		}


		// 2. Get All Purchases with Search & Pagination
		[HttpGet]
		public async Task<ActionResult<dynamic>> GetAll([FromQuery] string search = "", [FromQuery] int page = 1, [FromQuery] int pageSize = 10)
		{
			if (page < 1) page = 1;
			if (pageSize < 1) pageSize = 10;

			var purchases = await _context.Purchases
				.Include(p => p.PurchaseDetails)
				.ToListAsync();

			var users = await _context.Users.ToListAsync();
			var products = await _context.Products.ToListAsync();
			var vendorNameLookup = BuildVendorNameLookup(users);

			var purchaseDtos = purchases.Select(p => new PurchaseDto
			{
				PurchaseId = p.PurchaseId,
				VendorUserId = p.VendorUserId,
				VendorName = vendorNameLookup.TryGetValue(p.VendorUserId, out var vendorName) ? vendorName : string.Empty,
				PurchaseDate = p.PurchaseDate,
				TotalAmount = p.TotalAmount,
				PurchaseDetails = p.PurchaseDetails.Select(d => new PurchaseDetailDto
				{
					PurchaseDetailId = d.PurchaseDetailId,
					ProductId = d.ProductId,
					ProductName = products.FirstOrDefault(prod => prod.Id == d.ProductId)?.Name ?? string.Empty,
					Quantity = d.Quantity,
					UnitPrice = d.UnitPrice,
					SubTotal = d.SubTotal
				}).ToList()
			}).ToList();

			// Apply search filter
			if (!string.IsNullOrWhiteSpace(search))
			{
				var searchLower = search.ToLower();
				purchaseDtos = purchaseDtos.Where(p =>
					p.PurchaseId.ToString().Contains(searchLower) ||
					(p.VendorName?.ToLower() ?? "").Contains(searchLower) ||
					p.PurchaseDate.ToString("dd-MMM-yyyy").ToLower().Contains(searchLower) ||
					(p.PurchaseDetails?.Any(d => (d.ProductName?.ToLower() ?? "").Contains(searchLower)) ?? false) ||
					p.TotalAmount.ToString().Contains(searchLower)
				).ToList();
			}

			// Apply pagination
			var totalItems = purchaseDtos.Count;
			var totalPages = (int)Math.Ceiling(totalItems / (double)pageSize);
			var paginatedData = purchaseDtos.Skip((page - 1) * pageSize).Take(pageSize).ToList();

			return Ok(new
			{
				data = paginatedData,
				pagination = new
				{
					currentPage = page,
					pageSize = pageSize,
					totalItems = totalItems,
					totalPages = totalPages
				}
			});
		}


		// 3. Get Purchase by ID
		[HttpGet("{id}")]
		public async Task<ActionResult<PurchaseDto>> GetById(int id)
		{
			var purchase = await _context.Purchases
				.Include(p => p.PurchaseDetails)
				.FirstOrDefaultAsync(p => p.PurchaseId == id);

			if (purchase == null)
				return NotFound();

			var vendor = await _context.Users.FirstOrDefaultAsync(u =>
				u.IdentityUserId == purchase.VendorUserId ||
				u.Id.ToString() == purchase.VendorUserId);
			var products = await _context.Products.ToListAsync();

			var dto = new PurchaseDto
			{
				PurchaseId = purchase.PurchaseId,
				VendorUserId = purchase.VendorUserId,
				VendorName = GetVendorDisplayName(vendor),
				PurchaseDate = purchase.PurchaseDate,
				TotalAmount = purchase.TotalAmount,
				PurchaseDetails = purchase.PurchaseDetails.Select(d => new PurchaseDetailDto
				{
					PurchaseDetailId = d.PurchaseDetailId,
					ProductId = d.ProductId,
					ProductName = products.FirstOrDefault(prod => prod.Id == d.ProductId)?.Name ?? string.Empty,
					Quantity = d.Quantity,
					UnitPrice = d.UnitPrice,
					SubTotal = d.SubTotal
				}).ToList()
			};

			return Ok(dto);
		}


		// 4. Get Purchases by Vendor
		[HttpGet("vendor/{vendorUserId}")]
		public async Task<ActionResult<IEnumerable<PurchaseDto>>> GetByVendor(string vendorUserId)
		{
			var purchases = await _context.Purchases
				.Where(p => p.VendorUserId == vendorUserId)
				.Include(p => p.PurchaseDetails)
				.ToListAsync();

			var vendor = await _context.Users.FirstOrDefaultAsync(u =>
				u.IdentityUserId == vendorUserId ||
				u.Id.ToString() == vendorUserId);
			var products = await _context.Products.ToListAsync();

			var result = purchases.Select(p => new PurchaseDto
			{
				PurchaseId = p.PurchaseId,
				VendorUserId = p.VendorUserId,
				VendorName = GetVendorDisplayName(vendor),
				PurchaseDate = p.PurchaseDate,
				TotalAmount = p.TotalAmount,
				PurchaseDetails = p.PurchaseDetails.Select(d => new PurchaseDetailDto
				{
					PurchaseDetailId = d.PurchaseDetailId,
					ProductId = d.ProductId,
					ProductName = products.FirstOrDefault(prod => prod.Id == d.ProductId)?.Name ?? string.Empty,
					Quantity = d.Quantity,
					UnitPrice = d.UnitPrice,
					SubTotal = d.SubTotal
				}).ToList()
			}).ToList();

			return Ok(result);
		}


		// 6. Delete Purchase (Admin only)
		[HttpDelete("{id}")]
		public async Task<IActionResult> Delete(int id)
		{
			var purchase = await _context.Purchases
				.Include(p => p.PurchaseDetails)
				.FirstOrDefaultAsync(p => p.PurchaseId == id);

			if (purchase == null)
				return NotFound();

			var affectedProductIds = new HashSet<int>();

			// Rollback stock
			foreach (var detail in purchase.PurchaseDetails)
			{
				var product = await _context.Products.FirstOrDefaultAsync(p => p.Id == detail.ProductId);
				if (product != null)
				{
					product.StockQty -= detail.Quantity;
					affectedProductIds.Add(product.Id);
				}
			}

			_context.Purchases.Remove(purchase);
		await CleanupResolvedLowStockNotificationsAsync(affectedProductIds);
			await _context.SaveChangesAsync();

			return NoContent();
		}
}
