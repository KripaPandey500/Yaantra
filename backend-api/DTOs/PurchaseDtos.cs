using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;

namespace WeatherAPI.DTOs;

public class PurchaseItemDto
{
	[Required]
	public int ProductId { get; set; }

	[Required]
	[Range(1, int.MaxValue)]
	public int Quantity { get; set; }
}

public class CreatePurchaseDto
{
	[Required]
	public string VendorUserId { get; set; } = string.Empty;

	[Required]
	public DateTime PurchaseDate { get; set; }

	[Required]
	public List<PurchaseItemDto> PurchaseItems { get; set; } = new();
}

public class PurchaseDetailDto
{
	public int PurchaseDetailId { get; set; }
	public int ProductId { get; set; }
	public string ProductName { get; set; } = string.Empty;
	public int Quantity { get; set; }
	public decimal UnitPrice { get; set; }
	public decimal SubTotal { get; set; }
}

public class PurchaseDto
{
	public int PurchaseId { get; set; }
	public string VendorUserId { get; set; } = string.Empty;
	public string VendorName { get; set; } = string.Empty;
	public DateTime PurchaseDate { get; set; }
	public decimal TotalAmount { get; set; }
	public List<PurchaseDetailDto> PurchaseDetails { get; set; } = new();
}

public class PurchaseSummaryDto
{
	public int PurchaseId { get; set; }
	public string VendorName { get; set; } = string.Empty;
	public DateTime PurchaseDate { get; set; }
	public decimal TotalAmount { get; set; }
}
