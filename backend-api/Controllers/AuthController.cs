using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using WeatherAPI.DTOs;
using Microsoft.AspNetCore.Authorization; 

[ApiController]
[Route("api/auth")]
public class AuthController : ControllerBase
{
    private readonly UserManager<IdentityUser> _userManager;
    private readonly SignInManager<IdentityUser> _signInManager;
    private readonly AppDbContext _context;
    private readonly JwtOptions _jwtOptions;

    public AuthController(
        UserManager<IdentityUser> userManager,
        SignInManager<IdentityUser> signInManager,
        AppDbContext context,
        IOptions<JwtOptions> jwtOptions)
    {
        _userManager = userManager;
        _signInManager = signInManager;
        _context = context;
        _jwtOptions = jwtOptions.Value;
    }
    //login and register for customer, staff, vendor, admin
    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginDto model)
    {
        var user = await _userManager.FindByEmailAsync(model.Email);
        if (user == null)
            return Unauthorized(new { description = "Invalid email or password." });

        if (!user.EmailConfirmed)
            return Unauthorized(new { description = "Email not confirmed." });

        if (await _userManager.IsLockedOutAsync(user))
            return Unauthorized(new { description = "Account is locked. Please try again later." });

        var result = await _signInManager.CheckPasswordSignInAsync(user, model.Password, lockoutOnFailure: true);
        if (!result.Succeeded)
            return Unauthorized(new { description = "Invalid email or password." });

        // Get user roles from AspNetUserRoles
        var roles = await _userManager.GetRolesAsync(user);
        
        // Also get the role from the Users table
        var userProfile = await _context.Users.FirstOrDefaultAsync(u => u.IdentityUserId == user.Id);
        var databaseRole = userProfile?.Role;

        
        if (!string.IsNullOrEmpty(databaseRole) && !roles.Contains(databaseRole.ToUpper()))
        {
            try
            {
                // Remove old roles and add the correct one
                if (roles.Count > 0)
                {
                    await _userManager.RemoveFromRolesAsync(user, roles);
                }
                await _userManager.AddToRoleAsync(user, databaseRole.ToUpper());
                
                // Update the roles list
                roles = await _userManager.GetRolesAsync(user);
                Console.WriteLine($"✓ Auto-fixed role for {model.Email}: {databaseRole.ToUpper()}");
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Failed to auto-fix role: {ex.Message}");
              
            }
        }

        // Generate JWT token
        var claims = new List<Claim>
        {
            new Claim(JwtRegisteredClaimNames.Sub, user.Id),
            new Claim(JwtRegisteredClaimNames.Email, user.Email),
            new Claim(ClaimTypes.NameIdentifier, user.Id),
            new Claim(ClaimTypes.Email, user.Email)
        };
        foreach (var role in roles)
        {
            claims.Add(new Claim(ClaimTypes.Role, role));
        }

        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_jwtOptions.Secret));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
        var expires = DateTime.UtcNow.AddHours(_jwtOptions.ExpiryHours);

        var token = new JwtSecurityToken(
            issuer: _jwtOptions.Issuer,
            audience: _jwtOptions.Audience,
            claims: claims,
            expires: expires,
            signingCredentials: creds
        );

        var tokenString = new JwtSecurityTokenHandler().WriteToken(token);

        return Ok(new
        {
            token = tokenString,
            expires = expires,
            user = new
            {
                id = user.Id,
                email = user.Email,
                roles = roles
            }
        });
    }
    

    [Authorize] 
    [HttpGet("profile")]
    public async Task<IActionResult> GetProfile()
    {
        var userId = _userManager.GetUserId(User); 
        if (string.IsNullOrEmpty(userId)) return Unauthorized();

        var userProfile = await _context.Users.FirstOrDefaultAsync(u => u.IdentityUserId == userId);
        if (userProfile == null) return NotFound("User profile not found in the database.");

        
        string profilePicturePath = string.IsNullOrEmpty(userProfile.ProfilePicture) 
            ? "" 
            : $"/assets/uploads/users/{userProfile.ProfilePicture}";

        return Ok(new
        {
            id = userProfile.Id, 
            firstName = userProfile.FirstName,
            lastName = userProfile.LastName,
            email = userProfile.Email,
            phone = userProfile.Phone,
            address = userProfile.Address,
            role = userProfile.Role,
            profilePicture = profilePicturePath,
            dateOfBirth = userProfile.DateOfBirth,
            gender = userProfile.Gender
        });
    }



    [Authorize]
    [HttpPut("profile")]
    public async Task<IActionResult> EditProfile([FromBody] UpdateUserDto model)
    {
        var userId = _userManager.GetUserId(User);
        if (string.IsNullOrEmpty(userId)) return Unauthorized();

        var identityUser = await _userManager.FindByIdAsync(userId);
        if (identityUser == null) return NotFound("Identity user not found.");

        var userProfile = await _context.Users.FirstOrDefaultAsync(u => u.IdentityUserId == userId);
        if (userProfile == null) return NotFound("User profile not found in the database.");

        if (!string.Equals(userProfile.Email, model.Email, StringComparison.OrdinalIgnoreCase))
        {
            var existingUser = await _userManager.FindByEmailAsync(model.Email);
            if (existingUser != null && existingUser.Id != identityUser.Id)
            {
                return BadRequest(new { field = "email", error = "Email is already registered." });
            }

            identityUser.Email = model.Email;
            identityUser.UserName = model.Email;

            var updateResult = await _userManager.UpdateAsync(identityUser);
            if (!updateResult.Succeeded)
            {
                return BadRequest(updateResult.Errors);
            }

            userProfile.Email = model.Email;
        }

        if (!string.Equals(userProfile.Phone, model.Phone, StringComparison.OrdinalIgnoreCase))
        {
            var existingPhone = await _context.Users.FirstOrDefaultAsync(u => u.Phone == model.Phone && u.IdentityUserId != userId);
            if (existingPhone != null)
            {
                return BadRequest(new { field = "phone", error = "Phone number is already registered." });
            }
        }

        userProfile.FirstName = model.FirstName;
        userProfile.LastName = model.LastName;
        userProfile.Phone = model.Phone;
        userProfile.Address = model.Address;
        userProfile.Gender = model.Gender;
        userProfile.DateOfBirth = model.DateOfBirth;
        userProfile.ProfilePicture = model.ProfilePicture;

        await _context.SaveChangesAsync();

        return Ok(new { message = "Profile updated successfully." });
    }

    [Authorize]
    [HttpPost("upload-profile-picture")]
    [Consumes("multipart/form-data")]
    public async Task<IActionResult> UploadProfilePicture(IFormFile file)
    {
        if (file == null || file.Length == 0)
            return BadRequest(new { description = "No file uploaded." });

        
        var uploadsDir = Path.Combine(Directory.GetCurrentDirectory(), "assets", "uploads", "users");
        if (!Directory.Exists(uploadsDir))
            Directory.CreateDirectory(uploadsDir);

        // Generate a unique filename
        var fileExt = Path.GetExtension(file.FileName);
        var fileName = $"{Guid.NewGuid()}{fileExt}";
        var filePath = Path.Combine(uploadsDir, fileName);

        // Save the file
        using (var stream = new FileStream(filePath, FileMode.Create))
        {
            await file.CopyToAsync(stream);
        }

        // Return the path as it should be accessed from the frontend
        var publicPath = $"/assets/uploads/users/{fileName}";
        return Ok(new { profilePicture = publicPath });
    }

    [HttpPost("upload")]
    [Consumes("multipart/form-data")]
    public async Task<IActionResult> Upload(IFormFile file)
    {
        if (file == null || file.Length == 0)
            return BadRequest(new { description = "No file uploaded." });

        var uploadsDir = Path.Combine(Directory.GetCurrentDirectory(), "assets", "uploads", "users");
        if (!Directory.Exists(uploadsDir))
            Directory.CreateDirectory(uploadsDir);

       
        var fileExt = Path.GetExtension(file.FileName);
        var fileName = $"{Guid.NewGuid()}{fileExt}";
        var filePath = Path.Combine(uploadsDir, fileName);

        // Save the file
        using (var stream = new FileStream(filePath, FileMode.Create))
        {
            await file.CopyToAsync(stream);
        }

        // Return the filename
        return Ok(new { fileName = fileName });
    }


    [HttpPost("register-staff")]
    [Consumes("multipart/form-data")]
    public async Task<IActionResult> RegisterStaff([FromForm] RegisterUserFormDto model)
    {
        
        var existingUser = await _userManager.FindByEmailAsync(model.Email);
        if (existingUser != null)
            return BadRequest(new[] { new { description = "Email is already registered." } });

       
        var existingPhone = await _context.Users.FirstOrDefaultAsync(u => u.Phone == model.Phone);
        if (existingPhone != null)
            return BadRequest(new[] { new { description = "Phone number is already registered." } });

        
        string profilePictureFileName = "";
        var profilePicture = model.ProfilePicture;
        if (profilePicture != null && profilePicture.Length > 0)
        {
            var uploadsDir = Path.Combine(Directory.GetCurrentDirectory(), "assets", "uploads", "users");
            if (!Directory.Exists(uploadsDir))
                Directory.CreateDirectory(uploadsDir);

            var fileExt = Path.GetExtension(profilePicture.FileName);
            profilePictureFileName = $"{Guid.NewGuid()}{fileExt}";
            var filePath = Path.Combine(uploadsDir, profilePictureFileName);

            using (var stream = new FileStream(filePath, FileMode.Create))
            {
                await profilePicture.CopyToAsync(stream);
            }
        }

        var identityUser = new IdentityUser { UserName = model.Email, Email = model.Email, EmailConfirmed = true };
        var result = await _userManager.CreateAsync(identityUser, model.Password);
        if (!result.Succeeded)
            return BadRequest(result.Errors);

        await _userManager.AddToRoleAsync(identityUser, "STAFF");

        var user = new User
        {
            FirstName = model.FirstName,
            LastName = model.LastName,
            Email = model.Email,
            Phone = model.Phone,
            ProfilePicture = profilePictureFileName,
            Address = model.Address,
            Gender = model.Gender,
            DateOfBirth = model.DateOfBirth.HasValue 
                ? new DateTime(model.DateOfBirth.Value.Ticks, DateTimeKind.Utc) 
                : (DateTime?)null,
            Role = "Staff",
            IdentityUserId = identityUser.Id
        };
        _context.Set<User>().Add(user);
        await _context.SaveChangesAsync();

        return Ok(new { message = "Staff registered successfully." });
    }

    // POST api/auth/register-vendor
    [HttpPost("register-vendor")]
    [Consumes("multipart/form-data")]
    public async Task<IActionResult> RegisterVendor([FromForm] CreateVendorFormDto model)
    {
        var existingUser = await _userManager.FindByEmailAsync(model.Email);
        if (existingUser != null)
            return BadRequest(new[] { new { description = "Email is already registered." } });

        
        string profilePictureFileName = "";
        var profilePicture = model.ProfilePicture;
        if (profilePicture != null && profilePicture.Length > 0)
        {
            var uploadsDir = Path.Combine(Directory.GetCurrentDirectory(), "assets", "uploads", "users");
            if (!Directory.Exists(uploadsDir))
                Directory.CreateDirectory(uploadsDir);

            var fileExt = Path.GetExtension(profilePicture.FileName);
            profilePictureFileName = $"{Guid.NewGuid()}{fileExt}";
            var filePath = Path.Combine(uploadsDir, profilePictureFileName);

            using (var stream = new FileStream(filePath, FileMode.Create))
            {
                await profilePicture.CopyToAsync(stream);
            }
        }

       
        var identityUser = new IdentityUser { UserName = model.Email, Email = model.Email, EmailConfirmed = true };
        var result = await _userManager.CreateAsync(identityUser);
        if (!result.Succeeded)
            return BadRequest(result.Errors);

        await _userManager.AddToRoleAsync(identityUser, "VENDOR");

        var user = new User
        {
            FirstName = model.FirstName,
            LastName = model.LastName,
            Email = model.Email,
            Phone = model.Phone,
            ProfilePicture = profilePictureFileName,
            Address = model.Address,
            Gender = model.Gender,
            DateOfBirth = model.DateOfBirth.HasValue 
                ? new DateTime(model.DateOfBirth.Value.Ticks, DateTimeKind.Utc) 
                : (DateTime?)null,
            Role = model.Role.Substring(0, 1).ToUpper() + model.Role.Substring(1).ToLower(),
            IdentityUserId = identityUser.Id
        };
        _context.Set<User>().Add(user);
        await _context.SaveChangesAsync();

        return Ok(new {
            message = "Vendor registered successfully.",
            user = new {
                user.Id,
                user.FirstName,
                user.LastName,
                user.Email,
                user.Phone,
                user.ProfilePicture,
                user.Address,
                user.Gender,
                user.DateOfBirth,
                user.Role
            }
        });
    }

    // POST api/auth/register-admin
    [HttpPost("register-admin")]
    public async Task<IActionResult> RegisterAdmin([FromBody] CreateUserDto model)
    {
        var existingUser = await _userManager.FindByEmailAsync(model.Email);
        if (existingUser != null)
            return BadRequest(new[] { new { description = "Email is already registered." } });

        var identityUser = new IdentityUser { UserName = model.Email, Email = model.Email, EmailConfirmed = true };
        var result = await _userManager.CreateAsync(identityUser, model.Password);
        if (!result.Succeeded)
            return BadRequest(result.Errors);

        await _userManager.AddToRoleAsync(identityUser, "ADMIN");

        var user = new User
        {
            FirstName = model.FirstName,
            LastName = model.LastName,
            Email = model.Email,
            Phone = model.Phone,
            ProfilePicture = model.ProfilePicture,
            Address = model.Address,
            Gender = model.Gender,
            DateOfBirth = model.DateOfBirth.HasValue 
                ? new DateTime(model.DateOfBirth.Value.Ticks, DateTimeKind.Utc) 
                : (DateTime?)null,
            Role = "Admin",
            IdentityUserId = identityUser.Id
        };
        _context.Set<User>().Add(user);
        await _context.SaveChangesAsync();

        return Ok(new { message = "Admin registered successfully." });
    }

    //POST api/aut/logout
    [HttpPost("logout")]
    public async Task<IActionResult> logout([FromBody] LoginDto model)
    {
        await _signInManager.SignOutAsync();
        return Ok("Logout successful.");
    }

    
    [HttpPost("register-customer")]
    [Consumes("multipart/form-data")]
    public async Task<IActionResult> RegisterCustomer([FromForm] RegisterUserFormDto model)
    {
        // Check for duplicate email
        var existingUser = await _userManager.FindByEmailAsync(model.Email);
        if (existingUser != null)
            return BadRequest(new[] { new { description = "Email is already registered." } });

        // Check for duplicate phone number
        var existingPhone = await _context.Users.FirstOrDefaultAsync(u => u.Phone == model.Phone);
        if (existingPhone != null)
            return BadRequest(new[] { new { description = "Phone number is already registered." } });

        // Handle profile picture upload if provided
        string profilePictureFileName = "";
        var profilePicture = model.ProfilePicture;
        if (profilePicture != null && profilePicture.Length > 0)
        {
            var uploadsDir = Path.Combine(Directory.GetCurrentDirectory(), "assets", "uploads", "users");
            if (!Directory.Exists(uploadsDir))
                Directory.CreateDirectory(uploadsDir);

            var fileExt = Path.GetExtension(profilePicture.FileName);
            profilePictureFileName = $"{Guid.NewGuid()}{fileExt}";
            var filePath = Path.Combine(uploadsDir, profilePictureFileName);

            using (var stream = new FileStream(filePath, FileMode.Create))
            {
                await profilePicture.CopyToAsync(stream);
            }
        }

        var identityUser = new IdentityUser { UserName = model.Email, Email = model.Email, EmailConfirmed = true };
        var result = await _userManager.CreateAsync(identityUser, model.Password);
        if (!result.Succeeded)
            return BadRequest(result.Errors);

        await _userManager.AddToRoleAsync(identityUser, "CUSTOMER");

        var user = new User
        {
            FirstName = model.FirstName,
            LastName = model.LastName,
            Email = model.Email,
            Phone = model.Phone,
            ProfilePicture = profilePictureFileName,
            Address = model.Address,
            Gender = model.Gender,
            DateOfBirth = model.DateOfBirth.HasValue 
                ? new DateTime(model.DateOfBirth.Value.Ticks, DateTimeKind.Utc) 
                : (DateTime?)null,
            Role = "Customer",
            IdentityUserId = identityUser.Id
        };
        _context.Set<User>().Add(user);
        await _context.SaveChangesAsync();

        return Ok(new { message = "Customer registered successfully." });
    }

    [Authorize]
    [HttpPost("fix-staff-role")]
    public async Task<IActionResult> FixStaffRole([FromBody] FixRoleDto model)
    {
        var user = await _userManager.FindByEmailAsync(model.Email);
        if (user == null)
            return NotFound(new { description = "User not found." });

        // Remove all roles
        var currentRoles = await _userManager.GetRolesAsync(user);
        if (currentRoles.Count > 0)
        {
            await _userManager.RemoveFromRolesAsync(user, currentRoles);
        }

        // Add only STAFF role
        var result = await _userManager.AddToRoleAsync(user, "STAFF");
        if (!result.Succeeded)
            return BadRequest(result.Errors);

        return Ok(new { message = $"Staff role assigned successfully to {model.Email}." });
    }

    
    [Authorize]
    [HttpGet("profile/{id}")]
    public async Task<IActionResult> GetProfileById(int id)
    {
        var user = await _context.Users
            .Include(u => u.Vehicles)
            .FirstOrDefaultAsync(u => u.Id == id);
        
        if (user == null)
            return NotFound(new { description = "User not found." });

        string profilePicturePath = string.IsNullOrEmpty(user.ProfilePicture) 
            ? "" 
            : $"/assets/uploads/users/{user.ProfilePicture}";

        // Calculate total spent
        var totalSpent = await _context.Orders
            .Where(o => o.UserId == id)
            .SumAsync(o => o.GrandTotal);

        return Ok(new
        {
            id = user.Id,
            firstName = user.FirstName,
            lastName = user.LastName,
            email = user.Email,
            phone = user.Phone,
            address = user.Address,
            role = user.Role,
            profilePicture = profilePicturePath,
            dateOfBirth = user.DateOfBirth,
            gender = user.Gender,
            vehicles = user.Vehicles.Select(v => new
            {
                id = v.Id,
                vehicleNumber = v.VehicleNumber,
                brand = v.Brand,
                model = v.Model,
                type = v.Type,
                color = v.Color,
                manufactureYear = v.ManufactureYear
            }).ToList(),
            totalSpent = totalSpent
        });
    }

    
    [Authorize]
    [HttpGet("customers")]
    public async Task<IActionResult> GetAllCustomers()
    {
        var customers = await _context.Users
            .Where(u => u.Role.ToUpper() == "CUSTOMER")
            .Include(u => u.Vehicles)
            .ToListAsync();

        var result = customers.Select(c =>
        {
            // Calculate total spent
            var totalSpent = _context.Orders
                .Where(o => o.UserId == c.Id)
                .Sum(o => o.GrandTotal);

            string profilePicturePath = string.IsNullOrEmpty(c.ProfilePicture) 
                ? "" 
                : $"/assets/uploads/users/{c.ProfilePicture}";

            return new
            {
                id = c.Id,
                firstName = c.FirstName,
                lastName = c.LastName,
                email = c.Email,
                phone = c.Phone,
                address = c.Address,
                gender = c.Gender,
                dateOfBirth = c.DateOfBirth,
                profilePicture = profilePicturePath,
                role = c.Role,
                vehicles = c.Vehicles.Select(v => new
                {
                    id = v.Id,
                    vehicleNumber = v.VehicleNumber,
                    brand = v.Brand,
                    model = v.Model,
                    type = v.Type,
                    color = v.Color,
                    manufactureYear = v.ManufactureYear
                }).ToList(),
                totalSpent = totalSpent
            };
        }).ToList();

        return Ok(result);
    }
}