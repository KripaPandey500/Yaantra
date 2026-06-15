using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;

public class Vehicle
{
    public int Id { get; set; }           // VehicleID (PK)

    [Required]
    public int UserId { get; set; }       // CustomerID (FK)
    public User User { get; set; }

    [Required][MaxLength(50)]
    public string Type { get; set; }          // e.g. Car, Truck, Motorcycle

    [Required][MaxLength(50)]
    public string VehicleNumber { get; set; } // UNIQUE – registration/plate number

    [Required][MaxLength(100)]
    public string Brand { get; set; }

    [Required][MaxLength(100)]
    public string Model { get; set; }

    [Required]
    public int ManufactureYear { get; set; }

    [Required][MaxLength(50)]
    public string Color { get; set; }

    public DateTime? RegistrationDate { get; set; }

    [Required][MaxLength(100)]
    public string EngineNumber { get; set; }

    [Required][MaxLength(100)]
    public string ChassisNumber { get; set; }

    public ICollection<Booking> Bookings { get; set; }
}