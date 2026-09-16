using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace WatchNexus.Core.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddMediaItemLibraryCascade : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddForeignKey(
                name: "FK_MediaItems_Libraries_LibraryId",
                table: "MediaItems",
                column: "LibraryId",
                principalTable: "Libraries",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_MediaItems_Libraries_LibraryId",
                table: "MediaItems");
        }
    }
}
