using Microsoft.AspNetCore.Http;
using System;

namespace WeatherAPI.DTOs;

public class RegisterUserFormDto
{
    public string FirstName { get; set; }
    public string LastName { get; set; }
    public string Email { get; set; }
    public string Password { get; set; }
    public string? Phone { get; set; }
    public string? Address { get; set; }
    public string? Gender { get; set; }
    public DateTime? DateOfBirth { get; set; }
    public IFormFile? ProfilePicture { get; set; }
}
