using Nyaworks.NyaLauncher.Ae;
using Nyaworks.NyaLauncher.Runtime;
using Xunit;

namespace Nyaworks.NyaLauncher.Tests;

public sealed class RuntimeWindowWatcherTests
{
    private const string Marker = "NYAWORKS_NYA_PIE_RUNTIME_P1";

    [Fact]
    public void RejectsAutoRepeatArmUntilTheCurrentWatchCompletes()
    {
        var native = new HookWatcherNativeApi();
        var time = new ManualTimeProvider();
        using var watcher = CreateWatcher(native, time);

        Assert.True(watcher.Arm(100, 1, TimeSpan.FromMilliseconds(1500)));
        Assert.False(watcher.Arm(100, 2, TimeSpan.FromMilliseconds(1500)));
        Assert.Equal(1, time.CreatedTimerCount);
    }

    [Fact]
    public void WinEventSignalsTheSharedDetector()
    {
        var native = new HookWatcherNativeApi();
        var processes = new WatcherProcessCatalog();
        var time = new ManualTimeProvider();
        using var watcher = CreateWatcher(native, time, processes);
        using var shown = new ManualResetEventSlim(false);
        RuntimeWindowObservation? observation = null;
        watcher.RuntimeShown += value =>
        {
            observation = value;
            shown.Set();
        };
        Assert.True(watcher.Arm(100, 7, TimeSpan.FromMilliseconds(1500)));
        native.AddWindow((nint)50, Marker, visible: true, processId: 200);
        processes.Names[200] = "CEPHtmlEngine";
        processes.Descendants.Add((200, 100));

        native.WindowEventCallback!(
            native.WindowEventHookHandle,
            Nyaworks.NyaLauncher.Interop.NativeConstants.EventObjectShow,
            (nint)50,
            Nyaworks.NyaLauncher.Interop.NativeConstants.ObjIdWindow,
            0,
            0,
            0);

        Assert.True(shown.Wait(TimeSpan.FromSeconds(2)));
        Assert.Equal(
            new RuntimeWindowObservation(
                Sequence: 7,
                Candidate: new RuntimeWindowCandidate((nint)50, 200),
                FoundTicks: time.GetTimestamp()),
            observation);
        Assert.False(watcher.IsArmed);
    }

    [Fact]
    public void PollingFallbackClampsTimeoutToFifteenHundredMilliseconds()
    {
        var native = new HookWatcherNativeApi();
        var time = new ManualTimeProvider();
        using var watcher = CreateWatcher(native, time);
        long? timedOutSequence = null;
        watcher.TimedOut += sequence => timedOutSequence = sequence;
        Assert.True(watcher.Arm(100, 9, TimeSpan.FromSeconds(10)));

        time.Advance(TimeSpan.FromMilliseconds(1499));

        Assert.Null(timedOutSequence);
        Assert.True(watcher.IsArmed);

        time.Advance(TimeSpan.FromMilliseconds(1));

        Assert.Equal(9, timedOutSequence);
        Assert.False(watcher.IsArmed);
    }

    [Fact]
    public void DisposeUnhooksTheWindowEventAndStopsPolling()
    {
        var native = new HookWatcherNativeApi();
        var time = new ManualTimeProvider();
        var watcher = CreateWatcher(native, time);
        Assert.True(watcher.Arm(100, 1, TimeSpan.FromMilliseconds(1500)));

        watcher.Dispose();
        time.Advance(TimeSpan.FromSeconds(2));

        Assert.Equal(1, native.UnhookWindowEventCount);
        Assert.False(watcher.IsArmed);
        Assert.True(time.AllTimersDisposed);
    }

    private static RuntimeWindowWatcher CreateWatcher(
        HookWatcherNativeApi native,
        ManualTimeProvider time,
        WatcherProcessCatalog? processes = null) =>
        new(
            native,
            new RuntimeWindowDetector(
                native,
                processes ?? new WatcherProcessCatalog()),
            time,
            Marker);

    private sealed class WatcherProcessCatalog : IProcessCatalog
    {
        public Dictionary<int, string> Names { get; } = [];
        public HashSet<(int ProcessId, int AncestorId)> Descendants { get; } = [];

        public string? GetProcessName(int processId) =>
            Names.GetValueOrDefault(processId);

        public bool IsDescendantOf(int processId, int ancestorProcessId) =>
            Descendants.Contains((processId, ancestorProcessId));
    }
}
