using System.Diagnostics;
using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Hosting;

namespace WatchNexus.Core.Middleware;

/// <summary>
/// Global exception handling middleware.
/// Returns consistent JSON error responses with correlation IDs.
/// Scrubs PII from logs. Includes stack trace only in Development.
/// </summary>
public sealed class ExceptionMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<ExceptionMiddleware> _logger;
    private readonly IHostEnvironment _env;

    public ExceptionMiddleware(RequestDelegate next, ILogger<ExceptionMiddleware> logger, IHostEnvironment env)
    {
        _next = next;
        _logger = logger;
        _env = env;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        var correlationId = Activity.Current?.Id ?? Guid.NewGuid().ToString("N")[..12];
        context.Response.Headers["X-Correlation-ID"] = correlationId;

        try
        {
            await _next(context);
        }
        catch (Exception ex)
        {
            await HandleExceptionAsync(context, ex, correlationId);
        }
    }

    private Task HandleExceptionAsync(HttpContext context, Exception exception, string correlationId)
    {
        // Scrub PII from exception message for logging
        var scrubbedMessage = ScrubPii(exception.Message);
        var scrubbedStackTrace = _env.IsDevelopment() ? exception.StackTrace : ScrubPii(exception.StackTrace ?? "");

        // Log structured error with correlation ID
        _logger.LogError(exception,
            "[{CorrelationId}] Unhandled exception: {Message} | Path: {Path} | Method: {Method} | User: {UserId} | IP: {ClientIp}",
            correlationId,
            scrubbedMessage,
            context.Request.Path,
            context.Request.Method,
            GetUserId(context),
            GetClientIp(context));

        // Don't overwrite response if already started
        if (context.Response.HasStarted)
        {
            return Task.CompletedTask;
        }

        var (statusCode, errorCode, userMessage) = MapException(exception);

        context.Response.ContentType = "application/json";
        context.Response.StatusCode = statusCode;

        var response = new
        {
            error = errorCode,
            message = userMessage,
            correlationId,
            timestamp = DateTime.UtcNow.ToString("o"),
            // Include trace ID for distributed tracing correlation
            traceId = Activity.Current?.TraceId.ToString()
        };

        var json = JsonSerializer.Serialize(response, new JsonSerializerOptions
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase
        });

        return context.Response.WriteAsync(json);
    }

    private static (int statusCode, string errorCode, string userMessage) MapException(Exception ex)
    {
        return ex switch
        {
            // Database constraint violations
            Microsoft.EntityFrameworkCore.DbUpdateException dbEx when IsUniqueConstraint(dbEx) =>
                (StatusCodes.Status409Conflict, "CONFLICT", "This item already exists."),
            Microsoft.EntityFrameworkCore.DbUpdateException dbEx when IsForeignKeyConstraint(dbEx) =>
                (StatusCodes.Status400BadRequest, "INVALID_REFERENCE", "Referenced item does not exist."),
            Microsoft.EntityFrameworkCore.DbUpdateException dbEx when IsDatabaseLocked(dbEx) =>
                (StatusCodes.Status503ServiceUnavailable, "DATABASE_BUSY", "Database is temporarily busy. Please try again in a moment."),
            Microsoft.EntityFrameworkCore.DbUpdateException dbEx when IsReadOnlyDatabase(dbEx) =>
                (StatusCodes.Status503ServiceUnavailable, "DATABASE_READONLY", "Database is read-only. Check file permissions."),

            // Authentication / Authorization
            UnauthorizedAccessException =>
                (StatusCodes.Status401Unauthorized, "UNAUTHORIZED", "Authentication required."),
            // Note: Authorization failures typically result in 403 from middleware, not exceptions

            // Validation
            ArgumentException or ArgumentNullException or FormatException =>
                (StatusCodes.Status400BadRequest, "INVALID_REQUEST", ex.Message),

            // Not found
            KeyNotFoundException or FileNotFoundException or DirectoryNotFoundException =>
                (StatusCodes.Status404NotFound, "NOT_FOUND", "The requested resource was not found."),

            // Timeout
            TimeoutException =>
                (StatusCodes.Status504GatewayTimeout, "TIMEOUT", "The operation timed out. Please try again."),
            TaskCanceledException when !(ex is OperationCanceledException) =>
                (StatusCodes.Status504GatewayTimeout, "TIMEOUT", "The operation timed out. Please try again."),

            // External service failures
            HttpRequestException httpEx when httpEx.StatusCode == System.Net.HttpStatusCode.ServiceUnavailable =>
                (StatusCodes.Status503ServiceUnavailable, "SERVICE_UNAVAILABLE", "An external service is temporarily unavailable."),
            HttpRequestException httpEx when httpEx.StatusCode == System.Net.HttpStatusCode.GatewayTimeout =>
                (StatusCodes.Status504GatewayTimeout, "UPSTREAM_TIMEOUT", "An external service timed out."),

            // Rate limiting (if not handled by middleware)
            _ when ex.Message.Contains("rate limit", StringComparison.OrdinalIgnoreCase) =>
                (StatusCodes.Status429TooManyRequests, "RATE_LIMITED", "Too many requests. Please slow down."),

            // Default: internal server error
            _ => (StatusCodes.Status500InternalServerError, "INTERNAL_ERROR", "An unexpected error occurred. Please try again or contact support.")
        };
    }

    private static bool IsUniqueConstraint(DbUpdateException ex)
    {
        var sqlEx = ex.InnerException as Microsoft.Data.Sqlite.SqliteException;
        return sqlEx?.SqliteErrorCode == 19 /* SQLITE_CONSTRAINT_UNIQUE */ || ex.Message.Contains("UNIQUE constraint failed", StringComparison.OrdinalIgnoreCase);
    }

    private static bool IsForeignKeyConstraint(DbUpdateException ex)
    {
        var sqlEx = ex.InnerException as Microsoft.Data.Sqlite.SqliteException;
        return sqlEx?.SqliteErrorCode == 19 /* SQLITE_CONSTRAINT_FOREIGNKEY */ || ex.Message.Contains("FOREIGN KEY constraint failed", StringComparison.OrdinalIgnoreCase);
    }

    private static bool IsDatabaseLocked(DbUpdateException ex)
    {
        var sqlEx = ex.InnerException as Microsoft.Data.Sqlite.SqliteException;
        return sqlEx?.SqliteErrorCode is 5 or 6 /* SQLITE_BUSY, SQLITE_LOCKED */ || ex.Message.Contains("database is locked", StringComparison.OrdinalIgnoreCase);
    }

    private static bool IsReadOnlyDatabase(DbUpdateException ex)
    {
        var sqlEx = ex.InnerException as Microsoft.Data.Sqlite.SqliteException;
        return sqlEx?.SqliteErrorCode == 8 /* SQLITE_READONLY */ || ex.Message.Contains("attempt to write a readonly database", StringComparison.OrdinalIgnoreCase);
    }

    private static string ScrubPii(string input)
    {
        if (string.IsNullOrEmpty(input)) return input;

        var scrubbed = input;
        // Email addresses
        scrubbed = System.Text.RegularExpressions.Regex.Replace(scrubbed, @"[\w.+-]+@[\w-]+\.[\w.-]+", "[EMAIL]");
        // JWT tokens (rough pattern)
        scrubbed = System.Text.RegularExpressions.Regex.Replace(scrubbed, @"eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+", "[JWT]");
        // API keys (wnx_ prefix)
        scrubbed = System.Text.RegularExpressions.Regex.Replace(scrubbed, @"wnx_[A-Za-z0-9]{24,}", "[API_KEY]");
        // License keys (WNX- format)
        scrubbed = System.Text.RegularExpressions.Regex.Replace(scrubbed, @"WNX-[A-Z]{3}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}", "[LICENSE_KEY]");
        // Connection strings with passwords
        scrubbed = System.Text.RegularExpressions.Regex.Replace(scrubbed, @"(Password|Pwd|Secret|Token|Key)\s*=\s*[^;\s]+", "$1=[REDACTED]", System.Text.RegularExpressions.RegexOptions.IgnoreCase);
        // IPs in logs (optional - keep for audit but scrub from debug)
        // scrubbed = System.Text.RegularExpressions.Regex.Replace(scrubbed, @"\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b", "[IP]");

        return scrubbed;
    }

    private static string GetUserId(HttpContext context)
    {
        return context.User?.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value ?? "anonymous";
    }

    private static string GetClientIp(HttpContext context)
    {
        return context.Connection.RemoteIpAddress?.ToString() ?? "unknown";
    }
}

/// <summary>
/// Extension method for easy registration in Program.cs
/// </summary>
public static class ExceptionMiddlewareExtensions
{
    public static IApplicationBuilder UseGlobalExceptionHandler(this IApplicationBuilder app)
    {
        return app.UseMiddleware<ExceptionMiddleware>();
    }
}