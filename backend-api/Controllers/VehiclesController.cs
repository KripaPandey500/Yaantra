using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using WeatherAPI.DTOs;

[ApiController]
[Route("api/[controller]")]
public class VehiclesController : ControllerBase
{
    private readonly AppDbContext _context;

    public VehiclesController(AppDbContext context)
    {
        _context = context;
    }

    [Authorize]
    [HttpGet("my")]
    public async Task<IActionResult> GetMyVehicles()
    {
        var userIdStr = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrWhiteSpace(userIdStr))
            return Unauthorized(new { error = "User not authenticated." });

        var user = await _context.Users.FirstOrDefaultAsync(u => u.IdentityUserId == userIdStr);
        if (user == null)
            return Unauthorized(new { error = "User not found." });

        var vehicles = await _context.Vehicles
            .Where(v => v.UserId == user.Id)
            .OrderByDescending(v => v.Id)
            .Select(v => new
            {
                v.Id,
                v.Type,
                v.VehicleNumber,
                v.Brand,
                v.Model,
                v.ManufactureYear,
                v.Color,
                v.RegistrationDate,
                v.EngineNumber,
                v.ChassisNumber
            })
            .ToListAsync();

        return Ok(vehicles);
    }

    [Authorize]
    [HttpGet("user/{userId}")]
    public async Task<IActionResult> GetUserVehicles(int userId)
    {
        // Only staff/admin can view other users' vehicles
        var role = User.FindFirstValue(ClaimTypes.Role);
        if (role != "STAFF" && role != "ADMIN")
        {
            // Allow users to view their own vehicles
            var userIdStr = User.FindFirstValue(ClaimTypes.NameIdentifier);
            var currentUser = await _context.Users.FirstOrDefaultAsync(u => u.IdentityUserId == userIdStr);
            if (currentUser?.Id != userId)
                return Unauthorized(new { error = "Not authorized to view these vehicles." });
        }

        var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == userId);
        if (user == null)
            return NotFound(new { error = "User not found." });

        var vehicles = await _context.Vehicles
            .Where(v => v.UserId == userId)
            .OrderByDescending(v => v.Id)
            .Select(v => new
            {
                v.Id,
                v.Type,
                v.VehicleNumber,
                v.Brand,
                v.Model,
                v.ManufactureYear,
                v.Color,
                v.RegistrationDate,
                v.EngineNumber,
                v.ChassisNumber
            })
            .ToListAsync();

        return Ok(vehicles);
    }

    [Authorize]
    [HttpPost]
    public async Task<IActionResult> AddVehicle([FromBody] CreateVehicleDto dto)
    {
        if (!ModelState.IsValid)
        {
            var firstError = ModelState
                .Where(x => x.Value?.Errors.Count > 0)
                .Select(x => new { field = ToCamelCaseField(x.Key), error = x.Value!.Errors[0].ErrorMessage })
                .FirstOrDefault();

            return BadRequest(firstError ?? new { field = "", error = "Invalid vehicle data." });
        }

        if (dto.RegistrationDate.HasValue && dto.RegistrationDate.Value.Date > DateTime.UtcNow.Date)
            return BadRequest(new { field = "registrationDate", error = "Registration date cannot be in the future." });

        var currentYear = DateTime.UtcNow.Year + 1;
        if (dto.ManufactureYear < 1900 || dto.ManufactureYear > currentYear)
            return BadRequest(new { field = "manufactureYear", error = "Manufacture year is out of valid range." });

        var userIdStr = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrWhiteSpace(userIdStr))
            return Unauthorized(new { error = "User not authenticated." });

        var user = await _context.Users.FirstOrDefaultAsync(u => u.IdentityUserId == userIdStr);
        if (user == null)
            return Unauthorized(new { error = "User not found." });

        var normalizedVehicleNumber = dto.VehicleNumber.Trim();

        var existingVehicleNumber = await _context.Vehicles
            .AnyAsync(v => v.VehicleNumber.ToLower() == normalizedVehicleNumber.ToLower());

        if (existingVehicleNumber)
            return BadRequest(new { field = "vehicleNumber", error = "Vehicle number already exists." });

        var vehicle = new Vehicle
        {
            UserId = user.Id,
            Type = dto.Type.Trim(),
            VehicleNumber = normalizedVehicleNumber,
            Brand = dto.Brand.Trim(),
            Model = dto.Model.Trim(),
            ManufactureYear = dto.ManufactureYear,
            Color = dto.Color.Trim(),
            RegistrationDate = dto.RegistrationDate,
            EngineNumber = dto.EngineNumber.Trim(),
            ChassisNumber = dto.ChassisNumber.Trim()
        };


        // Ensure RegistrationDate is always UTC if present
        if (vehicle.RegistrationDate.HasValue && vehicle.RegistrationDate.Value.Kind != DateTimeKind.Utc)
        {
            vehicle.RegistrationDate = DateTime.SpecifyKind(vehicle.RegistrationDate.Value, DateTimeKind.Utc);
        }

        _context.Vehicles.Add(vehicle);


        try
        {
            await _context.SaveChangesAsync();
        }
        catch (DbUpdateException ex)
        {
            var message = ex.InnerException?.Message ?? ex.Message;
            Console.WriteLine("Vehicle Add Exception: " + message); // Log the exception for debugging

            if (message.Contains("IX_Vehicles_VehicleNumber", StringComparison.OrdinalIgnoreCase)
                || message.Contains("VehicleNumber", StringComparison.OrdinalIgnoreCase)
                || message.Contains("duplicate key", StringComparison.OrdinalIgnoreCase))
            {
                return BadRequest(new { field = "vehicleNumber", error = "Vehicle number already exists." });
            }

            
            return BadRequest(new { field = "", error = "Failed to add vehicle. " + message });
        }

        return Ok(new
        {
            message = "Vehicle added successfully!",
            vehicle = new
            {
                id = vehicle.Id,
                name = vehicle.Brand + " " + vehicle.Model + " (" + vehicle.VehicleNumber + ")"
            }
        });
    }

    private static string ToCamelCaseField(string key)
    {
        var field = key.Split('.').LastOrDefault() ?? key;
        if (string.IsNullOrWhiteSpace(field))
            return string.Empty;

        return char.ToLowerInvariant(field[0]) + field.Substring(1);
    }



    [Authorize]
    [HttpPost("admin/{userId}")]
    public async Task<IActionResult> AddVehicleAdmin(int userId, [FromBody] CreateVehicleDto dto)
    {
        // Verify staff role - allow admin/staff to add vehicles for other users
        var role = User.FindFirstValue(ClaimTypes.Role);
        if (role != "STAFF" && role != "ADMIN")
            return Unauthorized(new { error = "Only staff/admin can create vehicles for others." });

        if (!ModelState.IsValid)
        {
            var firstError = ModelState
                .Where(x => x.Value?.Errors.Count > 0)
                .Select(x => new { field = ToCamelCaseField(x.Key), error = x.Value!.Errors[0].ErrorMessage })
                .FirstOrDefault();

            return BadRequest(firstError ?? new { field = "", error = "Invalid vehicle data." });
        }

        var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == userId);
        if (user == null)
            return NotFound(new { error = "Customer not found." });

        var normalizedVehicleNumber = dto.VehicleNumber.Trim();

        var existingVehicleNumber = await _context.Vehicles
            .AnyAsync(v => v.VehicleNumber.ToLower() == normalizedVehicleNumber.ToLower());

        if (existingVehicleNumber)
            return BadRequest(new { field = "vehicleNumber", error = "Vehicle number already exists." });

        var vehicle = new Vehicle
        {
            UserId = userId,
            Type = dto.Type.Trim(),
            VehicleNumber = normalizedVehicleNumber,
            Brand = dto.Brand.Trim(),
            Model = dto.Model.Trim(),
            ManufactureYear = dto.ManufactureYear,
            Color = dto.Color.Trim(),
            RegistrationDate = dto.RegistrationDate,
            EngineNumber = dto.EngineNumber.Trim(),
            ChassisNumber = dto.ChassisNumber.Trim()
        };

        if (vehicle.RegistrationDate.HasValue && vehicle.RegistrationDate.Value.Kind != DateTimeKind.Utc)
        {
            vehicle.RegistrationDate = DateTime.SpecifyKind(vehicle.RegistrationDate.Value, DateTimeKind.Utc);
        }

        _context.Vehicles.Add(vehicle);

        try
        {
            await _context.SaveChangesAsync();
        }
        catch (DbUpdateException ex)
        {
            var message = ex.InnerException?.Message ?? ex.Message;
            Console.WriteLine("Vehicle Add Exception: " + message);

            if (message.Contains("VehicleNumber", StringComparison.OrdinalIgnoreCase))
                return BadRequest(new { field = "vehicleNumber", error = "Vehicle number already exists." });

            return BadRequest(new { field = "", error = "Failed to add vehicle. " + message });
        }

        return Ok(new
        {
            message = "Vehicle added successfully!",
            vehicle = new
            {
                id = vehicle.Id,
                name = vehicle.Brand + " " + vehicle.Model + " (" + vehicle.VehicleNumber + ")"
            }
        });
    }

    [Authorize]
    [HttpPut("{id}")]
    public async Task<IActionResult> UpdateVehicle(int id, [FromBody] CreateVehicleDto dto)
    {
        if (!ModelState.IsValid)
        {
            var firstError = ModelState
                .Where(x => x.Value?.Errors.Count > 0)
                .Select(x => new { field = ToCamelCaseField(x.Key), error = x.Value!.Errors[0].ErrorMessage })
                .FirstOrDefault();

            return BadRequest(firstError ?? new { field = "", error = "Invalid vehicle data." });
        }

        var vehicle = await _context.Vehicles.FirstOrDefaultAsync(v => v.Id == id);
        if (vehicle == null)
            return NotFound(new { error = "Vehicle not found." });

        // Check authorization - user can only update their own vehicles, or staff can update any
        var userIdStr = User.FindFirstValue(ClaimTypes.NameIdentifier);
        var user = await _context.Users.FirstOrDefaultAsync(u => u.IdentityUserId == userIdStr);
        var role = User.FindFirstValue(ClaimTypes.Role);

        if (vehicle.UserId != user?.Id && role != "STAFF" && role != "ADMIN")
            return Unauthorized(new { error = "Not authorized to update this vehicle." });

        // Check duplicate vehicle number (excluding current vehicle)
        var normalizedVehicleNumber = dto.VehicleNumber.Trim();
        var duplicateExists = await _context.Vehicles
            .AnyAsync(v => v.Id != id && v.VehicleNumber.ToLower() == normalizedVehicleNumber.ToLower());

        if (duplicateExists)
            return BadRequest(new { field = "vehicleNumber", error = "Vehicle number already exists." });

        vehicle.Type = dto.Type.Trim();
        vehicle.VehicleNumber = normalizedVehicleNumber;
        vehicle.Brand = dto.Brand.Trim();
        vehicle.Model = dto.Model.Trim();
        vehicle.ManufactureYear = dto.ManufactureYear;
        vehicle.Color = dto.Color.Trim();
        vehicle.RegistrationDate = dto.RegistrationDate;
        vehicle.EngineNumber = dto.EngineNumber.Trim();
        vehicle.ChassisNumber = dto.ChassisNumber.Trim();

        if (vehicle.RegistrationDate.HasValue && vehicle.RegistrationDate.Value.Kind != DateTimeKind.Utc)
        {
            vehicle.RegistrationDate = DateTime.SpecifyKind(vehicle.RegistrationDate.Value, DateTimeKind.Utc);
        }

        try
        {
            await _context.SaveChangesAsync();
        }
        catch (DbUpdateException ex)
        {
            var message = ex.InnerException?.Message ?? ex.Message;
            Console.WriteLine("Vehicle Update Exception: " + message);

            if (message.Contains("VehicleNumber", StringComparison.OrdinalIgnoreCase))
                return BadRequest(new { field = "vehicleNumber", error = "Vehicle number already exists." });

            return BadRequest(new { field = "", error = "Failed to update vehicle. " + message });
        }

        return Ok(new
        {
            message = "Vehicle updated successfully!",
            vehicle = new
            {
                id = vehicle.Id,
                name = vehicle.Brand + " " + vehicle.Model + " (" + vehicle.VehicleNumber + ")"
            }
        });
    }

    [Authorize]
    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteVehicle(int id)
    {
        var userIdStr = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrWhiteSpace(userIdStr))
            return Unauthorized(new { error = "User not authenticated." });

        var user = await _context.Users.FirstOrDefaultAsync(u => u.IdentityUserId == userIdStr);
        if (user == null)
            return Unauthorized(new { error = "User not found." });

        var vehicle = await _context.Vehicles.FirstOrDefaultAsync(v => v.Id == id && v.UserId == user.Id);
        if (vehicle == null)
            return NotFound(new { error = "Vehicle not found." });

        try
        {
            using (var transaction = await _context.Database.BeginTransactionAsync())
            {
                try
                {
                    // Step 1: Get all bookings for this vehicle
                    var bookings = await _context.Bookings
                        .Where(b => b.VehicleId == id)
                        .ToListAsync();

                    if (bookings.Any())
                    {
                        // Step 2: Delete reviews for each booking
                        foreach (var booking in bookings)
                        {
                            var reviews = await _context.Reviews
                                .Where(r => r.BookingId == booking.Id)
                                .ToListAsync();
                            if (reviews.Any())
                            {
                                _context.Reviews.RemoveRange(reviews);
                            }
                        }
                        await _context.SaveChangesAsync();

                        // Step 3: Delete bookings
                        _context.Bookings.RemoveRange(bookings);
                        await _context.SaveChangesAsync();
                    }

                    // Step 4: Delete vehicle
                    _context.Vehicles.Remove(vehicle);
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
            return StatusCode(500, new { error = "Failed to delete vehicle: " + ex.InnerException?.Message ?? ex.Message });
        }
    }
}
