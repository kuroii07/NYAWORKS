namespace Nyaworks.NyaLauncher.Runtime;

public readonly record struct RuntimeWindowCandidate(
    nint Window,
    int ProcessId);
