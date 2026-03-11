using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using WatchNexus.Domain.Entities;
using WatchNexus.Domain.Interfaces;

namespace WatchNexus.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class UsersController : ControllerBase
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly IAuthService _authService;
    private readonly ILogger<UsersController> _logger;

    public UsersController(IUnitOfWork unitOfWork, IAuthService authService, ILogger<UsersController> logger)
    {
        _unitOfWork = unitOfWork;
        _authService = authService;
        _logger = logger;
    }

    private Guid GetCurrentUserId()
    {
        var claim = User.FindFirst(ClaimTypes.NameIdentifier) ?? User.FindFirst("sub");
        return Guid.Parse(claim?.Value ?? throw new UnauthorizedAccessException());
    }

    [HttpGet("me")]
    public async Task<IActionResult> GetCurrentUser(CancellationToken ct)
    {
        var userId = GetCurrentUserId();
        var user = await _unitOfWork.Users.GetByIdAsync(userId, ct);
        if (user == null)
            return NotFound();

        return Ok(MapToDto(user));
    }

    [HttpPut("me")]
    public async Task<IActionResult> UpdateCurrentUser([FromBody] UpdateUserRequest request, CancellationToken ct)
    {
        var userId = GetCurrentUserId();
        var user = await _unitOfWork.Users.GetByIdAsync(userId, ct);
        if (user == null)
            return NotFound();

        if (!string.IsNullOrEmpty(request.Username) && request.Username != user.Username)
        {
            if (await _unitOfWork.Users.ExistsAsync(u => u.Username == request.Username && u.Id != userId, ct))
                return BadRequest(new { message = "Username already taken" });
            user.Username = request.Username;
        }

        user.AvatarUrl = request.AvatarUrl ?? user.AvatarUrl;
        user.PreferredLanguage = request.PreferredLanguage ?? user.PreferredLanguage;
        user.Theme = request.Theme ?? user.Theme;
        user.AutoPlayNext = request.AutoPlayNext ?? user.AutoPlayNext;
        user.SkipIntros = request.SkipIntros ?? user.SkipIntros;
        user.SkipCredits = request.SkipCredits ?? user.SkipCredits;

        await _unitOfWork.SaveChangesAsync(ct);
        return Ok(MapToDto(user));
    }

    [HttpPut("me/password")]
    public async Task<IActionResult> ChangePassword([FromBody] ChangePasswordRequest request, CancellationToken ct)
    {
        var userId = GetCurrentUserId();
        var user = await _unitOfWork.Users.GetByIdAsync(userId, ct);
        if (user == null)
            return NotFound();

        if (!_authService.VerifyPassword(request.CurrentPassword, user.PasswordHash))
            return BadRequest(new { message = "Current password is incorrect" });

        user.PasswordHash = _authService.HashPassword(request.NewPassword);
        await _unitOfWork.SaveChangesAsync(ct);

        return Ok(new { message = "Password changed successfully" });
    }

    [HttpGet]
    [Authorize(Roles = "Admin,SuperAdmin")]
    public async Task<IActionResult> GetAll(CancellationToken ct)
    {
        var users = await _unitOfWork.Users.GetAllAsync(ct);
        return Ok(users.Select(MapToDto));
    }

    [HttpDelete("{id}")]
    [Authorize(Roles = "Admin,SuperAdmin")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        var currentUserId = GetCurrentUserId();
        if (id == currentUserId)
            return BadRequest(new { message = "Cannot delete your own account" });

        var user = await _unitOfWork.Users.GetByIdAsync(id, ct);
        if (user == null)
            return NotFound();

        // Cascade delete related data
        var watchProgress = await _unitOfWork.WatchProgress.FindAsync(w => w.UserId == id, ct);
        await _unitOfWork.WatchProgress.DeleteRangeAsync(watchProgress, ct);

        var watchlist = await _unitOfWork.Watchlist.FindAsync(w => w.UserId == id, ct);
        await _unitOfWork.Watchlist.DeleteRangeAsync(watchlist, ct);

        var playlists = await _unitOfWork.Playlists.FindAsync(p => p.UserId == id, ct);
        foreach (var playlist in playlists)
        {
            var items = await _unitOfWork.PlaylistItems.FindAsync(i => i.PlaylistId == playlist.Id, ct);
            await _unitOfWork.PlaylistItems.DeleteRangeAsync(items, ct);
        }
        await _unitOfWork.Playlists.DeleteRangeAsync(playlists, ct);

        var tokens = await _unitOfWork.RefreshTokens.FindAsync(t => t.UserId == id, ct);
        await _unitOfWork.RefreshTokens.DeleteRangeAsync(tokens, ct);

        await _unitOfWork.Users.DeleteAsync(user, ct);
        await _unitOfWork.SaveChangesAsync(ct);

        return NoContent();
    }

    private static object MapToDto(User u) => new
    {
        id = u.Id,
        email = u.Email,
        username = u.Username,
        role = u.Role.ToString().ToLower(),
        is_active = u.IsActive,
        avatar_url = u.AvatarUrl,
        preferred_language = u.PreferredLanguage,
        theme = u.Theme,
        auto_play_next = u.AutoPlayNext,
        skip_intros = u.SkipIntros,
        skip_credits = u.SkipCredits,
        last_login_at = u.LastLoginAt,
        created_at = u.CreatedAt
    };
}

public record UpdateUserRequest(
    string? Username,
    string? AvatarUrl,
    string? PreferredLanguage,
    string? Theme,
    bool? AutoPlayNext,
    bool? SkipIntros,
    bool? SkipCredits
);

public record ChangePasswordRequest(string CurrentPassword, string NewPassword);
