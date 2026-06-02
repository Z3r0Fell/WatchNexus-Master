using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace WatchNexus.Core.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddSpotdlModels : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "SpotdlDownloads",
                columns: table => new
                {
                    Id = table.Column<string>(type: "TEXT", nullable: false),
                    UserId = table.Column<string>(type: "TEXT", nullable: false),
                    Url = table.Column<string>(type: "TEXT", nullable: false),
                    Title = table.Column<string>(type: "TEXT", nullable: false),
                    Artist = table.Column<string>(type: "TEXT", nullable: true),
                    Status = table.Column<string>(type: "TEXT", nullable: false),
                    Format = table.Column<string>(type: "TEXT", nullable: false),
                    Progress = table.Column<double>(type: "REAL", nullable: false),
                    OutputPath = table.Column<string>(type: "TEXT", nullable: true),
                    ErrorMessage = table.Column<string>(type: "TEXT", nullable: true),
                    KeyUsed = table.Column<string>(type: "TEXT", nullable: true),
                    RetryCount = table.Column<int>(type: "INTEGER", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                    CompletedAt = table.Column<DateTime>(type: "TEXT", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SpotdlDownloads", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "SpotdlKeys",
                columns: table => new
                {
                    Id = table.Column<string>(type: "TEXT", nullable: false),
                    KeyValue = table.Column<string>(type: "TEXT", nullable: false),
                    Service = table.Column<string>(type: "TEXT", nullable: false),
                    IsActive = table.Column<bool>(type: "INTEGER", nullable: false),
                    LastUsedAt = table.Column<DateTime>(type: "TEXT", nullable: true),
                    FailureCount = table.Column<int>(type: "INTEGER", nullable: false),
                    MaxFailures = table.Column<int>(type: "INTEGER", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SpotdlKeys", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_SpotdlDownloads_Status",
                table: "SpotdlDownloads",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "IX_SpotdlDownloads_UserId",
                table: "SpotdlDownloads",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_SpotdlKeys_IsActive",
                table: "SpotdlKeys",
                column: "IsActive");

            migrationBuilder.CreateIndex(
                name: "IX_SpotdlKeys_Service",
                table: "SpotdlKeys",
                column: "Service");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "SpotdlDownloads");

            migrationBuilder.DropTable(
                name: "SpotdlKeys");
        }
    }
}
