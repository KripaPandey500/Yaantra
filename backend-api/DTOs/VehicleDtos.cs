using System.ComponentModel.DataAnnotations;

namespace WeatherAPI.DTOs;

public class CreateVehicleDto
{
    [Required]
    [MaxLength(50)]
    public string Type { get; set; } = string.Empty;

    [Required]
    [MaxLength(50)]
    public string VehicleNumber { get; set; } = string.Empty;

    [Required]
    [MaxLength(100)]
    public string Brand { get; set; } = string.Empty;

    [Required]
    [MaxLength(100)]
    public string Model { get; set; } = string.Empty;

    [Required]
    [Range(1900, 2101)]
    public int ManufactureYear { get; set; }

    [Required]
    [MaxLength(50)]
    public string Color { get; set; } = string.Empty;

    public DateTime? RegistrationDate { get; set; }

    [Required]
    [MaxLength(100)]
    public string EngineNumber { get; set; } = string.Empty;

    [Required]
    [MaxLength(100)]
    public string ChassisNumber { get; set; } = string.Empty;
}
