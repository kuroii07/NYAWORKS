namespace Nyaworks.NyaLauncher.Input;

public readonly record struct KeyboardSample(
    uint VirtualKey,
    bool IsKeyDown,
    bool IsKeyUp,
    bool AltDown,
    long TimestampTicks);
