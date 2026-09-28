namespace Nyaworks.NyaLauncher.Input;

public interface IKeyboardHook : IDisposable
{
    bool IsRunning { get; }
    void Start(Action<KeyboardSample> callback);
}
