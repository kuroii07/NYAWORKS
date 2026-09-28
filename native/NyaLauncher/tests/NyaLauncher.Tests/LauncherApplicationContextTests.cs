using Nyaworks.NyaLauncher.Ae;
using Nyaworks.NyaLauncher.Diagnostics;
using Nyaworks.NyaLauncher.Input;
using Nyaworks.NyaLauncher.Interop;
using Nyaworks.NyaLauncher.Model;
using Nyaworks.NyaLauncher.Runtime;
using Xunit;

namespace Nyaworks.NyaLauncher.Tests;

public sealed class LauncherApplicationContextTests
{
    [Fact]
    public void IgnoresShortcutWhenAfterEffectsIsNotForeground()
    {
        var fixture = new ApplicationFixture(processName: "explorer");
        using var context = fixture.CreateContext();

        fixture.Keyboard.Emit(KeyDown());

        Assert.Empty(fixture.Watcher.Arms);
        Assert.Equal(LaunchPhase.Idle, fixture.State.Phase);
    }

    [Fact]
    public void CapturesCursorAndArmsWatcherOnlyOnce()
    {
        var fixture = new ApplicationFixture();
        using var context = fixture.CreateContext();

        fixture.Keyboard.Emit(KeyDown(timestamp: 100));
        fixture.Keyboard.Emit(KeyDown(timestamp: 101));

        Assert.Single(fixture.Watcher.Arms);
        Assert.Equal((42, 1L, TimeSpan.FromMilliseconds(1500)), fixture.Watcher.Arms[0]);
        Assert.Equal(new ScreenPoint(640, 360), fixture.State.Current?.Cursor);
        Assert.Equal(100, fixture.State.Current?.KeyDownTicks);
    }

    [Fact]
    public void SuccessfulDetectionRecordsFoundAndPositionedTimestamps()
    {
        var fixture = new ApplicationFixture();
        using var context = fixture.CreateContext();
        fixture.Keyboard.Emit(KeyDown(timestamp: 100));
        fixture.Timestamp = 140;

        fixture.Watcher.EmitShown(new RuntimeWindowObservation(
            Sequence: 1,
            Candidate: new RuntimeWindowCandidate((nint)900, 84),
            FoundTicks: 125));

        Assert.Equal(LaunchPhase.RuntimePositioned, fixture.State.Phase);
        Assert.Equal((nint)900, fixture.State.Current?.RuntimeWindow);
        Assert.Equal(125, fixture.State.Current?.FoundTicks);
        Assert.Equal(140, fixture.State.Current?.PositionedTicks);
        Assert.Single(fixture.Coordinator.Sessions);
        Assert.Contains(
            fixture.Log.Traces,
            trace => trace.Event == LaunchEvent.RuntimePositioned);
    }

    [Fact]
    public void KeyUpRecordsReleaseWithoutAnyActionExecutionPath()
    {
        var fixture = new ApplicationFixture();
        using var context = fixture.CreateContext();
        fixture.Keyboard.Emit(KeyDown(timestamp: 100));

        fixture.Keyboard.Emit(new KeyboardSample(
            NativeConstants.VkSpace,
            IsKeyDown: false,
            IsKeyUp: true,
            AltDown: true,
            TimestampTicks: 180));

        Assert.Equal(LaunchPhase.Idle, fixture.State.Phase);
        Assert.Equal(180, fixture.State.Current?.KeyUpTicks);
        Assert.Empty(fixture.Coordinator.Sessions);
        Assert.Contains(
            fixture.Log.Traces,
            trace => trace.Event == LaunchEvent.Released);
    }

    [Fact]
    public void TimeoutReturnsTheStateMachineToIdle()
    {
        var fixture = new ApplicationFixture();
        using var context = fixture.CreateContext();
        fixture.Keyboard.Emit(KeyDown(timestamp: 100));

        fixture.Watcher.EmitTimeout(sequence: 1);

        Assert.Equal(LaunchPhase.Idle, fixture.State.Phase);
        Assert.Null(fixture.State.Current);
        Assert.Contains(
            fixture.Log.Traces,
            trace => trace.Event == LaunchEvent.TimedOut);
    }

    [Fact]
    public void SecondSingleInstanceRequestIsRejectedWithoutThrowing()
    {
        var name = $"Local\\NYAWORKS_NyaLauncher_Test_{Guid.NewGuid():N}";

        Assert.True(SingleInstanceGuard.TryAcquire(name, out var first));
        using (first)
        {
            Assert.False(SingleInstanceGuard.TryAcquire(name, out var second));
            Assert.Null(second);
        }
    }

    private static KeyboardSample KeyDown(long timestamp = 100) =>
        new(
            NativeConstants.VkSpace,
            IsKeyDown: true,
            IsKeyUp: false,
            AltDown: true,
            TimestampTicks: timestamp);

    private sealed class ApplicationFixture
    {
        private readonly HookWatcherNativeApi _native = new();
        private readonly ApplicationProcessCatalog _processes;

        public ApplicationFixture(string processName = "AfterFX")
        {
            _native.ForegroundWindow = new nint(77);
            _native.ForegroundProcessId = 42;
            _native.Cursor = new ScreenPoint(640, 360);
            _processes = new ApplicationProcessCatalog
            {
                ProcessName = processName
            };
        }

        public long Timestamp { get; set; } = 120;
        public ShortcutStateMachine State { get; } = new();
        public FakeKeyboardHook Keyboard { get; } = new();
        public FakeRuntimeWindowWatcher Watcher { get; } = new();
        public FakeRuntimeWindowCoordinator Coordinator { get; } = new();
        public MemoryLauncherLog Log { get; } = new();

        public LauncherApplicationContext CreateContext() =>
            new(
                _native,
                new AeForegroundGuard(_native, _processes),
                State,
                Keyboard,
                Watcher,
                Coordinator,
                Log,
                () => Timestamp);
    }

    private sealed class ApplicationProcessCatalog : IProcessCatalog
    {
        public string? ProcessName { get; init; }
        public string? GetProcessName(int processId) => ProcessName;
        public bool IsDescendantOf(int processId, int ancestorProcessId) => false;
    }

    private sealed class FakeKeyboardHook : IKeyboardHook
    {
        private Action<KeyboardSample>? _callback;
        public bool IsRunning { get; private set; }
        public void Start(Action<KeyboardSample> callback)
        {
            _callback = callback;
            IsRunning = true;
        }
        public void Emit(KeyboardSample sample) => _callback?.Invoke(sample);
        public void Dispose() => IsRunning = false;
    }

    private sealed class FakeRuntimeWindowWatcher : IRuntimeWindowWatcher
    {
        public event Action<RuntimeWindowObservation>? RuntimeShown;
        public event Action<long>? TimedOut;
        public List<(int AePid, long Sequence, TimeSpan Timeout)> Arms { get; } = [];
        public bool IsArmed { get; private set; }
        public bool Arm(int aeProcessId, long sequence, TimeSpan timeout)
        {
            if (IsArmed)
            {
                return false;
            }

            Arms.Add((aeProcessId, sequence, timeout));
            IsArmed = true;
            return true;
        }
        public void EmitShown(RuntimeWindowObservation observation)
        {
            IsArmed = false;
            RuntimeShown?.Invoke(observation);
        }
        public void EmitTimeout(long sequence)
        {
            IsArmed = false;
            TimedOut?.Invoke(sequence);
        }
        public void Dispose() => IsArmed = false;
    }

    private sealed class FakeRuntimeWindowCoordinator : IRuntimeWindowCoordinator
    {
        public List<LaunchSession> Sessions { get; } = [];
        public bool TryPosition(LaunchSession session)
        {
            Sessions.Add(session);
            return true;
        }
    }

    private sealed class MemoryLauncherLog : ILauncherLog
    {
        public List<LaunchTrace> Traces { get; } = [];
        public void Write(LaunchTrace trace) => Traces.Add(trace);
    }
}
