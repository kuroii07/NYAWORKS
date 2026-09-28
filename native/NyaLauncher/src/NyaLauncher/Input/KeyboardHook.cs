using System.ComponentModel;
using System.Runtime.InteropServices;
using Nyaworks.NyaLauncher.Interop;

namespace Nyaworks.NyaLauncher.Input;

public sealed class KeyboardHook : IKeyboardHook
{
    private const uint LowLevelAltDown = 0x20;
    private readonly INativeWindowApi _native;
    private readonly Func<long> _timestamp;
    private LowLevelKeyboardProc? _nativeCallback;
    private Action<KeyboardSample>? _consumer;
    private nint _hook;
    private bool _disposed;

    public KeyboardHook(
        INativeWindowApi native,
        Func<long>? timestamp = null)
    {
        _native = native;
        _timestamp = timestamp ?? System.Diagnostics.Stopwatch.GetTimestamp;
    }

    public bool IsRunning => _hook != nint.Zero;

    public void Start(Action<KeyboardSample> callback)
    {
        ObjectDisposedException.ThrowIf(_disposed, this);
        ArgumentNullException.ThrowIfNull(callback);

        if (IsRunning)
        {
            throw new InvalidOperationException("The keyboard hook is already running.");
        }

        _consumer = callback;
        _nativeCallback = HandleNativeKeyboardEvent;
        _hook = _native.SetLowLevelKeyboardHook(_nativeCallback);
        if (_hook == nint.Zero)
        {
            _nativeCallback = null;
            _consumer = null;
            throw new Win32Exception(
                _native.GetLastError(),
                "Unable to install the NyaLauncher keyboard hook.");
        }
    }

    public void Dispose()
    {
        if (_disposed)
        {
            return;
        }

        _disposed = true;
        if (_hook != nint.Zero)
        {
            _native.UnhookKeyboard(_hook);
            _hook = nint.Zero;
        }

        _consumer = null;
        _nativeCallback = null;
    }

    private nint HandleNativeKeyboardEvent(
        int code,
        nint message,
        nint data)
    {
        try
        {
            if (code >= 0 && TryClassify(message, out var isDown, out var isUp))
            {
                var input = Marshal.PtrToStructure<LowLevelKeyboardInput>(data);
                _consumer?.Invoke(new KeyboardSample(
                    input.VirtualKey,
                    isDown,
                    isUp,
                    (input.Flags & LowLevelAltDown) != 0,
                    _timestamp()));
            }
        }
        catch
        {
            // A consumer failure must never interrupt the global hook chain.
        }

        return _native.CallNextKeyboardHook(
            _hook,
            code,
            message,
            data);
    }

    private static bool TryClassify(
        nint message,
        out bool isDown,
        out bool isUp)
    {
        var value = unchecked((uint)message.ToInt64());
        isDown =
            value == NativeConstants.WmKeyDown ||
            value == NativeConstants.WmSysKeyDown;
        isUp =
            value == NativeConstants.WmKeyUp ||
            value == NativeConstants.WmSysKeyUp;
        return isDown || isUp;
    }
}
