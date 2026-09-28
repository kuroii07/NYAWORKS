namespace Nyaworks.NyaLauncher.Runtime;

public interface IRuntimeWindowWatcher : IDisposable
{
    event Action<RuntimeWindowObservation>? RuntimeShown;
    event Action<long>? TimedOut;
    bool IsArmed { get; }
    bool Arm(int aeProcessId, long sequence, TimeSpan timeout);
    bool Cancel(long sequence);
}
