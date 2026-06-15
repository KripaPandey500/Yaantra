
	using Microsoft.AspNetCore.Authorization;
	using Microsoft.Extensions.Logging;
	using Microsoft.AspNetCore.Mvc;
	using Microsoft.EntityFrameworkCore;
	using System.Security.Claims;
	using WeatherAPI.DTOs;

	[ApiController]
	[Route("api/[controller]")]
	public class PartRequestController : ControllerBase
	{
	   private readonly AppDbContext _context;
	   private readonly ILogger<PartRequestController> _logger;
	   public PartRequestController(AppDbContext context, ILogger<PartRequestController> logger)
	   {
		   _context = context;
		   _logger = logger;
	   }

	   

	  
	   // CREATE PART REQUEST
	   
	   [Authorize]
	   [HttpPost]
	   public async Task<IActionResult> Create([FromBody] CreatePartRequestDto dto)
	   {
		   if (dto == null)
			   return BadRequest(new { field = "", error = "Request payload is required." });

		   _logger.LogInformation("Received part request: PartName={PartName}, Quantity={Quantity}", dto.PartName, dto.Quantity);

		   if (!ModelState.IsValid)
		   {
			   var firstError = ModelState
				   .Where(x => x.Value?.Errors.Count > 0)
				   .Select(x => new { field = ToCamelCaseField(x.Key), error = x.Value!.Errors[0].ErrorMessage })
				   .FirstOrDefault();

			   return BadRequest(firstError ?? new { field = "", error = "Invalid part request data." });
		   }

		   if (string.IsNullOrWhiteSpace(dto.PartName))
			   return BadRequest(new { field = "partName", error = "Part name is required." });

		   if (dto.Quantity < 1 || dto.Quantity > 1000)
			   return BadRequest(new { field = "quantity", error = "Quantity must be between 1 and 1000." });

		   if (string.IsNullOrWhiteSpace(dto.Description))
			   return BadRequest(new { field = "description", error = "Description is required." });

		   // Get authenticated user
		   var userIdStr = User.FindFirstValue(ClaimTypes.NameIdentifier);
		   if (string.IsNullOrEmpty(userIdStr))
		   {
			   _logger.LogWarning("User not authenticated.");
			   return Unauthorized(new { error = "User not authenticated." });
		   }
		   var user = await _context.Users.FirstOrDefaultAsync(u => u.IdentityUserId == userIdStr);
		   if (user == null)
		   {
			   _logger.LogWarning("User not found in the database.");
			   return Unauthorized(new { error = "User not found in the database." });
		   }

		   // Create part request
		   var partRequest = new PartRequest
		   {
			   PartName = dto.PartName.Trim(),
			   Quantity = dto.Quantity,
			   Description = dto.Description.Trim(),
			   Status = "Pending",
			   UserId = user.Id
		   };
		   _context.PartRequests.Add(partRequest);
		   await _context.SaveChangesAsync();

		   _logger.LogInformation("Part request saved with Id={Id}", partRequest.Id);

		   return Ok(new {
			   message = "Part request submitted successfully!",
			   request = new PartRequestResponseDto
			   {
				   Id = partRequest.Id,
				   PartName = partRequest.PartName,
				   Quantity = partRequest.Quantity,
				   Description = partRequest.Description,
				   Status = partRequest.Status
			   }
		   });
	   }






	   

	
	// GET MY PART REQUESTS
	
	[Authorize]
	[HttpGet("my")]
	public async Task<IActionResult> GetMyRequests()
	{
		var userIdStr = User.FindFirstValue(ClaimTypes.NameIdentifier);
		if (string.IsNullOrEmpty(userIdStr)) return Unauthorized(new { error = "User not authenticated." });
		var user = await _context.Users.FirstOrDefaultAsync(u => u.IdentityUserId == userIdStr);
		if (user == null) return Unauthorized(new { error = "User not found." });

		var requests = await _context.PartRequests
			.Where(r => r.UserId == user.Id)
			.OrderByDescending(r => r.Id)
			.Select(r => new PartRequestResponseDto
			{
				Id = r.Id,
				PartName = r.PartName,
				Quantity = r.Quantity,
				Description = r.Description,
				Status = r.Status
			})
			.ToListAsync();

		return Ok(requests);
	}

	private static string ToCamelCaseField(string key)
	{
		var field = key.Split('.').LastOrDefault() ?? key;
		if (string.IsNullOrWhiteSpace(field))
			return string.Empty;

		return char.ToLowerInvariant(field[0]) + field.Substring(1);
	}




	
	   // GET ALL PART REQUESTS
	  
	   [Authorize]
	   [HttpGet("all")]
	   public async Task<IActionResult> GetAllRequests()
	   {
		   var requests = await _context.PartRequests
			   .Include(r => r.User)
			   .OrderByDescending(r => r.Id)
			   .Select(r => new PartRequestResponseDto
			   {
				   Id = r.Id,
				   PartName = r.PartName,
				   Quantity = r.Quantity,
				   Description = r.Description,
				   Status = r.Status,
				   UserName = r.User != null ? (r.User.FirstName + " " + r.User.LastName) : string.Empty,
				   UserEmail = r.User != null ? r.User.Email : string.Empty
			   })
			   .ToListAsync();

		   return Ok(requests);
	   }

	
	   // UPDATE REQUEST STATUS
	   
	   [Authorize]
	   [HttpPatch("{id}/status")]
	   public async Task<IActionResult> UpdateStatus(int id, [FromBody] UpdatePartRequestStatusDto dto)
	   {
		   if (dto == null || string.IsNullOrWhiteSpace(dto.Status))
			   return BadRequest(new { error = "Status is required." });

		   var request = await _context.PartRequests.FirstOrDefaultAsync(r => r.Id == id);
		   if (request == null)
			   return NotFound(new { error = "Request not found." });

		   request.Status = dto.Status;
		   _context.PartRequests.Update(request);
		   await _context.SaveChangesAsync();

		   _logger.LogInformation("Updated status for request {Id} to {Status}", id, dto.Status);

		   return Ok(new { message = "Status updated successfully!", newStatus = request.Status });
	   }

	
	   // DELETE REQUEST
	   
	   [Authorize]
	   [HttpDelete("{id}")]
	   public async Task<IActionResult> DeleteRequest(int id)
	   {
		   var request = await _context.PartRequests.FindAsync(id);
		   if (request == null)
			   return NotFound(new { error = "Request not found." });

		   _context.PartRequests.Remove(request);
		   await _context.SaveChangesAsync();

		   _logger.LogInformation("Deleted request {Id}", id);

		   return Ok(new { message = "Request deleted successfully." });
	   }
}
