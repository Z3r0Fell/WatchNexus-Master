using System.Security.Claims;
using Microsoft.AspNetCore.Mvc;

namespace WatchNexus.Core.Controllers;

static class ControllerHelpers
{
    public static string UserId(this ControllerBase c) =>
        c.User.FindFirstValue(ClaimTypes.NameIdentifier) ?? "";

    /// <summary>Treats empty/whitespace config values as unset so `?? default` fallbacks apply.</summary>
    public static string? NullIfBlank(this string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value;

    public static HttpClient Http(this ControllerBase c) =>
        c.HttpContext.RequestServices.GetRequiredService<IHttpClientFactory>().CreateClient();
}
