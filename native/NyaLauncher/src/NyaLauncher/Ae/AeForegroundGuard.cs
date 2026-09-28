using Nyaworks.NyaLauncher.Interop;

namespace Nyaworks.NyaLauncher.Ae;

public sealed class AeForegroundGuard(
    INativeWindowApi native,
    IProcessCatalog processes)
{
    public bool TryGetForegroundAe(out int processId)
    {
        processId = 0;
        var foregroundWindow = native.GetForegroundWindow();
        if (foregroundWindow == nint.Zero)
        {
            return false;
        }

        var candidateProcessId = native.GetWindowProcessId(foregroundWindow);
        if (candidateProcessId <= 0)
        {
            return false;
        }

        var processName = processes.GetProcessName(candidateProcessId);
        if (!string.Equals(processName, "AfterFX", StringComparison.OrdinalIgnoreCase))
        {
            return false;
        }

        processId = candidateProcessId;
        return true;
    }
}
