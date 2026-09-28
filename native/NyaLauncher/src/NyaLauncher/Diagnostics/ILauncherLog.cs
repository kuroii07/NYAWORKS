namespace Nyaworks.NyaLauncher.Diagnostics;

public interface ILauncherLog
{
    void Write(LaunchTrace trace);
}
