using Nyaworks.NyaLauncher.Ae;
using Nyaworks.NyaLauncher.Diagnostics;
using Nyaworks.NyaLauncher.Input;
using Nyaworks.NyaLauncher.Interop;
using Nyaworks.NyaLauncher.Model;
using Nyaworks.NyaLauncher.Runtime;

namespace Nyaworks.NyaLauncher;

public sealed class LauncherApplicationContext : ApplicationContext
{
    private const string LauncherVersion = "0.1.0-p1";
    private static readonly TimeSpan RuntimeTimeout =
        TimeSpan.FromMilliseconds(1500);

    private readonly object _sync = new();
    private readonly INativeWindowApi _native;
    private readonly AeForegroundGuard _foregroundGuard;
    private readonly ShortcutStateMachine _state;
    private readonly IKeyboardHook _keyboard;
    private readonly IRuntimeWindowWatcher _watcher;
    private readonly IRuntimeWindowCoordinator _coordinator;
    private readonly ILauncherLog _log;
    private readonly Func<long> _timestamp;
    private bool _disposed;

    public LauncherApplicationContext(
        INativeWindowApi native,
        AeForegroundGuard foregroundGuard,
        ShortcutStateMachine state,
        IKeyboardHook keyboard,
        IRuntimeWindowWatcher watcher,
        IRuntimeWindowCoordinator coordinator,
        ILauncherLog log,
        Func<long>? timestamp = null)
    {
        _native = native;
        _foregroundGuard = foregroundGuard;
        _state = state;
        _keyboard = keyboard;
        _watcher = watcher;
        _coordinator = coordinator;
        _log = log;
        _timestamp = timestamp ?? System.Diagnostics.Stopwatch.GetTimestamp;

        _watcher.RuntimeShown += HandleRuntimeShown;
        _watcher.TimedOut += HandleRuntimeTimeout;
        _keyboard.Start(HandleKeyboardSample);
    }

    protected override void Dispose(bool disposing)
    {
        if (disposing && !_disposed)
        {
            _disposed = true;
            _watcher.RuntimeShown -= HandleRuntimeShown;
            _watcher.TimedOut -= HandleRuntimeTimeout;
            _keyboard.Dispose();
            _watcher.Dispose();
        }

        base.Dispose(disposing);
    }

    private void HandleKeyboardSample(KeyboardSample sample)
    {
        lock (_sync)
        {
            if (_disposed)
            {
                return;
            }

            if (sample.IsKeyDown)
            {
                HandleKeyDown(sample);
            }
            else if (sample.IsKeyUp)
            {
                HandleKeyUp(sample);
            }
        }
    }

    private void HandleKeyDown(KeyboardSample sample)
    {
        if (
            _state.Phase != LaunchPhase.Idle ||
            !_foregroundGuard.TryGetForegroundAe(out var aeProcessId) ||
            !_native.TryGetCursorPosition(out var cursor) ||
            !_state.TryArm(
                isAeForeground: true,
                sample.AltDown,
                sample.VirtualKey,
                aeProcessId,
                cursor,
                sample.TimestampTicks))
        {
            return;
        }

        var session = _state.Current!;
        if (!_watcher.Arm(aeProcessId, session.Sequence, RuntimeTimeout))
        {
            _state.Reset();
            return;
        }

        WriteTrace(LaunchEvent.Armed, session);
    }

    private void HandleKeyUp(KeyboardSample sample)
    {
        if (!_state.TryRelease(sample.VirtualKey, sample.TimestampTicks))
        {
            return;
        }

        if (_state.Current is { } session)
        {
            _watcher.Cancel(session.Sequence);
            WriteTrace(LaunchEvent.Released, session);
        }
    }

    private void HandleRuntimeShown(RuntimeWindowObservation observation)
    {
        lock (_sync)
        {
            if (
                _disposed ||
                _state.Phase != LaunchPhase.WaitingForRuntime ||
                _state.Current is not { } current ||
                current.Sequence != observation.Sequence)
            {
                return;
            }

            var detected = current with
            {
                RuntimeWindow = observation.Candidate.Window,
                FoundTicks = observation.FoundTicks
            };
            if (!_coordinator.TryPosition(detected))
            {
                WriteTrace(LaunchEvent.PositionFailed, detected);
                _state.Reset();
                return;
            }

            var positionedTicks = _timestamp();
            if (_state.TryMarkRuntimePositioned(
                observation.Candidate.Window,
                observation.FoundTicks,
                positionedTicks) &&
                _state.Current is { } positioned)
            {
                WriteTrace(LaunchEvent.RuntimePositioned, positioned);
            }
        }
    }

    private void HandleRuntimeTimeout(long sequence)
    {
        lock (_sync)
        {
            if (
                _disposed ||
                _state.Current is not { } current ||
                current.Sequence != sequence)
            {
                return;
            }

            WriteTrace(LaunchEvent.TimedOut, current);
            _state.Reset();
        }
    }

    private void WriteTrace(
        LaunchEvent launchEvent,
        LaunchSession session,
        int? win32Error = null)
    {
        _log.Write(new LaunchTrace(
            TimestampUtc: DateTimeOffset.UtcNow,
            LauncherVersion,
            Event: launchEvent,
            Sequence: session.Sequence,
            AeProcessId: session.AeProcessId,
            ForegroundWindow: _native.GetForegroundWindow().ToInt64(),
            CursorX: session.Cursor.X,
            CursorY: session.Cursor.Y,
            KeyDownTicks: session.KeyDownTicks,
            RuntimeWindow: session.RuntimeWindow == nint.Zero
                ? null
                : session.RuntimeWindow.ToInt64(),
            FoundTicks: session.FoundTicks,
            PositionedTicks: session.PositionedTicks,
            KeyUpTicks: session.KeyUpTicks,
            Win32Error: win32Error));
    }
}
