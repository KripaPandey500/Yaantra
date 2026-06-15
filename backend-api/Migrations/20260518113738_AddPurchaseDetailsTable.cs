using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace WeatherAPI.Migrations
{
    /// <inheritdoc />
    public partial class AddPurchaseDetailsTable : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_PurchaseDetails_Products_ProductId",
                table: "PurchaseDetails");

            migrationBuilder.DropForeignKey(
                name: "FK_PurchaseDetails_Purchases_PurchaseId",
                table: "PurchaseDetails");

            migrationBuilder.DropPrimaryKey(
                name: "PK_PurchaseDetails",
                table: "PurchaseDetails");

            migrationBuilder.RenameTable(
                name: "PurchaseDetails",
                newName: "PurchaseItem");

            migrationBuilder.RenameIndex(
                name: "IX_PurchaseDetails_PurchaseId",
                table: "PurchaseItem",
                newName: "IX_PurchaseItem_PurchaseId");

            migrationBuilder.RenameIndex(
                name: "IX_PurchaseDetails_ProductId",
                table: "PurchaseItem",
                newName: "IX_PurchaseItem_ProductId");

            migrationBuilder.AddPrimaryKey(
                name: "PK_PurchaseItem",
                table: "PurchaseItem",
                column: "PurchaseDetailId");

            migrationBuilder.AddForeignKey(
                name: "FK_PurchaseItem_Products_ProductId",
                table: "PurchaseItem",
                column: "ProductId",
                principalTable: "Products",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_PurchaseItem_Purchases_PurchaseId",
                table: "PurchaseItem",
                column: "PurchaseId",
                principalTable: "Purchases",
                principalColumn: "PurchaseId",
                onDelete: ReferentialAction.Cascade);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_PurchaseItem_Products_ProductId",
                table: "PurchaseItem");

            migrationBuilder.DropForeignKey(
                name: "FK_PurchaseItem_Purchases_PurchaseId",
                table: "PurchaseItem");

            migrationBuilder.DropPrimaryKey(
                name: "PK_PurchaseItem",
                table: "PurchaseItem");

            migrationBuilder.RenameTable(
                name: "PurchaseItem",
                newName: "PurchaseDetails");

            migrationBuilder.RenameIndex(
                name: "IX_PurchaseItem_PurchaseId",
                table: "PurchaseDetails",
                newName: "IX_PurchaseDetails_PurchaseId");

            migrationBuilder.RenameIndex(
                name: "IX_PurchaseItem_ProductId",
                table: "PurchaseDetails",
                newName: "IX_PurchaseDetails_ProductId");

            migrationBuilder.AddPrimaryKey(
                name: "PK_PurchaseDetails",
                table: "PurchaseDetails",
                column: "PurchaseDetailId");

            migrationBuilder.AddForeignKey(
                name: "FK_PurchaseDetails_Products_ProductId",
                table: "PurchaseDetails",
                column: "ProductId",
                principalTable: "Products",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_PurchaseDetails_Purchases_PurchaseId",
                table: "PurchaseDetails",
                column: "PurchaseId",
                principalTable: "Purchases",
                principalColumn: "PurchaseId",
                onDelete: ReferentialAction.Cascade);
        }
    }
}
