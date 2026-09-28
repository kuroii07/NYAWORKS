using System.Text.Json;
using System.Text.Json.Serialization;

namespace Nyaworks.NyaLauncher.Diagnostics;

public sealed class LauncherLog : ILauncherLog
{
    private readonly object _sync = new();
    private readonly JsonSerializerOptions _jsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
        Converters = { new JsonStringEnumConverter() }
    };

    public LauncherLog(string? logDirectory = null)
    {
        var directory = logDirectory ?? GetDefaultLogDirectory();
        Directory.CreateDirectory(directory);
        FilePath = Path.Combine(directory, "nya-launcher-p1.log");
    }

    public string FilePath { get; }

    public static string GetDefaultLogDirectory() =>
        Path.Combine(
            Environment.GetFolderPath(
                Environment.SpecialFolder.LocalApplicationData),
            "NYAWORKS",
            "logs");

    public void Write(LaunchTrace trace)
    {
        var line = JsonSerializer.Serialize(trace, _jsonOptions);

        lock (_sync)
        {
            File.AppendAllText(
                FilePath,
                line + Environment.NewLine,
                System.Text.Encoding.UTF8);
        }
    }
}
