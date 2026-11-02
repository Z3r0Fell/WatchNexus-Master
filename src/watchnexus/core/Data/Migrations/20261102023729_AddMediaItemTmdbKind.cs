using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace WatchNexus.Core.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddMediaItemTmdbKind : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "TmdbKind",
                table: "MediaItems",
                type: "TEXT",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "TmdbKind",
                table: "MediaItems");
        }
    }
}
