using System.Security.Claims;
using Microsoft.AspNetCore.Mvc;

namespace WatchNexus.Core.Controllers;

static class ControllerHelpers
{
    public static string UserId(this ControllerBase c) =>
        c.User.FindFirstValue(ClaimTypes.NameIdentifier) ?? "";

    public static HttpClient Http(this ControllerBase c) =>
        c.HttpContext.RequestServices.GetRequiredService<IHttpClientFactory>().CreateClient();
}
