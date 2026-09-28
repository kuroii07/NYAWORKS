using System.ComponentModel;
using Nyaworks.NyaLauncher.Interop;

namespace Nyaworks.NyaLauncher.Runtime;

public sealed class RuntimeWindowWatcher : IRuntimeWindowWatcher
{
    public const string RuntimeTitle = "NYAWORKS_NYA_PIE_RUNTIME_P1";

    private static readonly TimeSpan MaximumTimeout =
        TimeSpan.FromMilliseconds(1500);
    private static readonly TimeSpan PollInterval =
        TimeSpan.FromMilliseconds(25);

    private readonly object _sync = new();
    private readonly INativeWindowApi _native;
    private readonly RuntimeWindowDetector _detector;
    private readonly TimeProvider _time;
    private readonly string _exactTitle;
    private readonly WindowEventProc _windowEventCallback;
    private nint _windowEventHook;
    private ITimer? _pollTimer;
    private WatchState? _watch;
    private bool _disposed;

    public RuntimeWindowWatcher(
        INativeWindowApi native,
        RuntimeWindowDetector detector,
        TimeProvider? timeProvider = null,
        string exactTitle = RuntimeTitle)
    {
        _native = native;
        _detector = detector;
        _time = timeProvider ?? TimeProvider.System;
        _exactTitle = exactTitle;
        _windowEventCallback = HandleWindowEvent;
        _windowEventHook = _native.SetWindowShowEventHook(_windowEventCallback);

        if (_windowEventHook == nint.Zero)
        {
            throw new Win32Exception(
                _native.GetLastError(),
                "Unable to install the NyaLauncher window event hook.");
        }
    }

    public event Action<RuntimeWindowObservation>? RuntimeShown;
    public event Action<long>? TimedOut;

    public bool IsArmed
    {
        get
        {
            lock (_sync)
            {
                return _watch is not null;
            }
        }
    }

    public bool Arm(
        int aeProcessId,
        long sequence,
        TimeSpan timeout)
    {
        lock (_sync)
        {
            if (
                _disposed ||
                _watch is not null ||
                aeProcessId <= 0 ||
                sequence <= 0)
            {
                return false;
            }

            var effectiveTimeout = timeout <= TimeSpan.Zero
                ? TimeSpan.Zero
                : timeout > MaximumTimeout
                    ? MaximumTimeout
                    : timeout;
            _watch = new WatchState(
                aeProcessId,
                sequence,
                _time.GetUtcNow() + effectiveTimeout);
            _pollTimer = _time.CreateTimer(
                _ => Probe(),
                null,
                PollInterval,
                PollInterval);
            return true;
        }
    }

    public bool Cancel(long sequence)
    {
        lock (_sync)
        {
            if (_watch is not { } watch || watch.Sequence != sequence)
            {
                return false;
            }

            _watch = null;
            _pollTimer?.Dispose();
            _pollTimer = null;
            return true;
        }
    }

    public void Dispose()
    {
        nint hook;

        lock (_sync)
        {
            if (_disposed)
            {
                return;
            }

            _disposed = true;
            _watch = null;
            _pollTimer?.Dispose();
            _pollTimer = null;
            hook = _windowEventHook;
            _windowEventHook = nint.Zero;
        }

        if (hook != nint.Zero)
        {
            _native.UnhookWindowEvent(hook);
        }
    }

    private void HandleWindowEvent(
        nint hook,
        uint eventType,
        nint hwnd,
        int objectId,
        int childId,
        uint eventThread,
        uint eventTime)
    {
        if (
            eventType != NativeConstants.EventObjectShow ||
            hwnd == nint.Zero ||
            objectId != NativeConstants.ObjIdWindow ||
            childId != 0)
        {
            return;
        }

        ThreadPool.QueueUserWorkItem(_ => Probe());
    }

    private void Probe()
    {
        WatchState watch;

        lock (_sync)
        {
            if (_disposed || _watch is not { } active)
            {
                return;
            }

            watch = active;
        }

        if (
            _detector.TryFind(
                watch.AeProcessId,
                _exactTitle,
                out var candidate))
        {
            CompleteShown(watch, candidate);
            return;
        }

        if (_time.GetUtcNow() >= watch.Deadline)
        {
            CompleteTimeout(watch);
        }
    }

    private void CompleteShown(
        WatchState watch,
        RuntimeWindowCandidate candidate)
    {
        Action<RuntimeWindowObservation>? callback;
        RuntimeWindowObservation observation;

        lock (_sync)
        {
            if (_watch != watch)
            {
                return;
            }

            _watch = null;
            _pollTimer?.Dispose();
            _pollTimer = null;
            callback = RuntimeShown;
            observation = new RuntimeWindowObservation(
                watch.Sequence,
                candidate,
                _time.GetTimestamp());
        }

        callback?.Invoke(observation);
    }

    private void CompleteTimeout(WatchState watch)
    {
        Action<long>? callback;

        lock (_sync)
        {
            if (_watch != watch)
            {
                return;
            }

            _watch = null;
            _pollTimer?.Dispose();
            _pollTimer = null;
            callback = TimedOut;
        }

        callback?.Invoke(watch.Sequence);
    }

    private sealed record WatchState(
        int AeProcessId,
        long Sequence,
        DateTimeOffset Deadline);
}
