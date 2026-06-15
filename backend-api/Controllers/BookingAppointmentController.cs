using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using WeatherAPI.DTOs;

[ApiController]
[Route("api/[controller]")]
public class BookingAppointmentController : ControllerBase
{
	private readonly AppDbContext _context;
	public BookingAppointmentController(AppDbContext context)
	{
		_context = context;
	}

	
	// GET USER VEHICLES
	
	[Authorize]
	[HttpGet("user-vehicles")]
	public async Task<IActionResult> GetUserVehicles()
	{
		var userIdStr = User.FindFirstValue(ClaimTypes.NameIdentifier);
		if (string.IsNullOrEmpty(userIdStr)) return Unauthorized(new { error = "User not authenticated." });

		var user = await _context.Users.FirstOrDefaultAsync(u => u.IdentityUserId == userIdStr);
		if (user == null) return Unauthorized(new { error = "User not found." });

		var vehicles = await _context.Vehicles
			.Where(v => v.UserId == user.Id)
			.OrderBy(v => v.Brand)
			.ThenBy(v => v.Model)
			.Select(v => new
			{
				id = v.Id,
				name = v.Brand + " " + v.Model + " (" + v.VehicleNumber + ")"
			})
			.ToListAsync();

		return Ok(vehicles);
	}

	// CREATE BOOKING
	

	[Authorize]
	[HttpPost("bookings")]
	public async Task<IActionResult> CreateBooking([FromBody] CreateBookingDto dto)
	{
		if (dto == null)
			return BadRequest(new { field = "", error = "Request payload is required." });

		if (!ModelState.IsValid)
		{
			var firstError = ModelState
				.Where(x => x.Value?.Errors.Count > 0)
				.Select(x => new { field = ToCamelCaseField(x.Key), error = x.Value!.Errors[0].ErrorMessage })
				.FirstOrDefault();

			return BadRequest(firstError ?? new { field = "", error = "Invalid booking data." });
		}

		var bookingDateUtc = DateTime.UtcNow;

		if (dto.ServiceDate.HasValue && dto.ServiceDate.Value.Date < bookingDateUtc.Date)
			return BadRequest(new { field = "serviceDate", error = "Booking date cannot be earlier than today." });

		if (string.IsNullOrWhiteSpace(dto.ServiceType))
			return BadRequest(new { field = "serviceType", error = "Service type is required." });

		// Get user
		var userIdStr = User.FindFirstValue(ClaimTypes.NameIdentifier);
		if (string.IsNullOrEmpty(userIdStr)) return Unauthorized(new { error = "User not authenticated." });
		var user = await _context.Users.FirstOrDefaultAsync(u => u.IdentityUserId == userIdStr);
		if (user == null) return Unauthorized(new { error = "User not found." });

		// Check if vehicle exists and belongs to user
		var vehicle = await _context.Vehicles.FirstOrDefaultAsync(v => v.Id == dto.VehicleId && v.UserId == user.Id);
		if (vehicle == null)
			return BadRequest(new { field = "vehicleId", error = "Selected vehicle is invalid." });

		// Create booking
		var normalizedBookingDate = DateTime.SpecifyKind(bookingDateUtc, DateTimeKind.Utc);
		DateTime? normalizedServiceDate = dto.ServiceDate.HasValue
			? DateTime.SpecifyKind(dto.ServiceDate.Value.Date, DateTimeKind.Utc)
			: null;

		var booking = new Booking
		{
			CustomerId = user.Id,
			VehicleId = dto.VehicleId,
			ServiceType = dto.ServiceType.Trim(),
			BookingDate = normalizedBookingDate,
			ServiceDate = normalizedServiceDate,
			ProblemDescription = string.IsNullOrWhiteSpace(dto.ProblemDescription) ? null : dto.ProblemDescription.Trim(),
			Note = string.IsNullOrWhiteSpace(dto.Note) ? null : dto.Note.Trim(),
			Status = "Pending",
			CreatedAt = DateTime.UtcNow
		};
		_context.Bookings.Add(booking);

		try
		{
			await _context.SaveChangesAsync();
		}
		catch (DbUpdateException)
		{
			return BadRequest(new { error = "Failed to book appointment. Please verify your details and try again." });
		}

		return Ok(new {
			message = "Booking created successfully!",
			booking = new BookingResponseDto
			{
				Id = booking.Id,
				CustomerId = booking.CustomerId,
				VehicleId = booking.VehicleId,
				VehicleName = vehicle.Brand + " " + vehicle.Model + " (" + vehicle.VehicleNumber + ")",
				ServiceType = booking.ServiceType,
				BookingDate = booking.BookingDate,
				ServiceDate = booking.ServiceDate,
				ProblemDescription = booking.ProblemDescription,
				Note = booking.Note,
				Status = booking.Status
			}
		});
	}

	
	// GET USER BOOKINGS
	
	[Authorize]
	[HttpGet("bookings")]
	public async Task<IActionResult> GetUserBookings()
	{
		var userIdStr = User.FindFirstValue(ClaimTypes.NameIdentifier);
		if (string.IsNullOrEmpty(userIdStr)) return Unauthorized(new { error = "User not authenticated." });
		var user = await _context.Users.FirstOrDefaultAsync(u => u.IdentityUserId == userIdStr);
		if (user == null) return Unauthorized(new { error = "User not found." });

		var bookings = await _context.Bookings
			.Where(b => b.CustomerId == user.Id)
			.OrderByDescending(b => b.BookingDate)
			.Include(b => b.Vehicle)
			.Select(b => new BookingResponseDto
			{
				Id = b.Id,
				CustomerId = b.CustomerId,
				VehicleId = b.VehicleId,
				VehicleName = b.Vehicle.Brand + " " + b.Vehicle.Model + " (" + b.Vehicle.VehicleNumber + ")",
				ServiceType = b.ServiceType,
				BookingDate = b.BookingDate,
				ServiceDate = b.ServiceDate,
				ProblemDescription = b.ProblemDescription,
				Note = b.Note,
				Status = b.Status
			})
			.ToListAsync();

		return Ok(bookings);
	}

	[Authorize]
	[HttpGet("bookings/history")]
	public async Task<IActionResult> GetBookingHistory(
		int page = 1,
		int pageSize = 6,
		string? search = null)
	{
		if (page < 1) page = 1;
		if (pageSize < 1) pageSize = 6;

		var userIdStr = User.FindFirstValue(ClaimTypes.NameIdentifier);
		if (string.IsNullOrEmpty(userIdStr))
			return Unauthorized(new { error = "User not authenticated." });

		var user = await _context.Users.FirstOrDefaultAsync(u => u.IdentityUserId == userIdStr);
		if (user == null)
			return Unauthorized(new { error = "User not found." });

		var query = _context.Bookings
			.Where(b => b.CustomerId == user.Id)
			.AsQueryable();

		if (!string.IsNullOrWhiteSpace(search))
		{
			var lowered = search.Trim().ToLower();
			query = query.Where(b =>
				b.ServiceType.ToLower().Contains(lowered)
				|| (b.Status ?? string.Empty).ToLower().Contains(lowered)
				|| (b.Vehicle.Brand + " " + b.Vehicle.Model + " (" + b.Vehicle.VehicleNumber + ")").ToLower().Contains(lowered)
				|| (b.Note ?? string.Empty).ToLower().Contains(lowered)
				|| (b.ProblemDescription ?? string.Empty).ToLower().Contains(lowered));
		}

		var totalRecords = await query.CountAsync();

		var data = await query
			.OrderByDescending(b => b.BookingDate)
			.ThenByDescending(b => b.Id)
			.Skip((page - 1) * pageSize)
			.Take(pageSize)
			.Select(b => new BookingResponseDto
			{
				Id = b.Id,
				CustomerId = b.CustomerId,
				VehicleId = b.VehicleId,
				VehicleName = b.Vehicle.Brand + " " + b.Vehicle.Model + " (" + b.Vehicle.VehicleNumber + ")",
				ServiceType = b.ServiceType,
				BookingDate = b.BookingDate,
				ServiceDate = b.ServiceDate,
				ProblemDescription = b.ProblemDescription,
				Note = b.Note,
				Status = b.Status
			})
			.ToListAsync();

		return Ok(new
		{
			page,
			pageSize,
			totalRecords,
			totalPages = (int)Math.Ceiling((double)totalRecords / pageSize),
			data
		});
	}

	[Authorize]
	[HttpPatch("bookings/{id:int}/cancel")]
	public async Task<IActionResult> CancelBooking(int id)
	{
		var userIdStr = User.FindFirstValue(ClaimTypes.NameIdentifier);
		if (string.IsNullOrEmpty(userIdStr))
			return Unauthorized(new { error = "User not authenticated." });

		var user = await _context.Users.FirstOrDefaultAsync(u => u.IdentityUserId == userIdStr);
		if (user == null)
			return Unauthorized(new { error = "User not found." });

		var booking = await _context.Bookings
			.FirstOrDefaultAsync(b => b.Id == id && b.CustomerId == user.Id);

		if (booking == null)
			return NotFound(new { error = "Booking not found." });

		if (string.Equals(booking.Status, "Cancelled", StringComparison.OrdinalIgnoreCase))
			return BadRequest(new { error = "Booking is already cancelled." });

		booking.Status = "Cancelled";
		await _context.SaveChangesAsync();

		return Ok(new { message = "Booking cancelled successfully!" });
	}

	[Authorize]
	[HttpDelete("bookings/{id:int}")]
	public async Task<IActionResult> DeleteBooking(int id)
	{
		var userIdStr = User.FindFirstValue(ClaimTypes.NameIdentifier);
		if (string.IsNullOrEmpty(userIdStr))
			return Unauthorized(new { error = "User not authenticated." });

		var user = await _context.Users.FirstOrDefaultAsync(u => u.IdentityUserId == userIdStr);
		if (user == null)
			return Unauthorized(new { error = "User not found." });

		var booking = await _context.Bookings
			.FirstOrDefaultAsync(b => b.Id == id && b.CustomerId == user.Id);

		if (booking == null)
			return NotFound(new { error = "Booking not found." });

		try
		{
			using (var transaction = await _context.Database.BeginTransactionAsync())
			{
				try
				{
					// Delete reviews first (handle foreign key constraint)
					var reviews = await _context.Reviews
						.Where(r => r.BookingId == id)
						.ToListAsync();
					if (reviews.Any())
					{
						_context.Reviews.RemoveRange(reviews);
						await _context.SaveChangesAsync();
					}

					// Delete booking
					_context.Bookings.Remove(booking);
					await _context.SaveChangesAsync();

					await transaction.CommitAsync();
					return NoContent();
				}
				catch
				{
					await transaction.RollbackAsync();
					throw;
				}
			}
		}
		catch (Exception ex)
		{
			return StatusCode(500, new { error = "Failed to delete booking: " + ex.InnerException?.Message ?? ex.Message });
		}
	}

	[Authorize(Roles = "ADMIN")]
	[HttpGet("admin/bookings")]
	public async Task<IActionResult> GetAdminBookings(
		int page = 1,
		int pageSize = 10,
		string? search = null,
		string? status = null)
	{
		if (page < 1) page = 1;
		if (pageSize < 1) pageSize = 10;

		var query = _context.Bookings
			.Include(b => b.Customer)
			.Include(b => b.Vehicle)
			.AsQueryable();

		if (!string.IsNullOrWhiteSpace(status) && !string.Equals(status, "all", StringComparison.OrdinalIgnoreCase))
		{
			var normalizedStatus = status.Trim().ToLower();
			query = query.Where(b => b.Status.ToLower() == normalizedStatus);
		}

		if (!string.IsNullOrWhiteSpace(search))
		{
			var lowered = search.Trim().ToLower();
			query = query.Where(b =>
				(b.Customer.FirstName + " " + b.Customer.LastName).ToLower().Contains(lowered)
				|| b.Customer.Email.ToLower().Contains(lowered)
				|| (b.Customer.Phone ?? string.Empty).ToLower().Contains(lowered)
				|| b.ServiceType.ToLower().Contains(lowered)
				|| b.Status.ToLower().Contains(lowered)
				|| (b.Vehicle.Brand + " " + b.Vehicle.Model + " (" + b.Vehicle.VehicleNumber + ")").ToLower().Contains(lowered));
		}

		var totalRecords = await query.CountAsync();

		var bookings = await query
			.OrderByDescending(b => b.BookingDate)
			.ThenByDescending(b => b.Id)
			.Skip((page - 1) * pageSize)
			.Take(pageSize)
			.Select(b => new AdminBookingDto
			{
				Id = b.Id,
				CustomerId = b.CustomerId,
				CustomerName = b.Customer.FirstName + " " + b.Customer.LastName,
				CustomerEmail = b.Customer.Email,
				CustomerPhone = b.Customer.Phone,
				VehicleName = b.Vehicle.Brand + " " + b.Vehicle.Model + " (" + b.Vehicle.VehicleNumber + ")",
				ServiceType = b.ServiceType,
				BookingDate = b.BookingDate,
				ServiceDate = b.ServiceDate,
				ProblemDescription = b.ProblemDescription,
				Note = b.Note,
				Status = b.Status
			})
			.ToListAsync();

		return Ok(new
		{
			page,
			pageSize,
			totalRecords,
			totalPages = (int)Math.Ceiling((double)totalRecords / pageSize),
			data = bookings
		});
	}

	[Authorize(Roles = "ADMIN")]
	[HttpPatch("admin/bookings/{id:int}/status")]
	public async Task<IActionResult> UpdateAdminBookingStatus(int id, [FromBody] UpdateBookingStatusDto dto)
	{
		if (dto == null || string.IsNullOrWhiteSpace(dto.Status))
			return BadRequest(new { error = "Status is required." });

		var normalizedStatus = NormalizeAdminBookingStatus(dto.Status);
		if (normalizedStatus == null)
			return BadRequest(new { error = "Status must be Pending, Completed, or Rejected." });

		var booking = await _context.Bookings.FirstOrDefaultAsync(b => b.Id == id);
		if (booking == null)
			return NotFound(new { error = "Booking not found." });

		booking.Status = normalizedStatus;
		await _context.SaveChangesAsync();

		return Ok(new { message = "Booking status updated successfully.", status = booking.Status });
	}

	private static string? NormalizeAdminBookingStatus(string? status)
	{
		if (string.IsNullOrWhiteSpace(status)) return null;

		switch (status.Trim().ToLower())
		{
			case "pending":
				return "Pending";
			case "completed":
				return "Completed";
			case "rejected":
				return "Rejected";
			default:
				return null;
		}
	}

	private static string ToCamelCaseField(string key)
	{
		var field = key.Split('.').LastOrDefault() ?? key;
		if (string.IsNullOrWhiteSpace(field))
			return string.Empty;

		return char.ToLowerInvariant(field[0]) + field.Substring(1);
	}
}
