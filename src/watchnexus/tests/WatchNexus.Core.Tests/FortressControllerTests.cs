using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.EntityFrameworkCore;
using Moq;
using WatchNexus.Core.Controllers;
using WatchNexus.Core.Data;

namespace WatchNexus.Core.Tests;

public class FortressControllerTests
{
    private readonly AppDbContext _db;
    private readonly FortressController _controller;

    public FortressControllerTests()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase($"FortressTest_{Guid.NewGuid()}")
            .Options;
        _db = new AppDbContext(options);

        _controller = new FortressController(_db);

        var user = new ClaimsPrincipal(new ClaimsIdentity(new[]
        {
            new Claim(ClaimTypes.NameIdentifier, "test-user"),
            new Claim(ClaimTypes.Role, "admin")
        }, "TestAuth"));
        _controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext { User = user }
        };
    }

    [Fact]
    public async Task Status_ReturnsIntegrityStatus()
    {
        var result = await _controller.Status();

        var okResult = Assert.IsType<OkObjectResult>(result);
        var value = okResult.Value;
        var props = value!.GetType().GetProperties();
        
        Assert.Equal("1.0", props.First(p => p.Name == "fortress_version").GetValue(value));
        Assert.Equal("1.0.4", props.First(p => p.Name == "app_version").GetValue(value));
        Assert.NotNull(props.First(p => p.Name == "integrity_valid").GetValue(value));
        Assert.NotNull(props.First(p => p.Name == "protections").GetValue(value));
    }

    [Fact]
    public async Task Reseal_CreatesNewManifest()
    {
        var result = await _controller.Reseal();

        var okResult = Assert.IsType<OkObjectResult>(result);
        var value = okResult.Value;
        var props = value!.GetType().GetProperties();
        Assert.True((bool)props.First(p => p.Name == "success").GetValue(value)!);
        Assert.Contains("re-sealed", props.First(p => p.Name == "message").GetValue(value)!.ToString()!);
    }

    [Fact]
    public async Task Verify_ReturnsValidationResult()
    {
        var result = await _controller.Verify();

        var okResult = Assert.IsType<OkObjectResult>(result);
        var value = okResult.Value;
        var props = value!.GetType().GetProperties();
        Assert.NotNull(props.First(p => p.Name == "valid").GetValue(value));
        Assert.NotNull(props.First(p => p.Name == "violations").GetValue(value));
        Assert.NotNull(props.First(p => p.Name == "checked_at").GetValue(value));
    }

    [Fact]
    public async Task VerifyIntegrity_FirstRun_SealsAndReturnsValid()
    {
        var (valid, violations) = await FortressIntegrity.VerifyIntegrity(_db);

        Assert.True(valid);
        Assert.Empty(violations);
        
        var manifest = await _db.Settings.FirstOrDefaultAsync(s => s.Key == "fortress_manifest" && s.UserId == "");
        Assert.NotNull(manifest);
        Assert.NotNull(manifest.Value);
    }

    [Fact]
    public async Task VerifyIntegrity_DetectsMissingFiles()
    {
        await FortressIntegrity.SealBuild(_db);
        
        var manifest = await _db.Settings.FirstOrDefaultAsync(s => s.Key == "fortress_manifest" && s.UserId == "");
        Assert.NotNull(manifest);
        
        var doc = JsonDocument.Parse(manifest!.Value!).RootElement;
        var hashes = doc.GetProperty("file_hashes");
        var firstFile = hashes.EnumerateObject().First().Name;
        
        var fakeFile = Path.Combine(AppContext.BaseDirectory, firstFile);
        if (File.Exists(fakeFile))
        {
            File.Delete(fakeFile);
        }

        var (valid, violations) = await FortressIntegrity.VerifyIntegrity(_db);

        Assert.False(valid);
        Assert.Contains(violations, v => v.StartsWith("MISSING:"));
    }

    [Fact]
    public async Task VerifyIntegrity_DetectsTamperedFiles()
    {
        await FortressIntegrity.SealBuild(_db);
        
        var manifest = await _db.Settings.FirstOrDefaultAsync(s => s.Key == "fortress_manifest" && s.UserId == "");
        Assert.NotNull(manifest);
        
        var doc = JsonDocument.Parse(manifest!.Value!).RootElement;
        var hashes = doc.GetProperty("file_hashes");
        var firstFile = hashes.EnumerateObject().First().Name;
        var filePath = Path.Combine(AppContext.BaseDirectory, firstFile);
        
        if (File.Exists(filePath))
        {
            var originalContent = await File.ReadAllBytesAsync(filePath);
            await File.WriteAllBytesAsync(filePath, System.Text.Encoding.UTF8.GetBytes("TAMPERED CONTENT"));
            
            var (valid, violations) = await FortressIntegrity.VerifyIntegrity(_db);
            
            await File.WriteAllBytesAsync(filePath, originalContent);
            
            Assert.False(valid);
            Assert.Contains(violations, v => v.StartsWith("TAMPERED:"));
        }
    }

    [Fact]
    public void ProtectedRoutes_ContainsAllProModules()
    {
        foreach (var module in CellarController.TierModules["pro"])
        {
            Assert.True(FortressFilter.ProtectedRoutes.ContainsKey(module), 
                $"Module '{module}' should be in ProtectedRoutes");
            Assert.Equal("pro", FortressFilter.ProtectedRoutes[module]);
        }
    }

    [Fact]
    public void ProtectedRoutes_ContainsAllUltraModules()
    {
        foreach (var module in CellarController.TierModules["ultra"])
        {
            Assert.True(FortressFilter.ProtectedRoutes.ContainsKey(module), 
                $"Module '{module}' should be in ProtectedRoutes");
            Assert.Equal("ultra", FortressFilter.ProtectedRoutes[module]);
        }
    }

    [Fact]
    public void GadgetRoutes_MapsToValidCodenames()
    {
        foreach (var kvp in FortressFilter.GadgetRoutes)
        {
            Assert.True(FortressFilter.ProtectedRoutes.ContainsKey(kvp.Value),
                $"Gadget route '{kvp.Key}' maps to codename '{kvp.Value}' which is not in ProtectedRoutes");
        }
    }

    [Fact]
    public async Task FortressFilter_BlocksProModuleOnStandardTier()
    {
        var filter = new FortressFilter(_db);
        var httpContext = new DefaultHttpContext
        {
            Request = { Path = "/api/compote/indexers" }
        };
        
        var actionExecuted = false;
        var actionDelegate = new ActionExecutionDelegate(async () => 
        { 
            actionExecuted = true; 
            return; 
        });
        
        var context = new ActionExecutingContext(
            new ActionContext { HttpContext = httpContext },
            new List<IFilterMetadata>(),
            new Dictionary<string, object?>(),
            Mock.Of<Controller>()
        );
        
        await filter.OnActionExecutionAsync(context, actionDelegate);
        
        Assert.False(actionExecuted);
        Assert.NotNull(context.Result);
        var jsonResult = Assert.IsType<JsonResult>(context.Result);
        Assert.Equal(403, jsonResult.StatusCode);
        var value = jsonResult.Value;
        var props = value!.GetType().GetProperties();
        Assert.Equal("FORTRESS_TIER_LOCKED", props.First(p => p.Name == "error").GetValue(value));
    }

    [Fact]
    public async Task FortressFilter_AllowsProModuleOnProTier()
    {
        var serial = "WNX-PRO-AAAA-BBBB-CCCC";
        var hash = CellarController.ComputeHash(serial);
        var licenseJson = JsonSerializer.Serialize(new { tier = "pro", serial, hash });
        
        _db.Settings.Add(new AppSetting { Key = "cellar_license", UserId = "", Value = licenseJson });
        await _db.SaveChangesAsync();

        var filter = new FortressFilter(_db);
        var httpContext = new DefaultHttpContext
        {
            Request = { Path = "/api/compote/indexers" }
        };
        
        var actionExecuted = false;
        var actionDelegate = new ActionExecutionDelegate(async () => 
        { 
            actionExecuted = true; 
            return; 
        });
        
        var context = new ActionExecutingContext(
            new ActionContext { HttpContext = httpContext },
            new List<IFilterMetadata>(),
            new Dictionary<string, object?>(),
            Mock.Of<Controller>()
        );
        
        await filter.OnActionExecutionAsync(context, actionDelegate);
        
        Assert.True(actionExecuted);
        Assert.Null(context.Result);
    }

    [Fact]
    public async Task FortressFilter_AllowsUltraModuleOnUltraTier()
    {
        var serial = "WNX-ULT-AAAA-BBBB-CCCC";
        var hash = CellarController.ComputeHash(serial);
        var licenseJson = JsonSerializer.Serialize(new { tier = "ultra", serial, hash });
        
        _db.Settings.Add(new AppSetting { Key = "cellar_license", UserId = "", Value = licenseJson });
        await _db.SaveChangesAsync();

        var filter = new FortressFilter(_db);
        var httpContext = new DefaultHttpContext
        {
            Request = { Path = "/api/crucible/jobs" }
        };
        
        var actionExecuted = false;
        var actionDelegate = new ActionExecutionDelegate(async () => 
        { 
            actionExecuted = true; 
            return; 
        });
        
        var context = new ActionExecutingContext(
            new ActionContext { HttpContext = httpContext },
            new List<IFilterMetadata>(),
            new Dictionary<string, object?>(),
            Mock.Of<Controller>()
        );
        
        await filter.OnActionExecutionAsync(context, actionDelegate);
        
        Assert.True(actionExecuted);
        Assert.Null(context.Result);
    }

    [Fact]
    public async Task FortressFilter_ExemptsCrucibleFfmpegStatus()
    {
        var filter = new FortressFilter(_db);
        var httpContext = new DefaultHttpContext
        {
            Request = { Path = "/api/crucible/ffmpeg-status" }
        };
        
        var actionExecuted = false;
        var actionDelegate = new ActionExecutionDelegate(async () => 
        { 
            actionExecuted = true; 
            return; 
        });
        
        var context = new ActionExecutingContext(
            new ActionContext { HttpContext = httpContext },
            new List<IFilterMetadata>(),
            new Dictionary<string, object?>(),
            Mock.Of<Controller>()
        );
        
        await filter.OnActionExecutionAsync(context, actionDelegate);
        
        Assert.True(actionExecuted);
        Assert.Null(context.Result);
    }

    [Fact]
    public async Task FortressFilter_GadgetRoute_BlocksProModuleOnStandardTier()
    {
        var filter = new FortressFilter(_db);
        var httpContext = new DefaultHttpContext
        {
            Request = { Path = "/api/gadgets/synapse-admin/status" }
        };
        
        var actionExecuted = false;
        var actionDelegate = new ActionExecutionDelegate(async () => 
        { 
            actionExecuted = true; 
            return; 
        });
        
        var context = new ActionExecutingContext(
            new ActionContext { HttpContext = httpContext },
            new List<IFilterMetadata>(),
            new Dictionary<string, object?>(),
            Mock.Of<Controller>()
        );
        
        await filter.OnActionExecutionAsync(context, actionDelegate);
        
        Assert.False(actionExecuted);
        Assert.NotNull(context.Result);
        var jsonResult = Assert.IsType<JsonResult>(context.Result);
        Assert.Equal(403, jsonResult.StatusCode);
    }

    [Fact]
    public void GetRequiredTier_ChecksModuleRegistryFirst()
    {
        var module = new ModuleManifest
        {
            Codename = "test-module",
            Tier = "pro",
            ApiRoutePrefix = "test"
        };
        ModuleRegistry.Register(module);

        var filter = new FortressFilter(_db);
        var tierMethod = typeof(FortressFilter).GetMethod("GetRequiredTier", System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Instance);
        var tier = tierMethod!.Invoke(filter, new object[] { "test-module" });
        
        Assert.Equal("pro", tier);
    }
}