using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WeatherAPI.DTOs;

[ApiController]
[Route("api/[controller]")]
public class CategoriesController : ControllerBase
{
    private readonly AppDbContext _context;

    public CategoriesController(AppDbContext context)
    {
        _context = context;
    }
    [HttpGet]
    public async Task<IActionResult> GetAll(
        int page = 1,
        int pageSize = 6,
        string? search = null)
    {
        // Prevent invalid page
        if (page < 1) page = 1;

        var query = _context.Categories.AsQueryable();

        // SEARCH (case-insensitive)
        if (!string.IsNullOrEmpty(search))
        {
            var lowered = search.ToLower();
            query = query.Where(c => c.Name.ToLower().Contains(lowered));
        }

        // Total records before pagination
        var totalRecords = await query.CountAsync();

        // pagination + projection with product count
        var categories = await query
            .OrderBy(c => c.Id)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(c => new CategoryWithCountDto
            {
                Id = c.Id,
                Name = c.Name,
                ProductCount = _context.Products.Count(p => p.CategoryId == c.Id)
            })
            .ToListAsync();

        // response with pagination metadata
        return Ok(new
        {
            page,
            pageSize,
            totalRecords,
            totalPages = (int)Math.Ceiling((double)totalRecords / pageSize),
            data = categories
        });
    }

    // Get category by id with product count
    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetById(int id)
    {
        var category = await _context.Categories
            .Where(c => c.Id == id)
            .Select(c => new CategoryWithCountDto
            {
                Id = c.Id,
                Name = c.Name,
                ProductCount = _context.Products.Count(p => p.CategoryId == c.Id)
            })
            .FirstOrDefaultAsync();

        if (category == null) return NotFound();

        return Ok(category);
    }

    // Create new category
    [HttpPost]
    public async Task<IActionResult> Create(CreateCategoryDto dto)
    {
        if (!ModelState.IsValid) return BadRequest(ModelState);

        var category = new Category
        {
            Name = dto.Name
        };

        _context.Categories.Add(category);
        await _context.SaveChangesAsync();

        return CreatedAtAction(nameof(GetById), new { id = category.Id },
            new CategoryDto
            {
                Id = category.Id,
                Name = category.Name
            });
    }

    // Ipdate category
    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(int id, UpdateCategoryDto dto)
    {
        if (!ModelState.IsValid) return BadRequest(ModelState);

        var category = await _context.Categories.FindAsync(id);

        if (category == null) return NotFound();

        category.Name = dto.Name;

        await _context.SaveChangesAsync();

        return NoContent();
    }

    // Delete category
    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        var category = await _context.Categories.FindAsync(id);

        if (category == null) return NotFound();

        _context.Categories.Remove(category);
        await _context.SaveChangesAsync();

        return NoContent();
    }

    // Total count of categories and products (for dashboard)
    [HttpGet("count")]
    public async Task<IActionResult> Count()
    {
        var totalCategories = await _context.Categories.CountAsync();
        var totalProducts = await _context.Products.CountAsync();

        return Ok(new
        {
            totalCategories,
            totalProducts
        });
    }
}