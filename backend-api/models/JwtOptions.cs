using System.ComponentModel.DataAnnotations;

public class JwtOptions
{
    public const string SectionName = "Jwt";

    [Required]
    public string Issuer { get; init; } = string.Empty;

    [Required]
    public string Audience { get; init; } = string.Empty;

    [Required]
    [MinLength(32)]
    public string Secret { get; init; } = string.Empty;

    [Range(1, 720)]
    public int ExpiryHours { get; init; } = 12;
}