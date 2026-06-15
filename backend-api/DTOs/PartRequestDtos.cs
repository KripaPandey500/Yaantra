using System.ComponentModel.DataAnnotations;

namespace WeatherAPI.DTOs;

public class CreatePartRequestDto
{
	[Required(ErrorMessage = "Part name is required.")]
	[MaxLength(200, ErrorMessage = "Part name must not exceed 200 characters.")]
	public string PartName { get; set; } = string.Empty;

	[Range(1, 1000, ErrorMessage = "Quantity must be between 1 and 1000.")]
	public int Quantity { get; set; }

	[Required(ErrorMessage = "Description is required.")]
	[MaxLength(1000, ErrorMessage = "Description must not exceed 1000 characters.")]
	public string Description { get; set; } = string.Empty;
}




public class PartRequestResponseDto
{
	public int Id { get; set; }
	public string PartName { get; set; } = string.Empty;
	public int Quantity { get; set; }
	public string Description { get; set; } = string.Empty;
	public string Status { get; set; } = string.Empty;
	public string UserName { get; set; } = string.Empty;
	public string UserEmail { get; set; } = string.Empty;
}
public class UpdatePartRequestStatusDto
{
	public string Status { get; set; }
}