namespace Nyaworks.NyaLauncher.Ae;

public interface IProcessCatalog
{
    string? GetProcessName(int processId);
    bool IsDescendantOf(int processId, int ancestorProcessId);
}
