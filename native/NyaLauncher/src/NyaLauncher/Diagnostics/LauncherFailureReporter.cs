using System.ComponentModel;

namespace Nyaworks.NyaLauncher.Diagnostics;

public static class LauncherFailureReporter
{
    private const string LauncherVersion = "0.1.0-p1";

    public static bool TryWrite(Exception error)
    {
        try
        {
            return TryWrite(new LauncherLog(), error);
        }
        catch
        {
            return false;
        }
    }

    public static bool TryWrite(
        ILauncherLog log,
        Exception error)
    {
        ArgumentNullException.ThrowIfNull(log);
        ArgumentNullException.ThrowIfNull(error);

        try
        {
            log.Write(new LaunchTrace(
                TimestampUtc: DateTimeOffset.UtcNow,
                LauncherVersion,
                Event: LaunchEvent.StartupFailed,
                Sequence: 0,
                AeProcessId: 0,
                ForegroundWindow: 0,
                CursorX: 0,
                CursorY: 0,
                KeyDownTicks: 0,
                RuntimeWindow: null,
                FoundTicks: null,
                PositionedTicks: null,
                KeyUpTicks: null,
                Win32Error: error is Win32Exception win32
                    ? win32.NativeErrorCode
                    : error.HResult));
            return true;
        }
        catch
        {
            return false;
        }
    }
}
