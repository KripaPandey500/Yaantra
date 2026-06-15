using System.ComponentModel.DataAnnotations;

public class Report
{
    public int Id { get; set; }

    [Required]
    public string Title { get; set; } = string.Empty;

    public string? Description { get; set; } // stores JSON report data

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [Required]
    public int UserId { get; set; }
    public User User { get; set; } = null!;
}