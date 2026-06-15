using System.ComponentModel.DataAnnotations;

public class Review
{
       public int Id { get; set; }

    [Required]
    [Range(1, 5)]
    public int Rating { get; set; }

    [Required]
    [MaxLength(1000)]
    public string Comment { get; set; }

    // User Relationship
    [Required]
    public int UserId { get; set; }
    public User User { get; set; }

    // Booking Relationship
    public int? BookingId { get; set; }
    public Booking Booking { get; set; }

}