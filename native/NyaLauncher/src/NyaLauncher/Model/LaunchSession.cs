namespace Nyaworks.NyaLauncher.Model;

public sealed record LaunchSession(
    long Sequence,
    int AeProcessId,
    ScreenPoint Cursor,
    long KeyDownTicks,
    nint RuntimeWindow,
    long? FoundTicks,
    long? PositionedTicks,
    long? KeyUpTicks);
