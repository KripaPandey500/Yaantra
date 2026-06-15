
using System.ComponentModel.DataAnnotations;

namespace WeatherAPI.DTOs;

public class CreateBookingDto
{
	[Range(1, int.MaxValue, ErrorMessage = "Vehicle is required.")]
	public int VehicleId { get; set; }

	[Required(ErrorMessage = "Service type is required.")]
	[MaxLength(100, ErrorMessage = "Service type must not exceed 100 characters.")]
	public string ServiceType { get; set; } = string.Empty;

	public DateTime? BookingDate { get; set; }

	public DateTime? ServiceDate { get; set; }

	[MaxLength(1000, ErrorMessage = "Problem description must not exceed 1000 characters.")]
	public string? ProblemDescription { get; set; }

	[MaxLength(500, ErrorMessage = "Note must not exceed 500 characters.")]
	public string? Note { get; set; }
}

public class BookingResponseDto
{
	public int Id { get; set; }
	public int CustomerId { get; set; }
	public int VehicleId { get; set; }
	public string? VehicleName { get; set; }
	public string ServiceType { get; set; } = string.Empty;
	public DateTime BookingDate { get; set; }
	public DateTime? ServiceDate { get; set; }
	public string? ProblemDescription { get; set; }
	public string? Note { get; set; }
	public string Status { get; set; } = string.Empty;
}

public class AdminBookingDto
{
	public int Id { get; set; }
	public int CustomerId { get; set; }
	public string CustomerName { get; set; } = string.Empty;
	public string CustomerEmail { get; set; } = string.Empty;
	public string? CustomerPhone { get; set; }
	public string VehicleName { get; set; } = string.Empty;
	public string ServiceType { get; set; } = string.Empty;
	public DateTime BookingDate { get; set; }
	public DateTime? ServiceDate { get; set; }
	public string? ProblemDescription { get; set; }
	public string? Note { get; set; }
	public string Status { get; set; } = string.Empty;
}

public class UpdateBookingStatusDto
{
	[Required(ErrorMessage = "Status is required.")]
	[MaxLength(50)]
	public string Status { get; set; } = string.Empty;
}
