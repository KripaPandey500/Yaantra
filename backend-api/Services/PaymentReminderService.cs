using Microsoft.EntityFrameworkCore;

namespace WeatherAPI.Services;

public class PaymentReminderService : BackgroundService
{
    private static readonly TimeSpan RunInterval = TimeSpan.FromDays(1);

    private readonly IServiceScopeFactory _scopeFactory;
  private readonly ILogger<PaymentReminderService> _logger;

  public PaymentReminderService(
        IServiceScopeFactory scopeFactory,
    ILogger<PaymentReminderService> logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await ProcessAsync(stoppingToken);

        using var timer = new PeriodicTimer(RunInterval);
        while (!stoppingToken.IsCancellationRequested && await timer.WaitForNextTickAsync(stoppingToken))
        {
            await ProcessAsync(stoppingToken);
        }
    }

    private async Task ProcessAsync(CancellationToken cancellationToken)
    {
        try
        {
            using var scope = _scopeFactory.CreateScope();
            var context = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var emailSender = scope.ServiceProvider.GetRequiredService<IEmailSender>();

            var overdueCutoff = DateTime.UtcNow.AddDays(-60);
            var overdueOrders = await context.Orders
                .Include(o => o.User)
                .Where(o => o.OrderDate <= overdueCutoff)
                .Where(o => o.PaymentStatus.ToLower() == "unpaid")
                .ToListAsync(cancellationToken);

            foreach (var order in overdueOrders)
            {
                if (order.User == null || string.IsNullOrWhiteSpace(order.User.Email))
                {
                    continue;
                }

                var userName = (!string.IsNullOrWhiteSpace(order.User.FirstName) || !string.IsNullOrWhiteSpace(order.User.LastName))
                    ? $"{order.User.FirstName} {order.User.LastName}".Trim()
                    : order.User.Email;
                var subject = $"[Yaantra] Action Required: Unpaid Order {order.OrderNumber}";
                var body = $@"<!DOCTYPE html>
<html lang=""en"">
<head>
  <meta charset=""UTF-8"" />
  <meta name=""viewport"" content=""width=device-width, initial-scale=1.0"" />
  <title>Payment Reminder – Yaantra</title>
</head>
<body style=""margin:0;padding:0;background-color:#f4f4f4;font-family:'Segoe UI',Arial,sans-serif;"">
  <table width=""100%"" cellpadding=""0"" cellspacing=""0"" style=""background-color:#f4f4f4;padding:40px 0;"">
    <tr>
      <td align=""center"">
        <table width=""600"" cellpadding=""0"" cellspacing=""0"" style=""background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);"">

          <!-- Header -->
          <tr>
            <td style=""background-color:#1a1a2e;padding:28px 40px;text-align:center;"">
              <h1 style=""margin:0;color:#ffffff;font-size:26px;letter-spacing:1px;"">Yaantra</h1>
              <p style=""margin:4px 0 0;color:#a0aec0;font-size:13px;"">Auto Parts &amp; Vehicle Services</p>
            </td>
          </tr>

          <!-- Alert Banner -->
          <tr>
            <td style=""background-color:#fff3cd;border-left:5px solid #f59e0b;padding:14px 40px;"">
              <p style=""margin:0;color:#92400e;font-size:14px;font-weight:600;"">⚠&nbsp; Action Required: Your order has an outstanding payment</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style=""padding:36px 40px;"">
              <p style=""margin:0 0 16px;color:#374151;font-size:15px;"">Dear <strong>{userName}</strong>,</p>
              <p style=""margin:0 0 24px;color:#374151;font-size:15px;line-height:1.6;"">
                We noticed that the following order placed with <strong>Yaantra</strong> is still
                <span style=""color:#dc2626;font-weight:600;"">unpaid</span>.
                Kindly clear your dues at the earliest to avoid any service interruption.
              </p>

              <!-- Order Details Box -->
              <table width=""100%"" cellpadding=""0"" cellspacing=""0"" style=""background-color:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;margin-bottom:28px;"">
                <tr>
                  <td style=""padding:20px 24px;"">
                    <table width=""100%"" cellpadding=""6"" cellspacing=""0"">
                      <tr>
                        <td style=""color:#6b7280;font-size:13px;width:45%;"">Order Number</td>
                        <td style=""color:#111827;font-size:13px;font-weight:600;"">{order.OrderNumber}</td>
                      </tr>
                      <tr>
                        <td style=""color:#6b7280;font-size:13px;"">Order Date</td>
                        <td style=""color:#111827;font-size:13px;"">{order.OrderDate:MMMM dd, yyyy}</td>
                      </tr>
                      <tr>
                        <td style=""color:#6b7280;font-size:13px;"">Payment Status</td>
                        <td style=""color:#dc2626;font-size:13px;font-weight:600;"">Unpaid</td>
                      </tr>
                      <tr>
                        <td style=""color:#6b7280;font-size:13px;"">Outstanding Amount</td>
                        <td style=""color:#111827;font-size:15px;font-weight:700;"">NPR {order.GrandTotal:N2}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <p style=""margin:0 0 28px;color:#374151;font-size:14px;line-height:1.6;"">
                If you have already made the payment, please ignore this email or contact our support team
                so we can update your records promptly.
              </p>

              <!-- CTA Button -->
              <table cellpadding=""0"" cellspacing=""0"">
                <tr>
                  <td style=""background-color:#1a1a2e;border-radius:6px;"">
                    <a href=""#"" style=""display:inline-block;padding:12px 28px;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;letter-spacing:0.5px;"">
                      View My Orders
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style=""background-color:#f9fafb;border-top:1px solid #e5e7eb;padding:20px 40px;text-align:center;"">
              <p style=""margin:0 0 6px;color:#6b7280;font-size:12px;"">
                &copy; {DateTime.UtcNow.Year} Yaantra. All rights reserved.
              </p>
              <p style=""margin:0;color:#9ca3af;font-size:11px;"">
                This is an automated reminder. Please do not reply to this email.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>";

                try
                {
                  await emailSender.SendEmailAsync(order.User.Email, subject, body);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Failed to send overdue reminder for order {OrderNumber}", order.OrderNumber);
                }
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed while processing overdue unpaid order reminders.");
        }
    }
}