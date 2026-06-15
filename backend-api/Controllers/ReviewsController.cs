using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

[ApiController]
[Route("api/[controller]")]
public class ReviewsController : ControllerBase
{
    private readonly AppDbContext _context;

    public ReviewsController(AppDbContext context)
    {
        _context = context;
    }

    // Public endpoint for homepage testimonials
    [HttpGet("public")]
    public async Task<IActionResult> GetPublicReviews(int limit = 3)
    {
        if (limit < 1) limit = 3;
        if (limit > 12) limit = 12;

        var reviews = await _context.Reviews
            .AsNoTracking()
            .Include(r => r.User)
            .OrderByDescending(r => r.Id)
            .Take(limit)
            .Select(r => new
            {
                r.Id,
                r.Rating,
                r.Comment,
                UserFullName = ((r.User.FirstName ?? string.Empty) + " " + (r.User.LastName ?? string.Empty)).Trim()
            })
            .ToListAsync();

        return Ok(new
        {
            total = reviews.Count,
            data = reviews
        });
    }

    // POST
    [HttpPost("booking")]
    public async Task<IActionResult> PostBookingReview([FromBody] ReviewDto dto)
    {
        try
        {
            if (!ModelState.IsValid)
                return BadRequest(ModelState);

            if (dto.BookingId == null || dto.BookingId <= 0)
                return BadRequest("BookingId is required.");

            var booking = await _context.Bookings.FindAsync(dto.BookingId);

            if (booking == null)
                return NotFound("Booking not found.");

            // Get userId from JWT claims 
            var userIdClaim = User.Claims
                .FirstOrDefault(c => c.Type == "id" || c.Type.EndsWith("/nameidentifier"));

            if (userIdClaim == null)
                return Unauthorized("User not authenticated.");

            var identityUserId = userIdClaim.Value; 

            
            var user = await _context.Users.FirstOrDefaultAsync(u => u.IdentityUserId == identityUserId);
            if (user == null)
                return Unauthorized("User not found in application users.");

            var userId = user.Id; 



            var review = new Review
            {
                Rating = dto.Rating,
                Comment = dto.Comment,
                BookingId = dto.BookingId,
                UserId = userId
            };

            _context.Reviews.Add(review);

            await _context.SaveChangesAsync();

            return Ok(new
            {
                message = "Review submitted successfully."
            });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new
            {
                error = ex.Message,
                inner = ex.InnerException?.Message
            });
        }
    }

    // GET
    [HttpGet("booking/{bookingId}")]
    public async Task<IActionResult> GetBookingReviews(int bookingId)
    {
        try
        {
            var reviews = await _context.Reviews
                .AsNoTracking()
                .Include(r => r.User)
                .Where(r => r.BookingId == bookingId)
                .OrderByDescending(r => r.Id)
                .Select(r => new
                {
                    r.Id,
                    r.Rating,
                    r.Comment,
                    CustomerName = ((r.User.FirstName ?? string.Empty) + " " + (r.User.LastName ?? string.Empty)).Trim()
                })
                .ToListAsync();

            return Ok(reviews);
        }
        catch (Exception ex)
        {
            return StatusCode(500, new
            {
                error = ex.Message,
                inner = ex.InnerException?.Message
            });
        }
    }
}
