using System.ComponentModel.DataAnnotations;

public class User
{
    public int Id { get; set; }

    [Required][MaxLength(100)]
    public string FirstName { get; set; }

    [Required][MaxLength(100)]
    public string LastName { get; set; }

    [Required][MaxLength(256)]
    public string Email { get; set; }

    [MaxLength(20)]
	public string? Phone { get; set; }

    [MaxLength(500)]
	public string? ProfilePicture { get; set; }

    // Gender: Male, Female, Other
    [MaxLength(20)]
    public string? Gender { get; set; }

    // Date of Birth
    public DateTime? DateOfBirth { get; set; }

    // User address
    [MaxLength(500)]
    public string? Address { get; set; }

    [Required][MaxLength(50)]
    public string Role { get; set; }

    [Required][MaxLength(450)]
    public string IdentityUserId { get; set; } // Link to IdentityUser

    // One User has many Orders (1-to-M)
    public ICollection<Order> Orders { get; set; }

    public ICollection<Booking> Bookings { get; set; }
    public ICollection<Review> Reviews { get; set; }

    public ICollection<Vehicle> Vehicles { get; set; }

    // One User has many PartRequests (1-to-M)
    public ICollection<PartRequest> PartRequests { get; set; }

    // One User has many Reports (1-to-M)
    public ICollection<Report> Reports { get; set; }
}
