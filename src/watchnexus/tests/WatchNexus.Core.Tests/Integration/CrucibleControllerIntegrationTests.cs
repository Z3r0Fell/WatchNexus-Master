using System.Net;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using WatchNexus.Core.Controllers;
using WatchNexus.Core.Data;
using WatchNexus.Shared;
using Xunit;

namespace WatchNexus.Core.Tests.Integration;

/// <summary>
/// Integration tests for CrucibleController (Media Processing / Transcoding)
/// Covers: /api/crucible/*
/// </summary>
public class CrucibleControllerIntegrationTests : IntegrationTestBase
    {
    public CrucibleControllerIntegrationTests() : base() { }


    #region Status & Profiles

    [Fact]
    public async Task GetStatus_ReturnsModuleInfo()
    {
        AuthenticateAsUser();
        await SeedLicenseAsync("ultra"); // Crucible is Ultra

        var response = await Client.GetAsync("/api/crucible/status");
        
        AssertJsonResponse(response);
        var json = await DeserializeResponseElement(response);
        Assert.Equal("crucible", json.GetProperty("module").GetString());
        Assert.Equal("active", json.GetProperty("status").GetString());
    }

    [Fact]
    public async Task GetProfiles_ReturnsBuiltInProfiles()
    {
        AuthenticateAsUser();
        await SeedLicenseAsync("ultra");

        var response = await Client.GetAsync("/api/crucible/profiles");
        
        AssertJsonResponse(response);
        var json = await DeserializeResponseElement(response);
        Assert.Equal(7, json.GetArrayLength());
        
        var ids = json.EnumerateArray().Select(x => x.GetProperty("id").GetString()).ToList();
        Assert.Contains("h265-default", ids);
        Assert.Contains("h265-quality", ids);
        Assert.Contains("h265-compact", ids);
        Assert.Contains("h264-compat", ids);
        Assert.Contains("extract-subs", ids);
        Assert.Contains("burn-subs", ids);
        Assert.Contains("audio-normalize", ids);
    }

    #endregion

    #region Transcode Jobs

    [Fact]
    public async Task SubmitJob_ValidInput_CreatesJob()
    {
        AuthenticateAsUser();
        await SeedLicenseAsync("ultra");

        // Create a test file
        var tempFile = Path.GetTempFileName();
        File.WriteAllText(tempFile, "fake video content");
        
        try
        {
            var body = JsonSerializer.Serialize(new { source_path = tempFile, profile = "h265-default" });
            var content = new StringContent(body, System.Text.Encoding.UTF8, "application/json");

            var response = await Client.PostAsync("/api/crucible/jobs", content);
            
            AssertJsonResponse(response);
            var json = await DeserializeResponseElement(response);
            Assert.NotNull(json.GetProperty("id").GetString());
            Assert.Equal("queued", json.GetProperty("status").GetString());
        }
        finally
        {
            File.Delete(tempFile);
        }
    }

    [Fact]
    public async Task SubmitJob_MissingSourcePath_Returns400()
    {
        AuthenticateAsUser();
        await SeedLicenseAsync("ultra");

        var body = JsonSerializer.Serialize(new { profile = "h265-default" });
        var content = new StringContent(body, System.Text.Encoding.UTF8, "application/json");

        var response = await Client.PostAsync("/api/crucible/jobs", content);
        
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task SubmitJob_OutsideAllowedPath_Returns400()
    {
        AuthenticateAsUser();
        await SeedLicenseAsync("ultra");

        var body = JsonSerializer.Serialize(new { source_path = "/etc/passwd", profile = "h265-default" });
        var content = new StringContent(body, System.Text.Encoding.UTF8, "application/json");

        var response = await Client.PostAsync("/api/crucible/jobs", content);
        
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task GetJobs_ReturnsPaginatedJobs()
    {
        AuthenticateAsUser();
        await SeedLicenseAsync("ultra");

        var tempFile = Path.GetTempFileName();
        File.WriteAllText(tempFile, "test");
        
        try
        {
            // Create a few jobs
            for (int i = 0; i < 3; i++)
            {
                var body = JsonSerializer.Serialize(new { source_path = tempFile, profile = "h265-default" });
                await Client.PostAsync("/api/crucible/jobs", new StringContent(body, System.Text.Encoding.UTF8, "application/json"));
            }

            var response = await Client.GetAsync("/api/crucible/jobs?limit=10");
            
            AssertJsonResponse(response);
            var json = await DeserializeResponseElement(response);
            Assert.Equal(3, json.GetArrayLength());
            
            // Check job structure
            var first = json[0];
            Assert.NotNull(first.GetProperty("id"));
            Assert.NotNull(first.GetProperty("source_path"));
            Assert.NotNull(first.GetProperty("profile"));
            Assert.NotNull(first.GetProperty("status"));
            Assert.NotNull(first.GetProperty("progress"));
            Assert.NotNull(first.GetProperty("created_at"));
        }
        finally
        {
            File.Delete(tempFile);
        }
    }

    [Fact]
    public async Task GetJobs_FilterByStatus_Works()
    {
        AuthenticateAsUser();
        await SeedLicenseAsync("ultra");

        var tempFile = Path.GetTempFileName();
        File.WriteAllText(tempFile, "test");
        
        try
        {
            var body = JsonSerializer.Serialize(new { source_path = tempFile, profile = "h265-default" });
            await Client.PostAsync("/api/crucible/jobs", new StringContent(body, System.Text.Encoding.UTF8, "application/json"));

            var response = await Client.GetAsync("/api/crucible/jobs?status=queued");
            
            AssertJsonResponse(response);
            var json = await DeserializeResponseElement(response);
            Assert.True(json.GetArrayLength() > 0);
            Assert.All(json.EnumerateArray(), j => Assert.Equal("queued", j.GetProperty("status").GetString()));
        }
        finally
        {
            File.Delete(tempFile);
        }
    }

    [Fact]
    public async Task GetJobById_Exists_ReturnsJob()
    {
        AuthenticateAsUser();
        await SeedLicenseAsync("ultra");

        var tempFile = Path.GetTempFileName();
        File.WriteAllText(tempFile, "test");
        
        try
        {
            var body = JsonSerializer.Serialize(new { source_path = tempFile, profile = "h265-default" });
            var createResponse = await Client.PostAsync("/api/crucible/jobs", new StringContent(body, System.Text.Encoding.UTF8, "application/json"));
            var created = await DeserializeResponseElement(createResponse);
            var jobId = created.GetProperty("id").GetString();

            var response = await Client.GetAsync($"/api/crucible/jobs/{jobId}");
            
            AssertJsonResponse(response);
            var json = await DeserializeResponseElement(response);
            Assert.Equal(jobId, json.GetProperty("id").GetString());
        }
        finally
        {
            File.Delete(tempFile);
        }
    }

    [Fact]
    public async Task GetJobById_NotFound_Returns404()
    {
        AuthenticateAsUser();
        await SeedLicenseAsync("ultra");

        var response = await Client.GetAsync("/api/crucible/jobs/nonexistent");
        
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task CancelJob_QueuedJob_RemovesJob()
    {
        AuthenticateAsUser();
        await SeedLicenseAsync("ultra");

        var tempFile = Path.GetTempFileName();
        File.WriteAllText(tempFile, "test");
        
        try
        {
            var body = JsonSerializer.Serialize(new { source_path = tempFile, profile = "h265-default" });
            var createResponse = await Client.PostAsync("/api/crucible/jobs", new StringContent(body, System.Text.Encoding.UTF8, "application/json"));
            var created = await DeserializeResponseElement(createResponse);
            var jobId = created.GetProperty("id").GetString();

            var response = await Client.DeleteAsync($"/api/crucible/jobs/{jobId}");
            
            AssertJsonResponse(response);
            var json = await DeserializeResponseElement(response);
            Assert.Equal("cancelled", json.GetProperty("status").GetString());

            // Verify removed
            var getResponse = await Client.GetAsync($"/api/crucible/jobs/{jobId}");
            Assert.Equal(HttpStatusCode.NotFound, getResponse.StatusCode);
        }
        finally
        {
            File.Delete(tempFile);
        }
    }

    [Fact]
    public async Task RetryJob_FailedJob_RequeuesJob()
    {
        AuthenticateAsUser();
        await SeedLicenseAsync("ultra");

        var tempFile = Path.GetTempFileName();
        File.WriteAllText(tempFile, "test");
        
        try
        {
            var body = JsonSerializer.Serialize(new { source_path = tempFile, profile = "h265-default" });
            var createResponse = await Client.PostAsync("/api/crucible/jobs", new StringContent(body, System.Text.Encoding.UTF8, "application/json"));
            var created = await DeserializeResponseElement(createResponse);
            var jobId = created.GetProperty("id").GetString();

            // Manually set to failed in DB
            var job = await DbContext.TranscodeJobs.FindAsync(jobId);
            job!.Status = "failed";
            job.Error = "Test error";
            await DbContext.SaveChangesAsync();

            var response = await Client.PostAsync($"/api/crucible/jobs/{jobId}/retry", null);
            
            AssertJsonResponse(response);
            var json = await DeserializeResponseElement(response);
            Assert.Equal("requeued", json.GetProperty("status").GetString());

            // Verify status reset
            var getResponse = await Client.GetAsync($"/api/crucible/jobs/{jobId}");
            var refreshed = await DeserializeResponseElement(getResponse);
            Assert.Equal("queued", refreshed.GetProperty("status").GetString());
        }
        finally
        {
            File.Delete(tempFile);
        }
    }

    #endregion

    #region FFprobe

    [Fact]
    public async Task ProbeFile_ValidFile_ReturnsProbeInfo()
    {
        AuthenticateAsUser();
        await SeedLicenseAsync("ultra");

        var tempFile = Path.GetTempFileName();
        File.WriteAllText(tempFile, "test");
        
        try
        {
            var body = JsonSerializer.Serialize(new { path = tempFile });
            var content = new StringContent(body, System.Text.Encoding.UTF8, "application/json");

            var response = await Client.PostAsync("/api/crucible/probe", content);
            
            // FFprobe not actually installed in test, so returns error object
            AssertJsonResponse(response);
            var json = await DeserializeResponseElement(response);
            Assert.NotNull(json.GetProperty("path"));
            Assert.NotNull(json.GetProperty("filename"));
            Assert.NotNull(json.GetProperty("size"));
            // ffprobe field will contain error since not installed
        }
        finally
        {
            File.Delete(tempFile);
        }
    }

    [Fact]
    public async Task ProbeFile_FileNotFound_Returns404()
    {
        AuthenticateAsUser();
        await SeedLicenseAsync("ultra");

        var body = JsonSerializer.Serialize(new { path = "/nonexistent/file.mp4" });
        var content = new StringContent(body, System.Text.Encoding.UTF8, "application/json");

        var response = await Client.PostAsync("/api/crucible/probe", content);
        
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task ProbeFile_OutsideAllowedPath_Returns400()
    {
        AuthenticateAsUser();
        await SeedLicenseAsync("ultra");

        var body = JsonSerializer.Serialize(new { path = "/etc/passwd" });
        var content = new StringContent(body, System.Text.Encoding.UTF8, "application/json");

        var response = await Client.PostAsync("/api/crucible/probe", content);
        
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    #endregion

    #region Stats

    [Fact]
    public async Task GetStats_ReturnsAggregatedStats()
    {
        AuthenticateAsUser();
        await SeedLicenseAsync("ultra");

        var tempFile = Path.GetTempFileName();
        File.WriteAllText(tempFile, "test");
        
        try
        {
            // Create some jobs
            for (int i = 0; i < 3; i++)
            {
                var body = JsonSerializer.Serialize(new { source_path = tempFile, profile = "h265-default" });
                await Client.PostAsync("/api/crucible/jobs", new StringContent(body, System.Text.Encoding.UTF8, "application/json"));
            }

            var response = await Client.GetAsync("/api/crucible/stats");
            
            AssertJsonResponse(response);
            var json = await DeserializeResponseElement(response);
            
            Assert.Equal(3, json.GetProperty("total_jobs").GetInt32());
            Assert.Equal(3, json.GetProperty("queued").GetInt32());
            Assert.Equal(0, json.GetProperty("processing").GetInt32());
            Assert.Equal(0, json.GetProperty("completed").GetInt32());
            Assert.Equal(0, json.GetProperty("failed").GetInt32());
        }
        finally
        {
            File.Delete(tempFile);
        }
    }

    #endregion

    #region FFmpeg Status (Exempt from Fortress)

    [Fact]
    public async Task GetFfmpegStatus_NoLicense_ReturnsStatus()
    {
        AuthenticateAsUser(); // Standard tier

        var response = await Client.GetAsync("/api/crucible/ffmpeg-status");
        
        AssertJsonResponse(response);
        var json = await DeserializeResponseElement(response);
        
        Assert.NotNull(json.GetProperty("ffmpeg_installed"));
        Assert.NotNull(json.GetProperty("ffprobe_installed"));
        Assert.NotNull(json.GetProperty("hw_accel"));
    }

    #endregion

    #region Idempotency

    [Fact]
    public async Task SubmitJob_RepeatedSameFile_CreatesSeparateJobs()
    {
        AuthenticateAsUser();
        await SeedLicenseAsync("ultra");

        var tempFile = Path.GetTempFileName();
        File.WriteAllText(tempFile, "test");
        
        try
        {
            var body = JsonSerializer.Serialize(new { source_path = tempFile, profile = "h265-default" });
            var content = new StringContent(body, System.Text.Encoding.UTF8, "application/json");

            await Client.PostAsync("/api/crucible/jobs", content);
            await Client.PostAsync("/api/crucible/jobs", content);

            var response = await Client.GetAsync("/api/crucible/jobs");
            var json = await DeserializeResponseElement(response);
            Assert.Equal(2, json.GetArrayLength());
        }
        finally
        {
            File.Delete(tempFile);
        }
    }

    #endregion
}