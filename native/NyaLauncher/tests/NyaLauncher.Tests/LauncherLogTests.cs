using Nyaworks.NyaLauncher.Diagnostics;
using Xunit;

namespace Nyaworks.NyaLauncher.Tests;

public sealed class LauncherLogTests
{
    [Fact]
    public void DefaultDirectoryLivesUnderLocalAppData()
    {
        Assert.Equal(
            Path.Combine(
                Environment.GetFolderPath(
                    Environment.SpecialFolder.LocalApplicationData),
                "NYAWORKS",
                "logs"),
            LauncherLog.GetDefaultLogDirectory());
    }

    [Fact]
    public void WritesOneSanitizedJsonLineWithoutProductContent()
    {
        var directory = Path.Combine(
            Path.GetTempPath(),
            $"nyaworks-launcher-log-{Guid.NewGuid():N}");

        try
        {
            var log = new LauncherLog(directory);
            log.Write(new LaunchTrace(
                TimestampUtc: new DateTimeOffset(
                    2026,
                    9,
                    28,
                    12,
                    0,
                    0,
                    TimeSpan.Zero),
                LauncherVersion: "0.1.0-p1",
                Event: LaunchEvent.RuntimePositioned,
                Sequence: 3,
                AeProcessId: 42,
                ForegroundWindow: 77,
                CursorX: 640,
                CursorY: 360,
                KeyDownTicks: 100,
                RuntimeWindow: 900,
                FoundTicks: 120,
                PositionedTicks: 140,
                KeyUpTicks: null,
                Win32Error: null));

            var lines = File.ReadAllLines(log.FilePath);

            Assert.Single(lines);
            Assert.Contains("\"event\":\"RuntimePositioned\"", lines[0]);
            Assert.DoesNotContain("projectPath", lines[0], StringComparison.OrdinalIgnoreCase);
            Assert.DoesNotContain("action", lines[0], StringComparison.OrdinalIgnoreCase);
            Assert.DoesNotContain("apiKey", lines[0], StringComparison.OrdinalIgnoreCase);
        }
        finally
        {
            if (Directory.Exists(directory))
            {
                Directory.Delete(directory, recursive: true);
            }
        }
    }

    [Fact]
    public void StartupFailureReportOmitsTheExceptionMessage()
    {
        var directory = Path.Combine(
            Path.GetTempPath(),
            $"nyaworks-launcher-failure-{Guid.NewGuid():N}");

        try
        {
            var log = new LauncherLog(directory);
            LauncherFailureReporter.TryWrite(
                log,
                new InvalidOperationException(
                    @"C:\secret-project apiKey=do-not-log action=payload"));

            var content = File.ReadAllText(log.FilePath);

            Assert.Contains("\"event\":\"StartupFailed\"", content);
            Assert.DoesNotContain("secret-project", content);
            Assert.DoesNotContain("apiKey", content, StringComparison.OrdinalIgnoreCase);
            Assert.DoesNotContain("payload", content);
        }
        finally
        {
            if (Directory.Exists(directory))
            {
                Directory.Delete(directory, recursive: true);
            }
        }
    }
}
