using Nyaworks.NyaLauncher.Ae;
using Nyaworks.NyaLauncher.Interop;

namespace Nyaworks.NyaLauncher.Runtime;

public sealed class RuntimeWindowDetector(
    INativeWindowApi native,
    IProcessCatalog processes)
{
    public bool TryFind(
        int aeProcessId,
        string exactTitle,
        out RuntimeWindowCandidate candidate)
    {
        candidate = default;
        RuntimeWindowCandidate? match = null;

        foreach (var hwnd in native.EnumerateTopLevelWindows())
        {
            if (
                hwnd == nint.Zero ||
                !native.IsWindowVisible(hwnd) ||
                !string.Equals(
                    native.GetWindowTitle(hwnd),
                    exactTitle,
                    StringComparison.Ordinal))
            {
                continue;
            }

            var processId = native.GetWindowProcessId(hwnd);
            if (
                processId <= 0 ||
                !string.Equals(
                    processes.GetProcessName(processId),
                    "CEPHtmlEngine",
                    StringComparison.OrdinalIgnoreCase) ||
                !processes.IsDescendantOf(processId, aeProcessId))
            {
                continue;
            }

            if (match is not null)
            {
                return false;
            }

            match = new RuntimeWindowCandidate(hwnd, processId);
        }

        if (match is null)
        {
            return false;
        }

        candidate = match.Value;
        return true;
    }
}
