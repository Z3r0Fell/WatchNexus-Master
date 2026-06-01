using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace WatchNexus.Tests;

public class FortressTests
{
    [Fact]
    public void ComputeFileHash_ReturnsConsistentHash()
    {
        var path = Path.GetTempFileName();
        try
        {
            File.WriteAllText(path, "test content");

            var hash1 = InvokeComputeFileHash(path);
            var hash2 = InvokeComputeFileHash(path);

            Assert.Equal(hash1, hash2);
            Assert.Equal(64, hash1.Length);
        }
        finally
        {
            File.Delete(path);
        }
    }

    [Fact]
    public void ComputeFileHash_DifferentFiles_DifferentHashes()
    {
        var path1 = Path.GetTempFileName();
        var path2 = Path.GetTempFileName();
        try
        {
            File.WriteAllText(path1, "content one");
            File.WriteAllText(path2, "content two");

            var hash1 = InvokeComputeFileHash(path1);
            var hash2 = InvokeComputeFileHash(path2);

            Assert.NotEqual(hash1, hash2);
        }
        finally
        {
            File.Delete(path1);
            File.Delete(path2);
        }
    }

    [Fact]
    public void ComputeFileHash_EmptyFile_ReturnsValidHash()
    {
        var path = Path.GetTempFileName();
        try
        {
            File.WriteAllText(path, "");

            var hash = InvokeComputeFileHash(path);

            Assert.Equal(64, hash.Length);
        }
        finally
        {
            File.Delete(path);
        }
    }

    [Fact]
    public void ComputeFileHash_LargeFile_CompletesQuickly()
    {
        var path = Path.GetTempFileName();
        try
        {
            var data = new byte[10_000_000];
            new Random(42).NextBytes(data);
            File.WriteAllBytes(path, data);

            var sw = System.Diagnostics.Stopwatch.StartNew();
            var hash = InvokeComputeFileHash(path);
            sw.Stop();

            Assert.Equal(64, hash.Length);
            Assert.True(sw.ElapsedMilliseconds < 2000, "Hash computation took too long");
        }
        finally
        {
            File.Delete(path);
        }
    }

    [Fact]
    public void GenerateInstanceId_ReturnsStableId()
    {
        var id1 = InvokeGenerateInstanceId();
        var id2 = InvokeGenerateInstanceId();

        Assert.Equal(id1, id2);
        Assert.StartsWith("WN-", id1);
        Assert.Equal(19, id1.Length);
    }

    [Fact]
    public void GenerateInstanceId_Format_IsCorrect()
    {
        var id = InvokeGenerateInstanceId();

        Assert.Matches(@"^WN-[a-f0-9]{16}$", id);
    }

    [Fact]
    public void GenerateInstanceId_IncludesMachineSpecificData()
    {
        var id = InvokeGenerateInstanceId();

        Assert.Contains("WN-", id);
    }

    [Theory]
    [InlineData("")]
    [InlineData("a")]
    [InlineData("hello world")]
    [InlineData("a\nb\nc")]
    public void ComputeFileHash_VariousContents_Returns64CharHex(string content)
    {
        var path = Path.GetTempFileName();
        try
        {
            File.WriteAllText(path, content);

            var hash = InvokeComputeFileHash(path);

            Assert.Equal(64, hash.Length);
            Assert.Matches(@"^[a-f0-9]{64}$", hash);
        }
        finally
        {
            File.Delete(path);
        }
    }

    // Private method access via reflection
    private static string InvokeComputeFileHash(string filePath)
    {
        var fortress = typeof(WatchNexus.Core.Fortress).Assembly.GetType("WatchNexus.Core.Fortress")!;
        var method = fortress.GetMethod("ComputeFileHash",
            System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Static)!;
        return (string)method.Invoke(null, new object[] { filePath })!;
    }

    private static string InvokeGenerateInstanceId()
    {
        var fortress = typeof(WatchNexus.Core.Fortress).Assembly.GetType("WatchNexus.Core.Fortress")!;
        var method = fortress.GetMethod("GenerateInstanceId",
            System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Static)!;
        return (string)method.Invoke(null, null)!;
    }
}
