using Nyaworks.NyaLauncher.Ae;
using Nyaworks.NyaLauncher.Interop;
using Nyaworks.NyaLauncher.Model;
using Xunit;

namespace Nyaworks.NyaLauncher.Tests;

public sealed class AeForegroundGuardTests
{
    [Theory]
    [InlineData("AfterFX")]
    [InlineData("afterfx")]
    [InlineData("AFTERFX")]
    public void AcceptsAfterEffectsCaseInsensitively(string processName)
    {
        var native = new StubNativeWindowApi
        {
            ForegroundWindow = (nint)100,
            ForegroundProcessId = 42
        };
        var processes = new StubProcessCatalog
        {
            ProcessNames = { [42] = processName }
        };
        var guard = new AeForegroundGuard(native, processes);

        var accepted = guard.TryGetForegroundAe(out var processId);

        Assert.True(accepted);
        Assert.Equal(42, processId);
    }

    [Theory]
    [InlineData("CEPHtmlEngine")]
    [InlineData("explorer")]
    [InlineData(null)]
    public void RejectsNonAeOrMissingProcesses(string? processName)
    {
        var native = new StubNativeWindowApi
        {
            ForegroundWindow = (nint)100,
            ForegroundProcessId = 42
        };
        var processes = new StubProcessCatalog();
        if (processName is not null)
        {
            processes.ProcessNames[42] = processName;
        }

        var guard = new AeForegroundGuard(native, processes);

        Assert.False(guard.TryGetForegroundAe(out var processId));
        Assert.Equal(0, processId);
    }

    [Fact]
    public void RejectsZeroForegroundWindow()
    {
        var guard = new AeForegroundGuard(
            new StubNativeWindowApi(),
            new StubProcessCatalog());

        Assert.False(guard.TryGetForegroundAe(out var processId));
        Assert.Equal(0, processId);
    }

    private sealed class StubProcessCatalog : IProcessCatalog
    {
        public Dictionary<int, string> ProcessNames { get; } = [];

        public string? GetProcessName(int processId) =>
            ProcessNames.GetValueOrDefault(processId);

        public bool IsDescendantOf(int processId, int ancestorProcessId) => false;
    }

    private sealed class StubNativeWindowApi : INativeWindowApi
    {
        public nint ForegroundWindow { get; init; }
        public int ForegroundProcessId { get; init; }

        public nint GetForegroundWindow() => ForegroundWindow;
        public int GetWindowProcessId(nint hwnd) => ForegroundProcessId;
        public bool TryGetCursorPosition(out ScreenPoint point)
        {
            point = default;
            return false;
        }

        public IReadOnlyList<nint> EnumerateTopLevelWindows() => [];
        public string GetWindowTitle(nint hwnd) => string.Empty;
        public bool IsWindowVisible(nint hwnd) => false;
        public nint GetWindowStyle(nint hwnd, int index) => nint.Zero;
        public nint SetWindowStyle(nint hwnd, int index, nint value) => nint.Zero;
        public bool SetWindowPosition(
            nint hwnd,
            nint insertAfter,
            int x,
            int y,
            int width,
            int height,
            uint flags) => false;
        public bool TryGetMonitorWorkArea(ScreenPoint point, out ScreenRect workArea)
        {
            workArea = default;
            return false;
        }

        public nint SetLowLevelKeyboardHook(LowLevelKeyboardProc callback) =>
            nint.Zero;
        public bool UnhookKeyboard(nint hook) => false;
        public nint CallNextKeyboardHook(
            nint hook,
            int code,
            nint message,
            nint data) => nint.Zero;
        public nint SetWindowShowEventHook(WindowEventProc callback) =>
            nint.Zero;
        public bool UnhookWindowEvent(nint hook) => false;
        public int GetLastError() => 0;
        public bool TryEnablePerMonitorV2() => false;
    }
}
