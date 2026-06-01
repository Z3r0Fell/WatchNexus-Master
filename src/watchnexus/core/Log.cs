namespace WatchNexus.Core;

public static class Log
{
    private static readonly string _prefix = "[WatchNexus]";

    public static void Info(string msg, params object[] args)
    {
        var line = $"{_prefix} {string.Format(msg, args)}";
        Console.Out.WriteLine(line);
    }

    public static void Error(string msg, params object[] args)
    {
        var line = $"{_prefix} [ERROR] {string.Format(msg, args)}";
        Console.Error.WriteLine(line);
    }

    public static void Error(Exception ex, string msg, params object[] args)
    {
        var line = $"{_prefix} [ERROR] {string.Format(msg, args)}: {ex.GetType().Name}: {ex.Message}";
        Console.Error.WriteLine(line);
        if (ex.StackTrace != null)
            Console.Error.WriteLine($"{_prefix} [ERROR] {ex.StackTrace.Split('\n')[0].Trim()}");
    }

    public static void Warn(string msg, params object[] args)
    {
        var line = $"{_prefix} [WARN] {string.Format(msg, args)}";
        Console.Out.WriteLine(line);
    }
}