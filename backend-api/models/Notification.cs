using System;
using System.ComponentModel.DataAnnotations;

public class Notification
{
    public int Id { get; set; }

    [Required][MaxLength(1000)]
    public string Message { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public bool IsRead { get; set; } = false;

    public int? UserId { get; set; } 
    public User User { get; set; }
}