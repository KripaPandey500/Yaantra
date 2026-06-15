using System;
using System.Collections.Generic;
using System.Linq;
using System.Net.Http;
using System.Text;
using System.Threading.Tasks;
using Microsoft.Extensions.Configuration;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using backend_api.DTOs;

namespace WeatherAPI.Services
{
    /// <summary>
    /// Service for handling Khalti payment integration.
    /// Follows the same flow as the PHP implementation while adapted for ASP.NET Core.
    /// </summary>
    public interface IKhaltiPaymentService
    {
        /// <summary>
        /// Initiates a Khalti payment request and returns payment URL and PIDX
        /// </summary>
        Task<(bool Success, string PaymentUrl, string Pidx, string ErrorMessage)> InitiatePaymentAsync(
            string purchaseOrderId,
            string purchaseOrderName,
            int amountInPaisa,
            string customerName,
            string customerEmail,
            string customerPhone,
            string returnUrl,
            string websiteUrl);

        /// <summary>
        /// Verifies a completed payment with Khalti
        /// </summary>
        Task<(bool Success, string Status, int Amount, string TransactionId, string ErrorMessage)> VerifyPaymentAsync(string pidx);

        /// <summary>
        /// Checks if payment verification response matches expected amount
        /// </summary>
        bool VerifyAmount(int paidAmount, int expectedAmount);
    }

    public class KhaltiPaymentService : IKhaltiPaymentService
    {
        private readonly IConfiguration _configuration;
        private readonly IHttpClientFactory _httpClientFactory;
        private readonly ILogger<KhaltiPaymentService> _logger;

        // Khalti API Endpoints
        private const string KHALTI_INITIATE_URL = "https://dev.khalti.com/api/v2/epayment/initiate/";
        private const string KHALTI_VERIFY_URL = "https://dev.khalti.com/api/v2/epayment/lookup/";

        public KhaltiPaymentService(
            IConfiguration configuration,
            IHttpClientFactory httpClientFactory,
            ILogger<KhaltiPaymentService> logger)
        {
            _configuration = configuration;
            _httpClientFactory = httpClientFactory;
            _logger = logger;
        }

        /// <summary>
        /// Initiates Khalti payment - mirrors PHP khalti_initiate.php logic
        /// Includes retry logic for 504/503 gateway errors
        /// </summary>
        public async Task<(bool Success, string PaymentUrl, string Pidx, string ErrorMessage)> InitiatePaymentAsync(
            string purchaseOrderId,
            string purchaseOrderName,
            int amountInPaisa,
            string customerName,
            string customerEmail,
            string customerPhone,
            string returnUrl,
            string websiteUrl)
        {
            try
            {
                // Validate input
                if (amountInPaisa <= 0)
                {
                    var error = "Invalid amount. Must be greater than 0 paisa.";
                    _logger.LogWarning($"[KhaltiPayment] Invalid amount: {amountInPaisa}");
                    return (false, "", "", error);
                }

                if (string.IsNullOrWhiteSpace(purchaseOrderId))
                {
                    var error = "Purchase order ID is required.";
                    _logger.LogWarning($"[KhaltiPayment] Missing purchase order ID");
                    return (false, "", "", error);
                }

                var secretKey = _configuration["Khalti:SecretKey"];
                if (string.IsNullOrWhiteSpace(secretKey))
                {
                    var error = "Khalti secret key not configured.";
                    _logger.LogError($"[KhaltiPayment] {error}");
                    return (false, "", "", error);
                }

                // Build request payload - same structure as PHP implementation
                var payload = new
                {
                    return_url = returnUrl,
                    website_url = websiteUrl,
                    amount = amountInPaisa,
                    purchase_order_id = purchaseOrderId,
                    purchase_order_name = purchaseOrderName,
                    customer_info = new
                    {
                        name = customerName,
                        email = customerEmail,
                        phone = customerPhone
                    }
                };

                // Retry logic for gateway timeouts
                int maxRetries = 3;
                int retryCount = 0;
                
                while (retryCount <= maxRetries)
                {
                    try
                    {
                        var client = _httpClientFactory.CreateClient();
                        client.Timeout = TimeSpan.FromSeconds(90); // 90-second timeout per request
                        
                        var json = JsonConvert.SerializeObject(payload);
                        var content = new StringContent(json, Encoding.UTF8, "application/json");

                        // Add authorization header
                        var request = new HttpRequestMessage(HttpMethod.Post, KHALTI_INITIATE_URL)
                        {
                            Content = content
                        };
                        request.Headers.Add("Authorization", $"Key {secretKey}");

                        if (retryCount > 0)
                            _logger.LogInformation($"[KhaltiPayment] Retry attempt {retryCount}/{maxRetries} for order: {purchaseOrderId}");
                        else
                            _logger.LogInformation($"[KhaltiPayment] Initiating payment for order: {purchaseOrderId}, amount: {amountInPaisa}");

                        var response = await client.SendAsync(request);
                        var responseContent = await response.Content.ReadAsStringAsync();

                        if (!response.IsSuccessStatusCode)
                        {
                            // Retry on 504 Service Unavailable or 503 Gateway Timeout
                            if ((response.StatusCode == System.Net.HttpStatusCode.GatewayTimeout || 
                                 response.StatusCode == System.Net.HttpStatusCode.ServiceUnavailable) && 
                                retryCount < maxRetries)
                            {
                                retryCount++;
                                _logger.LogWarning($"[KhaltiPayment] Gateway error {(int)response.StatusCode}. Retrying in 2 seconds... (Attempt {retryCount}/{maxRetries})");
                                await Task.Delay(2000); // Wait 2 seconds before retry
                                continue;
                            }

                            _logger.LogError($"[KhaltiPayment] Initiate failed with status {response.StatusCode}: {responseContent}");
                            return (false, "", "", $"Payment gateway error: {responseContent}");
                        }

                        var responseJson = JObject.Parse(responseContent);
                        var paymentUrl = responseJson["payment_url"]?.ToString();
                        var pidx = responseJson["pidx"]?.ToString();

                        if (string.IsNullOrWhiteSpace(paymentUrl) || string.IsNullOrWhiteSpace(pidx))
                        {
                            var error = "Invalid response from payment gateway";
                            _logger.LogError($"[KhaltiPayment] {error}. Response: {responseContent}");
                            return (false, "", "", error);
                        }

                        _logger.LogInformation($"[KhaltiPayment] Payment initiated successfully. PIDX: {pidx}");
                        return (true, paymentUrl, pidx, "");
                    }
                    catch (TaskCanceledException ex)
                    {
                        // Timeout occurred
                        if (retryCount < maxRetries)
                        {
                            retryCount++;
                            _logger.LogWarning($"[KhaltiPayment] Request timeout. Retrying in 2 seconds... (Attempt {retryCount}/{maxRetries})");
                            await Task.Delay(2000);
                            continue;
                        }
                        
                        _logger.LogError($"[KhaltiPayment] Timeout after {maxRetries} retries: {ex.Message}");
                        return (false, "", "", $"Payment gateway timeout after {maxRetries} retries");
                    }
                }

                return (false, "", "", "Payment initiation failed after all retry attempts");
            }
            catch (Exception ex)
            {
                _logger.LogError($"[KhaltiPayment] Exception during initiation: {ex.Message}\n{ex.StackTrace}");
                return (false, "", "", $"Error: {ex.Message}");
            }
        }

        /// <summary>
        /// Verifies payment with Khalti - mirrors PHP khalti_return.php logic
        /// Includes retry logic for 504/503 gateway errors
        /// </summary>
        public async Task<(bool Success, string Status, int Amount, string TransactionId, string ErrorMessage)> VerifyPaymentAsync(string pidx)
        {
            try
            {
                // Validate PIDX
                if (string.IsNullOrWhiteSpace(pidx))
                {
                    var error = "PIDX (Payment Index ID) is required for verification.";
                    _logger.LogWarning($"[KhaltiPayment] {error}");
                    return (false, "", 0, "", error);
                }

                var secretKey = _configuration["Khalti:SecretKey"];
                if (string.IsNullOrWhiteSpace(secretKey))
                {
                    var error = "Khalti secret key not configured.";
                    _logger.LogError($"[KhaltiPayment] {error}");
                    return (false, "", 0, "", error);
                }

                // Build verification request payload
                var payload = new { pidx = pidx };

                // Retry logic for gateway timeouts
                int maxRetries = 3;
                int retryCount = 0;

                while (retryCount <= maxRetries)
                {
                    try
                    {
                        var client = _httpClientFactory.CreateClient();
                        client.Timeout = TimeSpan.FromSeconds(90); // 90-second timeout per request
                        
                        var json = JsonConvert.SerializeObject(payload);
                        var content = new StringContent(json, Encoding.UTF8, "application/json");

                        var request = new HttpRequestMessage(HttpMethod.Post, KHALTI_VERIFY_URL)
                        {
                            Content = content
                        };
                        request.Headers.Add("Authorization", $"Key {secretKey}");

                        if (retryCount > 0)
                            _logger.LogInformation($"[KhaltiPayment] Retry attempt {retryCount}/{maxRetries} for PIDX: {pidx}");
                        else
                            _logger.LogInformation($"[KhaltiPayment] Verifying payment with PIDX: {pidx}");

                        var response = await client.SendAsync(request);
                        var responseContent = await response.Content.ReadAsStringAsync();

                        if (!response.IsSuccessStatusCode)
                        {
                            // Retry on 504 Service Unavailable or 503 Gateway Timeout
                            if ((response.StatusCode == System.Net.HttpStatusCode.GatewayTimeout || 
                                 response.StatusCode == System.Net.HttpStatusCode.ServiceUnavailable) && 
                                retryCount < maxRetries)
                            {
                                retryCount++;
                                _logger.LogWarning($"[KhaltiPayment] Gateway error {(int)response.StatusCode}. Retrying in 2 seconds... (Attempt {retryCount}/{maxRetries})");
                                await Task.Delay(2000); // Wait 2 seconds before retry
                                continue;
                            }

                            _logger.LogError($"[KhaltiPayment] Verification failed with status {response.StatusCode}: {responseContent}");
                            return (false, "", 0, "", $"Verification failed: {responseContent}");
                        }

                        var responseJson = JObject.Parse(responseContent);
                        var status = responseJson["status"]?.ToString() ?? "";
                        var amount = (int?)responseJson["total_amount"] ?? 0;
                        var transactionId = responseJson["transaction_id"]?.ToString() ?? "";

                        _logger.LogInformation($"[KhaltiPayment] Verification response - Status: {status}, Amount: {amount}, TxID: {transactionId}");

                        return (true, status, amount, transactionId, "");
                    }
                    catch (TaskCanceledException ex)
                    {
                        // Timeout occurred
                        if (retryCount < maxRetries)
                        {
                            retryCount++;
                            _logger.LogWarning($"[KhaltiPayment] Verification timeout. Retrying in 2 seconds... (Attempt {retryCount}/{maxRetries})");
                            await Task.Delay(2000);
                            continue;
                        }

                        _logger.LogError($"[KhaltiPayment] Verification timeout after {maxRetries} retries: {ex.Message}");
                        return (false, "", 0, "", $"Verification timeout after {maxRetries} retries");
                    }
                }

                return (false, "", 0, "", "Payment verification failed after all retry attempts");
            }
            catch (Exception ex)
            {
                _logger.LogError($"[KhaltiPayment] Exception during verification: {ex.Message}\n{ex.StackTrace}");
                return (false, "", 0, "", $"Error: {ex.Message}");
            }
        }

        /// <summary>
        /// Verifies that the paid amount matches the expected amount
        /// </summary>
        public bool VerifyAmount(int paidAmount, int expectedAmount)
        {
            var matches = paidAmount == expectedAmount;
            _logger.LogInformation($"[KhaltiPayment] Amount verification - Paid: {paidAmount}, Expected: {expectedAmount}, Match: {matches}");
            return matches;
        }
    }
}
