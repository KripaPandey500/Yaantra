using System.Net;
using System.Net.Mail;
using Microsoft.Extensions.Options;

namespace WeatherAPI.Services;

/// <summary>Simple settings bound from appsettings.json "Email" section.</summary>
public class EmailOptions
{
    public string SmtpHost { get; set; } = string.Empty;
    public int SmtpPort { get; set; } = 587;
    public string From { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
    public bool EnableSsl { get; set; } = true;
}

/// <summary>Abstraction used throughout the app to send emails.</summary>
public interface IEmailSender
{
    Task SendEmailAsync(string to, string subject, string htmlBody);
}

/// <summary>
/// SMTP implementation of IEmailSender.
/// Configure credentials in appsettings.json under the "Email" section.
/// </summary>
public class EmailSender : IEmailSender
{
    private readonly EmailOptions _opts;
    private readonly ILogger<EmailSender> _logger;

    public EmailSender(IOptions<EmailOptions> opts, ILogger<EmailSender> logger)
    {
        _opts = opts.Value;
        _logger = logger;
    }

    public async Task SendEmailAsync(string to, string subject, string htmlBody)
    {
        using var client = new SmtpClient(_opts.SmtpHost, _opts.SmtpPort)
        {
            EnableSsl = _opts.EnableSsl,
            Credentials = new NetworkCredential(_opts.From, _opts.Password)
        };

        using var message = new MailMessage(_opts.From, to, subject, htmlBody)
        {
            IsBodyHtml = true
        };

        try
        {
            await client.SendMailAsync(message);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "SMTP send failed to {To}: {Message}", to, ex.Message);
            throw;
        }
    }
}
