using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using backend_api.models;

[ApiController]
[Route("api/[controller]")]
public class VehiclesPartsController : ControllerBase
{
    private readonly AppDbContext _context;
    public VehiclesPartsController(AppDbContext context) => _context = context;

    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        var parts = await _context.VehicleParts.ToListAsync();
        return Ok(parts);
    }

    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetById(int id)
    {
        var part = await _context.VehicleParts.FindAsync(id);
        if (part == null) return NotFound();
        return Ok(part);
    }

    [HttpPost]
    public async Task<IActionResult> Create(VehiclePart part)
    {
        _context.VehicleParts.Add(part);
        await _context.SaveChangesAsync();
        return CreatedAtAction(nameof(GetById), new { id = part.Id }, part);
    }

    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(int id, VehiclePart part)
    {
        if (id != part.Id) return BadRequest();
        _context.Entry(part).State = EntityState.Modified;
        await _context.SaveChangesAsync();
        return NoContent();
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        var part = await _context.VehicleParts.FindAsync(id);
        if (part == null) return NotFound();
        _context.VehicleParts.Remove(part);
        await _context.SaveChangesAsync();
        return NoContent();
    }
}