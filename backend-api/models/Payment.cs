using System.ComponentModel.DataAnnotations;

public class Payment
{
	public int Id { get; set; }

	[Required]
	public int UserId { get; set; }
	public User User { get; set; }

	[Required]
	public int OrderId { get; set; }
	public Order Order { get; set; }

	[Required]
	public decimal Amount { get; set; }

	[Required]
	public DateTime PaymentDate { get; set; }

	[Required][MaxLength(50)]
	public string PaymentMethod { get; set; }

	[Required][MaxLength(50)]
	public string Status { get; set; }

	[Required][MaxLength(200)]
	public string TransactionId { get; set; }
}
