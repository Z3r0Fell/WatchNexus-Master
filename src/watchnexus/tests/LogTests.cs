using WatchNexus.Core;

namespace WatchNexus.Tests;

public class LogTests
{
    [Fact]
    public void Info_WritesToStdout()
    {
        var writer = new StringWriter();
        var original = Console.Out;
        Console.SetOut(writer);

        try
        {
            Log.Info("test message {0}", 42);
            var output = writer.ToString();
            Assert.Contains("[WatchNexus]", output);
            Assert.Contains("test message 42", output);
        }
        finally
        {
            Console.SetOut(original);
        }
    }

    [Fact]
    public void Error_WritesToStderr()
    {
        var writer = new StringWriter();
        var original = Console.Error;
        Console.SetError(writer);

        try
        {
            Log.Error("error message");
            var output = writer.ToString();
            Assert.Contains("[WatchNexus]", output);
            Assert.Contains("[ERROR]", output);
            Assert.Contains("error message", output);
        }
        finally
        {
            Console.SetError(original);
        }
    }

    [Fact]
    public void Error_WithException_WritesExceptionType()
    {
        var writer = new StringWriter();
        var original = Console.Error;
        Console.SetError(writer);

        try
        {
            Log.Error(new InvalidOperationException("test failure"), "context");
            var output = writer.ToString();
            Assert.Contains("InvalidOperationException", output);
            Assert.Contains("test failure", output);
        }
        finally
        {
            Console.SetError(original);
        }
    }

    [Fact]
    public void Warn_WritesToStdout()
    {
        var writer = new StringWriter();
        var original = Console.Out;
        Console.SetOut(writer);

        try
        {
            Log.Warn("warning message");
            var output = writer.ToString();
            Assert.Contains("[WARN]", output);
        }
        finally
        {
            Console.SetOut(original);
        }
    }
}
