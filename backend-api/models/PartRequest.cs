using System.ComponentModel.DataAnnotations;

public class PartRequest
{
    public int Id { get; set; }

    [Required][MaxLength(200)]
    public string PartName { get; set; }

    [Required][MaxLength(1000)]
    public string Description { get; set; }

    [Required]
    public int Quantity { get; set; }

    [Required][MaxLength(50)]
    public string Status { get; set; }

    [Required]
    public int UserId { get; set; }
    public User User { get; set; }
}