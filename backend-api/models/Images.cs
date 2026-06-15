using System.ComponentModel.DataAnnotations;

public class Images
{
    public int Id { get; set; }

    [Required][MaxLength(500)]
    public string FileUrl { get; set; }

    [Required]
    public int EntityId { get; set; }

    [Required][MaxLength(50)]
    public string EntityType { get; set; } // "product", "review", "user"
}
