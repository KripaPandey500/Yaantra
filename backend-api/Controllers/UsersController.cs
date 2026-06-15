using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Identity;
using WeatherAPI.DTOs;

[ApiController]
[Route("api/[controller]")]
public class UsersController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly UserManager<IdentityUser> _userManager;

    public UsersController(AppDbContext context, UserManager<IdentityUser> userManager)
    {
        _context = context;
        _userManager = userManager;
    }

    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        var users = await _context.Set<User>()
            .Select(u => new UserDto
            {
                Id = u.Id,
                FirstName = u.FirstName,
                LastName = u.LastName,
                Email = u.Email,
                Phone = u.Phone,
                Role = u.Role,
                Gender = u.Gender,
                DateOfBirth = u.DateOfBirth,
                ProfilePicture = u.ProfilePicture,
                Address = u.Address
            })
            .ToListAsync();

        return Ok(users);
    }


    [HttpGet("customers")]
    public async Task<IActionResult> GetCustomers(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 10,
        [FromQuery] string search = "")
    {
        if (page < 1) page = 1;

        var query = _context.Set<User>()
            .Where(u => u.Role.ToLower() == "customer");

        if (!string.IsNullOrWhiteSpace(search))
        {
            var lowered = search.ToLower();
            query = query.Where(u =>
                u.FirstName.ToLower().Contains(lowered) ||
                u.LastName.ToLower().Contains(lowered) ||
                u.Email.ToLower().Contains(lowered) ||
                u.Phone.ToLower().Contains(lowered) ||
                (u.Address != null && u.Address.ToLower().Contains(lowered)));
        }

        var totalRecords = await query.CountAsync();

        var customers = await query
            .OrderBy(u => u.FirstName)
            .ThenBy(u => u.LastName)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(u => new UserDto
            {
                Id = u.Id,
                FirstName = u.FirstName,
                LastName = u.LastName,
                Email = u.Email,
                Phone = u.Phone,
                Gender = u.Gender,
                DateOfBirth = u.DateOfBirth,
                ProfilePicture = u.ProfilePicture,
                Address = u.Address,
                Role = u.Role
            })
            .ToListAsync();

        return Ok(new
        {
            page,
            pageSize,
            totalRecords,
            totalPages = (int)Math.Ceiling((double)totalRecords / pageSize),
            data = customers
        });
    }

    [HttpGet("staff")]
    public async Task<IActionResult> GetStaff(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 10,
        [FromQuery] string search = "")
    {
        if (page < 1) page = 1;

        var query = _context.Set<User>()
            .Where(u => u.Role.ToLower() == "staff");

        if (!string.IsNullOrWhiteSpace(search))
        {
            var lowered = search.ToLower();
            query = query.Where(u =>
                u.FirstName.ToLower().Contains(lowered) ||
                u.LastName.ToLower().Contains(lowered) ||
                u.Email.ToLower().Contains(lowered) ||
                u.Phone.ToLower().Contains(lowered) ||
                (u.Address != null && u.Address.ToLower().Contains(lowered)));
        }

        var totalRecords = await query.CountAsync();

        var staff = await query
            .OrderBy(u => u.FirstName)
            .ThenBy(u => u.LastName)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(u => new UserDto
            {
                Id = u.Id,
                FirstName = u.FirstName,
                LastName = u.LastName,
                Email = u.Email,
                Phone = u.Phone,
                Gender = u.Gender,
                DateOfBirth = u.DateOfBirth,
                ProfilePicture = u.ProfilePicture,
                Address = u.Address,
                Role = u.Role
            })
            .ToListAsync();

        return Ok(new
        {
            page,
            pageSize,
            totalRecords,
            totalPages = (int)Math.Ceiling((double)totalRecords / pageSize),
            data = staff
        });
    }

    [HttpGet("vendors")]
    public async Task<IActionResult> GetVendors(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 10,
        [FromQuery] string search = "")
    {
        if (page < 1) page = 1;

        var query = _context.Set<User>()
            .Where(u => u.Role.ToLower() == "vendor");

        if (!string.IsNullOrWhiteSpace(search))
        {
            var lowered = search.ToLower();
            query = query.Where(u =>
                u.FirstName.ToLower().Contains(lowered) ||
                u.LastName.ToLower().Contains(lowered) ||
                u.Email.ToLower().Contains(lowered) ||
                u.Phone.ToLower().Contains(lowered) ||
                (u.Address != null && u.Address.ToLower().Contains(lowered)));
        }

        var totalRecords = await query.CountAsync();

        var vendors = await query
            .OrderBy(u => u.FirstName)
            .ThenBy(u => u.LastName)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(u => new UserDto
            {
                Id = u.Id,
                FirstName = u.FirstName,
                LastName = u.LastName,
                Email = u.Email,
                Phone = u.Phone,
                Gender = u.Gender,
                DateOfBirth = u.DateOfBirth,
                ProfilePicture = u.ProfilePicture,
                Address = u.Address,
                Role = u.Role
            })
            .ToListAsync();

        return Ok(new
        {
            page,
            pageSize,
            totalRecords,
            totalPages = (int)Math.Ceiling((double)totalRecords / pageSize),
            data = vendors
        });
    }

    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetById(int id)
    {
            var user = await _context.Set<User>().FindAsync(id);
        if (user == null) return NotFound();

        return Ok(new UserDto
        {
            Id = user.Id,
            FirstName = user.FirstName,
            LastName = user.LastName,
            Email = user.Email,
            Phone = user.Phone,
            Role = user.Role,
            ProfilePicture = user.ProfilePicture,
            Address = user.Address,
            Gender = user.Gender,
            DateOfBirth = user.DateOfBirth
        });
    }

    [HttpGet("{id:int}/orders")]
    public async Task<IActionResult> GetOrders(int id)
    {
            var exists = await _context.Set<User>().AnyAsync(u => u.Id == id);
        if (!exists) return NotFound();

        var orders = await _context.Orders
            .Where(o => o.UserId == id)
            .ToListAsync();

        return Ok(orders);
    }

    [HttpPost]
    public async Task<IActionResult> Create(CreateUserDto dto)
    {
        // Check for duplicate email
        var existingUser = await _context.Users.FirstOrDefaultAsync(u => u.Email == dto.Email);
        if (existingUser != null)
            return BadRequest(new { description = "Email is already registered." });

        // Validate password
        if (string.IsNullOrWhiteSpace(dto.Password) || dto.Password.Length < 6)
            return BadRequest(new { description = "Password must be at least 6 characters long." });

        if (string.IsNullOrWhiteSpace(dto.FirstName))
            return BadRequest(new { description = "First name is required." });

        if (string.IsNullOrWhiteSpace(dto.LastName))
            return BadRequest(new { description = "Last name is required." });

        if (string.IsNullOrWhiteSpace(dto.Email))
            return BadRequest(new { description = "Email is required." });

        if (string.IsNullOrWhiteSpace(dto.Phone))
            return BadRequest(new { description = "Phone number is required." });

        if (string.IsNullOrWhiteSpace(dto.Address))
            return BadRequest(new { description = "Address is required." });

        if (string.IsNullOrWhiteSpace(dto.Gender))
            return BadRequest(new { description = "Gender is required." });

        if (dto.DateOfBirth == null || dto.DateOfBirth == default(DateTime))
            return BadRequest(new { description = "Date of birth is required." });

        // Create IdentityUser
        var identityUser = new IdentityUser { UserName = dto.Email, Email = dto.Email };
        var result = await _userManager.CreateAsync(identityUser, dto.Password);
        if (!result.Succeeded)
        {
            var errors = string.Join(", ", result.Errors.Select(e => e.Description));
            return BadRequest(new { description = errors });
        }

        await _userManager.AddToRoleAsync(identityUser, dto.Role.ToUpper());

        var user = new User
        {
            FirstName = dto.FirstName,
            LastName = dto.LastName,
            Email = dto.Email,
            Phone = dto.Phone,
            Gender = dto.Gender,
            DateOfBirth = dto.DateOfBirth,
            Role = dto.Role.Substring(0, 1).ToUpper() + dto.Role.Substring(1).ToLower(),
            ProfilePicture = dto.ProfilePicture,
            Address = dto.Address,
            IdentityUserId = identityUser.Id
        };

        _context.Set<User>().Add(user);
        await _context.SaveChangesAsync();

        return CreatedAtAction(nameof(GetById), new { id = user.Id }, new UserDto
        {
            Id = user.Id,
            FirstName = user.FirstName,
            LastName = user.LastName,
            Email = user.Email,
            Phone = user.Phone,
            Role = user.Role
        });
    }

    [HttpPut("{id:int}")]
    [Consumes("multipart/form-data")]
    public async Task<IActionResult> Update(int id, [FromForm] UpdateUserDto dto, [FromForm] IFormFile? profilePicture)
    {
        var user = await _context.Set<User>().FindAsync(id);
        if (user == null) return NotFound();

        // Handle profile picture upload if provided
        if (profilePicture != null && profilePicture.Length > 0)
        {
            var uploadsDir = Path.Combine(Directory.GetCurrentDirectory(), "assets", "uploads", "users");
            if (!Directory.Exists(uploadsDir))
                Directory.CreateDirectory(uploadsDir);

            var fileExt = Path.GetExtension(profilePicture.FileName);
            var profilePictureFileName = $"{Guid.NewGuid()}{fileExt}";
            var filePath = Path.Combine(uploadsDir, profilePictureFileName);

            using (var stream = new FileStream(filePath, FileMode.Create))
            {
                await profilePicture.CopyToAsync(stream);
            }

            user.ProfilePicture = profilePictureFileName;
        }

        user.FirstName = dto.FirstName;
        user.LastName = dto.LastName;
        user.Email = dto.Email;
        user.Phone = dto.Phone;
        user.Role = dto.Role.Substring(0, 1).ToUpper() + dto.Role.Substring(1).ToLower();

        await _context.SaveChangesAsync();
        return Ok(new { message = "User updated successfully." });
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
           var user = await _context.Set<User>().FindAsync(id);
        if (user == null) return NotFound();

           _context.Set<User>().Remove(user);
        await _context.SaveChangesAsync();

        return NoContent();
    }
}