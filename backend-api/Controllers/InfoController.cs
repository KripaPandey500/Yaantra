using Microsoft.AspNetCore.Mvc;

[ApiController]
[Route("api/[controller]")]
public class InfoController : ControllerBase
{
    [HttpGet()]
    public IActionResult GetRequestInfo()
    {
        // Read the user-agent header (tells us what browser they are using)
        string browser = HttpContext.Request.Headers["User-Agent"];

        // Read the path they requested
        string path = HttpContext.Request.Path;



        // Return the data to the client
        return Ok(new { Browser = browser, Path = path, });
    }
}