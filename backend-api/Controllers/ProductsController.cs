using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using WeatherAPI.DTOs;

[Authorize]
[ApiController]
[Route("api/[controller]")]
public class ProductsController : ControllerBase
{
    private bool IsUniqueSkuViolation(DbUpdateException ex)
    {
        var message = ex.InnerException?.Message ?? ex.Message;
        return message.Contains("IX_Products_SKU", StringComparison.OrdinalIgnoreCase)
            || message.Contains("duplicate key", StringComparison.OrdinalIgnoreCase)
            || message.Contains("sku", StringComparison.OrdinalIgnoreCase);
    }

    private async Task<bool> IsSkuTakenAsync(string sku, int? excludeProductId = null)
    {
        var normalizedSku = sku.Trim().ToLower();
        return await _context.Products.AnyAsync(p =>
            (excludeProductId == null || p.Id != excludeProductId.Value)
            && (p.SKU ?? string.Empty).ToLower() == normalizedSku);
    }

    private IActionResult? ValidateProductDto(CreateProductDto dto)
    {
        if (!ModelState.IsValid)
        {
            var firstError = ModelState
                .Where(x => x.Value?.Errors.Count > 0)
                .Select(x => new
                {
                    field = char.ToLowerInvariant((x.Key.Split('.').LastOrDefault() ?? x.Key)[0])
                        + (x.Key.Split('.').LastOrDefault() ?? x.Key).Substring(1),
                    error = x.Value!.Errors[0].ErrorMessage
                })
                .FirstOrDefault();

            return BadRequest(firstError ?? new { field = "", error = "Invalid product data." });
        }

        if (dto.DiscountPrice.HasValue && dto.DiscountPrice.Value > dto.Price)
            return BadRequest(new { field = "discountPrice", error = "Discount price cannot be greater than price." });

        if (string.IsNullOrWhiteSpace(dto.Name))
            return BadRequest(new { field = "name", error = "Name is required." });

        if (string.IsNullOrWhiteSpace(dto.Description))
            return BadRequest(new { field = "description", error = "Description is required." });

        return null;
    }

    
    // DELETE PRODUCT IMAGE
   
    [HttpPost("/api/images/delete")]
    public async Task<IActionResult> DeleteImage([FromBody] ImageDto dto)
    {
        // Log received data
        Console.WriteLine($"DeleteImage called with ProductId={dto.ProductId}, FileUrl={dto.FileUrl}");

        var image = await _context.Images.FirstOrDefaultAsync(i => i.EntityType == "product" && i.EntityId == dto.ProductId && i.FileUrl == dto.FileUrl);
        if (image == null)
        {
            // Log not found
            Console.WriteLine($"Image not found in DB for ProductId={dto.ProductId}, FileUrl={dto.FileUrl}");
            return NotFound(new { message = $"Image not found for ProductId={dto.ProductId}, FileUrl={dto.FileUrl}" });
        }

        _context.Images.Remove(image);
        await _context.SaveChangesAsync();

        // Try to delete the file from disk
        try
        {
            var filePath = Path.Combine(Directory.GetCurrentDirectory(), image.FileUrl.TrimStart('/').Replace('/', Path.DirectorySeparatorChar));
            if (System.IO.File.Exists(filePath))
                System.IO.File.Delete(filePath);
        }
        catch (Exception ex)
        {
            Console.WriteLine("File delete error: " + ex.Message);
        }

        return Ok(new { message = "Image deleted successfully!" });
    }
    private readonly AppDbContext _context;

    public ProductsController(AppDbContext context)
    {
        _context = context;
    }


   
    // CREATE PRODUCT
    
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateProductDto dto)
    {
        var validationError = ValidateProductDto(dto);
        if (validationError != null)
            return validationError;

        var trimmedSku = (dto.SKU ?? string.Empty).Trim();
        if (string.IsNullOrWhiteSpace(trimmedSku))
            return BadRequest(new { error = "SKU is required.", field = "sku" });

        if (await IsSkuTakenAsync(trimmedSku))
            return BadRequest(new { error = "SKU already exists. Please use a different SKU.", field = "sku" });

        var category = await _context.Categories.FindAsync(dto.CategoryId);
        if (category == null)
            return BadRequest(new { error = "Invalid CategoryId" });

        var product = new Product
        {
            Name = dto.Name,
            SKU = trimmedSku,
            Description = dto.Description,
            Price = dto.Price,
            DiscountPrice = dto.DiscountPrice,
            StockQty = dto.StockQty,
            CategoryId = dto.CategoryId,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = null
        };

        _context.Products.Add(product);
        try
        {
            await _context.SaveChangesAsync();
        }
        catch (DbUpdateException ex) when (IsUniqueSkuViolation(ex))
        {
            return BadRequest(new { error = "SKU already exists. Please use a different SKU.", field = "sku" });
        }

        return Ok(new {
            message = "Product added successfully!",
            id = product.Id
        });
    }
    
        // ADD PRODUCT IMAGES


        [HttpPost("{productId:int}/images")]
        [Consumes("multipart/form-data")]
        public async Task<IActionResult> AddProductImages(
            int productId,
            [FromForm] IFormFile[] files)

{
    // 1. Validate product
    var product = await _context.Products.FindAsync(productId);

    if (product == null)
        return BadRequest(new { message = "Invalid productId. Product does not exist." });

    // 2. Validate files
    if (files == null || files.Length == 0)
        return BadRequest(new { message = "No image files uploaded. Use 'files' in form-data." });

    // 3. Upload folder (now in backend assets)
    var uploadPath = Path.Combine(Directory.GetCurrentDirectory(), "assets", "uploads", "products");

    if (!Directory.Exists(uploadPath))
        Directory.CreateDirectory(uploadPath);

    var imageDtos = new List<ImageDto>();

    foreach (var file in files)
    {
        // 4. Safe file name
        var fileName = $"{Guid.NewGuid()}{Path.GetExtension(file.FileName)}";
        var filePath = Path.Combine(uploadPath, fileName);

        // 5. Save file
        using (var stream = new FileStream(filePath, FileMode.Create))
        {
            await file.CopyToAsync(stream);
        }

        var fileUrl = $"/assets/uploads/products/{fileName}";

        // 6. Create image entity
        var image = new Images
        {
            FileUrl = fileUrl,
            EntityId = productId,
            EntityType = "product"
        };

        _context.Images.Add(image);

       
        imageDtos.Add(new ImageDto
        {
            Id = image.Id, 
            FileUrl = fileUrl,
            ProductId = productId
        });
    }

    // 7. Save ONCE (IMPORTANT FIX)
    await _context.SaveChangesAsync();

    // 8. Fix IDs after save (EF generates IDs here)
    for (int i = 0; i < imageDtos.Count; i++)
    {
        imageDtos[i].Id = _context.Images
            .Where(x => x.FileUrl == imageDtos[i].FileUrl)
            .Select(x => x.Id)
            .FirstOrDefault();
    }

    return Ok(new
    {
        message = "Images uploaded successfully",
        images = imageDtos
    });
}

    
    // GET ALL PRODUCTS (CLEAN)
    
    [HttpGet]
    public async Task<IActionResult> GetAll(
        int page = 1,
        int pageSize = 5,
        string? search = null)
    {
        if (page < 1) page = 1;

        var query = _context.Products.AsQueryable();

        if (!string.IsNullOrWhiteSpace(search))
        {
            var lowered = search.ToLower();
            query = query.Where(p =>
                p.Name.ToLower().Contains(lowered) ||
                p.SKU.ToLower().Contains(lowered) ||
                _context.Categories
                    .Where(c => c.Id == p.CategoryId)
                    .Select(c => c.Name)
                    .FirstOrDefault()!
                    .ToLower()
                    .Contains(lowered));
        }

        var totalRecords = await query.CountAsync();

        var products = await query
            .OrderByDescending(p => p.UpdatedAt ?? p.CreatedAt)
            .ThenByDescending(p => p.Id)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(p => new
            {
                p.Id,
                p.Name,
                p.SKU,
                p.Description,
                p.Price,
                p.DiscountPrice,
                p.StockQty,
                p.CategoryId,
                p.CreatedAt,
                p.UpdatedAt,
                CategoryName = _context.Categories
                    .Where(c => c.Id == p.CategoryId)
                    .Select(c => c.Name)
                    .FirstOrDefault(),
                Images = _context.Images
                    .Where(i => i.EntityType == "product" && i.EntityId == p.Id)
                    .Select(i => i.FileUrl)
                    .ToList()
            })
            .ToListAsync();

        return Ok(new
        {
            page,
            pageSize,
            totalRecords,
            totalPages = (int)Math.Ceiling((double)totalRecords / pageSize),
            data = products
        });
    }

   
    // GET BY ID
    
    [HttpGet("{id}")]
    public async Task<IActionResult> GetById(int id)
    {
        var product = await _context.Products
            .Where(p => p.Id == id)
            .Select(p => new
            {
                p.Id,
                p.Name,
                p.SKU,
                p.Description,
                p.Price,
                p.DiscountPrice,
                p.StockQty,
                p.CategoryId,
                p.CreatedAt,
                p.UpdatedAt,
                CategoryName = _context.Categories
                    .Where(c => c.Id == p.CategoryId)
                    .Select(c => c.Name)
                    .FirstOrDefault(),
                Images = _context.Images
                    .Where(i => i.EntityType == "product" && i.EntityId == p.Id)
                    .Select(i => i.FileUrl)
                    .ToList()
            })
            .FirstOrDefaultAsync();
        if (product == null)
            return NotFound();
        return Ok(product);
    }

    
    // DELETE PRODUCT
  
    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(int id)
    {
        var product = await _context.Products.FindAsync(id);

        if (product == null)
            return NotFound();

        _context.Products.Remove(product);
        await _context.SaveChangesAsync();

        return Ok(new { message = "Product deleted successfully!" });
    }

    
    // UPDATE PRODUCT
    
    [HttpPut("{id}")]
    public async Task<IActionResult> Update(int id, [FromBody] CreateProductDto dto)
    {
        var validationError = ValidateProductDto(dto);
        if (validationError != null)
            return validationError;

        var product = await _context.Products.FindAsync(id);
        if (product == null)
            return NotFound();

        var trimmedSku = (dto.SKU ?? string.Empty).Trim();
        if (string.IsNullOrWhiteSpace(trimmedSku))
            return BadRequest(new { error = "SKU is required.", field = "sku" });

        if (await IsSkuTakenAsync(trimmedSku, id))
            return BadRequest(new { error = "SKU already exists. Please use a different SKU.", field = "sku" });

        product.Name = dto.Name;
        product.SKU = trimmedSku;
        product.Description = dto.Description;
        product.Price = dto.Price;
        product.DiscountPrice = dto.DiscountPrice;
        product.StockQty = dto.StockQty;
        product.CategoryId = dto.CategoryId;
        product.UpdatedAt = DateTime.UtcNow;

        try
        {
            await _context.SaveChangesAsync();
        }
        catch (DbUpdateException ex) when (IsUniqueSkuViolation(ex))
        {
            return BadRequest(new { error = "SKU already exists. Please use a different SKU.", field = "sku" });
        }

        return Ok(new { message = "Product updated successfully!" });
    }

    // GET VENDORS
    
    [HttpGet("vendors")]
    public async Task<IActionResult> GetVendors()
    {
        var vendors = await _context.Users
            .Where(u => u.Role != null)
            .ToListAsync();

        var vendorList = vendors
            .Where(u => u.Role.Equals("Vendor", StringComparison.OrdinalIgnoreCase))
            .Select(u => new
            {
                id = u.IdentityUserId ?? u.Id.ToString(),
                name = (u.FirstName ?? "") + " " + (u.LastName ?? "")
            })
            .ToList();

        return Ok(vendorList);
    }

   
    // GET ALL PRODUCTS (FOR DROPDOWNS)
    
    [HttpGet("all-for-purchase")]
    public async Task<IActionResult> GetAllForPurchase()
    {
        var products = await _context.Products
            .Select(p => new
            {
                id = p.Id,
                p.Name,
                p.Price,
                p.StockQty
            })
            .OrderBy(p => p.Name)
            .ToListAsync();

        return Ok(products);
    }
}