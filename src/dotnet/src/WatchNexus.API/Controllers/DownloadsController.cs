using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using WatchNexus.Domain.Entities;
using WatchNexus.Domain.Enums;
using WatchNexus.Domain.Interfaces;

namespace WatchNexus.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class DownloadsController : ControllerBase
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly ILogger<DownloadsController> _logger;

    public DownloadsController(IUnitOfWork unitOfWork, ILogger<DownloadsController> logger)
    {
        _unitOfWork = unitOfWork;
        _logger = logger;
    }

    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] string? status, CancellationToken ct)
    {
        var downloads = await _unitOfWork.Downloads.GetAllAsync(ct);
        
        if (!string.IsNullOrEmpty(status) && Enum.TryParse<DownloadStatus>(status, true, out var s))
            downloads = downloads.Where(d => d.Status == s);

        return Ok(downloads.OrderByDescending(d => d.CreatedAt).Select(MapToDto));
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetById(Guid id, CancellationToken ct)
    {
        var download = await _unitOfWork.Downloads.GetByIdAsync(id, ct);
        if (download == null) return NotFound();
        return Ok(MapToDto(download));
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateDownloadRequest request, CancellationToken ct)
    {
        var download = new Download
        {
            Name = request.Name,
            MagnetUri = request.MagnetUri,
            InfoHash = request.InfoHash,
            SavePath = request.SavePath ?? "/downloads",
            Status = DownloadStatus.Queued,
            MediaRequestId = request.MediaRequestId
        };

        await _unitOfWork.Downloads.AddAsync(download, ct);
        await _unitOfWork.SaveChangesAsync(ct);

        _logger.LogInformation("Download queued: {Name}", download.Name);
        return CreatedAtAction(nameof(GetById), new { id = download.Id }, MapToDto(download));
    }

    [HttpPost("{id}/pause")]
    public async Task<IActionResult> Pause(Guid id, CancellationToken ct)
    {
        var download = await _unitOfWork.Downloads.GetByIdAsync(id, ct);
        if (download == null) return NotFound();

        download.Status = DownloadStatus.Paused;
        await _unitOfWork.SaveChangesAsync(ct);
        return Ok(MapToDto(download));
    }

    [HttpPost("{id}/resume")]
    public async Task<IActionResult> Resume(Guid id, CancellationToken ct)
    {
        var download = await _unitOfWork.Downloads.GetByIdAsync(id, ct);
        if (download == null) return NotFound();

        download.Status = DownloadStatus.Downloading;
        await _unitOfWork.SaveChangesAsync(ct);
        return Ok(MapToDto(download));
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(Guid id, [FromQuery] bool deleteFiles = false, CancellationToken ct = default)
    {
        var download = await _unitOfWork.Downloads.GetByIdAsync(id, ct);
        if (download == null) return NotFound();

        await _unitOfWork.Downloads.DeleteAsync(download, ct);
        await _unitOfWork.SaveChangesAsync(ct);

        _logger.LogInformation("Download deleted: {Id}, deleteFiles: {DeleteFiles}", id, deleteFiles);
        return NoContent();
    }

    [HttpGet("stats")]
    public async Task<IActionResult> GetStats(CancellationToken ct)
    {
        var downloads = await _unitOfWork.Downloads.GetAllAsync(ct);
        var list = downloads.ToList();

        return Ok(new
        {
            total = list.Count,
            downloading = list.Count(d => d.Status == DownloadStatus.Downloading),
            queued = list.Count(d => d.Status == DownloadStatus.Queued),
            completed = list.Count(d => d.Status == DownloadStatus.Completed),
            paused = list.Count(d => d.Status == DownloadStatus.Paused),
            failed = list.Count(d => d.Status == DownloadStatus.Failed),
            total_download_speed = list.Where(d => d.Status == DownloadStatus.Downloading).Sum(d => d.DownloadSpeed),
            total_upload_speed = list.Where(d => d.Status == DownloadStatus.Downloading).Sum(d => d.UploadSpeed)
        });
    }

    private static object MapToDto(Download d) => new
    {
        id = d.Id,
        name = d.Name,
        info_hash = d.InfoHash,
        save_path = d.SavePath,
        status = d.Status.ToString().ToLower(),
        progress = d.Progress,
        total_size = d.TotalSize,
        downloaded_size = d.DownloadedSize,
        uploaded_size = d.UploadedSize,
        download_speed = d.DownloadSpeed,
        upload_speed = d.UploadSpeed,
        seeds = d.Seeds,
        peers = d.Peers,
        ratio = d.Ratio,
        error = d.ErrorMessage,
        completed_at = d.CompletedAt,
        created_at = d.CreatedAt
    };
}

public record CreateDownloadRequest(string Name, string? MagnetUri, string? InfoHash, string? SavePath, Guid? MediaRequestId);
