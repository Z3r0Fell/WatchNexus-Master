using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace WatchNexus.Core.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddNewFeatureEntities : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "MediaRequests",
                columns: table => new
                {
                    Id = table.Column<string>(type: "TEXT", nullable: false),
                    UserId = table.Column<string>(type: "TEXT", nullable: false),
                    Username = table.Column<string>(type: "TEXT", nullable: false),
                    TmdbId = table.Column<int>(type: "INTEGER", nullable: false),
                    MediaType = table.Column<string>(type: "TEXT", nullable: false),
                    Title = table.Column<string>(type: "TEXT", nullable: false),
                    PosterUrl = table.Column<string>(type: "TEXT", nullable: true),
                    Overview = table.Column<string>(type: "TEXT", nullable: true),
                    Status = table.Column<string>(type: "TEXT", nullable: false),
                    AdminNotes = table.Column<string>(type: "TEXT", nullable: true),
                    ReviewedBy = table.Column<string>(type: "TEXT", nullable: true),
                    RequestedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                    ReviewedAt = table.Column<DateTime>(type: "TEXT", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_MediaRequests", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "NotificationLogs",
                columns: table => new
                {
                    Id = table.Column<string>(type: "TEXT", nullable: false),
                    EventType = table.Column<string>(type: "TEXT", nullable: false),
                    Channel = table.Column<string>(type: "TEXT", nullable: false),
                    Message = table.Column<string>(type: "TEXT", nullable: false),
                    Status = table.Column<string>(type: "TEXT", nullable: false),
                    Error = table.Column<string>(type: "TEXT", nullable: true),
                    SentAt = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_NotificationLogs", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "PlayEvents",
                columns: table => new
                {
                    Id = table.Column<string>(type: "TEXT", nullable: false),
                    UserId = table.Column<string>(type: "TEXT", nullable: false),
                    MediaType = table.Column<string>(type: "TEXT", nullable: false),
                    TmdbId = table.Column<string>(type: "TEXT", nullable: true),
                    Title = table.Column<string>(type: "TEXT", nullable: false),
                    DurationSeconds = table.Column<int>(type: "INTEGER", nullable: false),
                    DeviceType = table.Column<string>(type: "TEXT", nullable: true),
                    Quality = table.Column<string>(type: "TEXT", nullable: true),
                    StartedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                    EndedAt = table.Column<DateTime>(type: "TEXT", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PlayEvents", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "TranscodeJobs",
                columns: table => new
                {
                    Id = table.Column<string>(type: "TEXT", nullable: false),
                    UserId = table.Column<string>(type: "TEXT", nullable: false),
                    SourcePath = table.Column<string>(type: "TEXT", nullable: false),
                    OutputPath = table.Column<string>(type: "TEXT", nullable: true),
                    Profile = table.Column<string>(type: "TEXT", nullable: false),
                    Status = table.Column<string>(type: "TEXT", nullable: false),
                    Progress = table.Column<double>(type: "REAL", nullable: false),
                    SourceSize = table.Column<long>(type: "INTEGER", nullable: true),
                    OutputSize = table.Column<long>(type: "INTEGER", nullable: true),
                    Resolution = table.Column<string>(type: "TEXT", nullable: true),
                    Codec = table.Column<string>(type: "TEXT", nullable: true),
                    Error = table.Column<string>(type: "TEXT", nullable: true),
                    SettingsJson = table.Column<string>(type: "TEXT", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                    StartedAt = table.Column<DateTime>(type: "TEXT", nullable: true),
                    CompletedAt = table.Column<DateTime>(type: "TEXT", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TranscodeJobs", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_MediaRequests_Status",
                table: "MediaRequests",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "IX_MediaRequests_UserId",
                table: "MediaRequests",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_NotificationLogs_SentAt",
                table: "NotificationLogs",
                column: "SentAt");

            migrationBuilder.CreateIndex(
                name: "IX_PlayEvents_StartedAt",
                table: "PlayEvents",
                column: "StartedAt");

            migrationBuilder.CreateIndex(
                name: "IX_PlayEvents_UserId",
                table: "PlayEvents",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_TranscodeJobs_Status",
                table: "TranscodeJobs",
                column: "Status");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "MediaRequests");

            migrationBuilder.DropTable(
                name: "NotificationLogs");

            migrationBuilder.DropTable(
                name: "PlayEvents");

            migrationBuilder.DropTable(
                name: "TranscodeJobs");
        }
    }
}
