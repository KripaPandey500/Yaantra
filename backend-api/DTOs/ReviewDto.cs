using System.ComponentModel.DataAnnotations;

public class ReviewDto
{
   public int? Id { get; set; }

    [Required]
    [Range(1, 5)]
    public int Rating { get; set; }

    [Required]
    [MaxLength(1000)]
    public string Comment { get; set; }

    // Booking Review
    public int? BookingId { get; set; }

    // User Tracking
    public int? UserId { get; set; }

}
