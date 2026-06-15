using System.ComponentModel.DataAnnotations;

public class Booking
{
    public int Id { get; set; }

    [Required]
    public int CustomerId { get; set; }
    public User Customer { get; set; }

    [Required]
    public int VehicleId { get; set; }
    public Vehicle Vehicle { get; set; }

    [Required]
    public DateTime BookingDate { get; set; }

    public DateTime? ServiceDate { get; set; }

    [Required][MaxLength(50)]
    public string Status { get; set; } // Pending, Confirmed, Completed, Cancelled

    [Required][MaxLength(100)]
    public string ServiceType { get; set; } // e.g., Oil Change, Repair

    [MaxLength(1000)]
    public string? ProblemDescription { get; set; } // Customer explains issue

    [MaxLength(500)]
    public string? Note { get; set; } // Optional extra remarks

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}