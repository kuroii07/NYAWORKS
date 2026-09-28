using System.Diagnostics;
using System.Runtime.InteropServices;
using Nyaworks.NyaLauncher.Interop;

namespace Nyaworks.NyaLauncher.Ae;

public sealed class ProcessCatalog : IProcessCatalog
{
    public string? GetProcessName(int processId)
    {
        try
        {
            using var process = Process.GetProcessById(processId);
            return process.ProcessName;
        }
        catch (ArgumentException)
        {
            return null;
        }
        catch (InvalidOperationException)
        {
            return null;
        }
    }

    public bool IsDescendantOf(int processId, int ancestorProcessId)
    {
        if (processId <= 0 || ancestorProcessId <= 0 || processId == ancestorProcessId)
        {
            return false;
        }

        var parents = SnapshotParents();
        var current = processId;

        for (var depth = 0; depth < 128 && parents.TryGetValue(current, out var parent); depth++)
        {
            if (parent == ancestorProcessId)
            {
                return true;
            }

            if (parent <= 0 || parent == current)
            {
                return false;
            }

            current = parent;
        }

        return false;
    }

    private static Dictionary<int, int> SnapshotParents()
    {
        var result = new Dictionary<int, int>();
        var snapshot = NativeMethods.CreateToolhelp32Snapshot(
            NativeConstants.Th32csSnapProcess,
            0);

        if (snapshot == new nint(-1))
        {
            return result;
        }

        try
        {
            var entry = new ProcessEntry32
            {
                Size = (uint)Marshal.SizeOf<ProcessEntry32>(),
                ExecutableFile = string.Empty
            };

            if (!NativeMethods.Process32FirstW(snapshot, ref entry))
            {
                return result;
            }

            do
            {
                if (entry.ProcessId <= int.MaxValue && entry.ParentProcessId <= int.MaxValue)
                {
                    result[(int)entry.ProcessId] = (int)entry.ParentProcessId;
                }

                entry.Size = (uint)Marshal.SizeOf<ProcessEntry32>();
            }
            while (NativeMethods.Process32NextW(snapshot, ref entry));
        }
        finally
        {
            NativeMethods.CloseHandle(snapshot);
        }

        return result;
    }
}
