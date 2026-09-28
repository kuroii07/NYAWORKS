namespace Nyaworks.NyaLauncher.Diagnostics;

public sealed record LaunchTrace(
    DateTimeOffset TimestampUtc,
    string LauncherVersion,
    LaunchEvent Event,
    long Sequence,
    int AeProcessId,
    long ForegroundWindow,
    int CursorX,
    int CursorY,
    long KeyDownTicks,
    long? RuntimeWindow,
    long? FoundTicks,
    long? PositionedTicks,
    long? KeyUpTicks,
    int? Win32Error);
