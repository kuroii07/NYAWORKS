using Nyaworks.NyaLauncher.Ae;
using Nyaworks.NyaLauncher.Interop;
using Nyaworks.NyaLauncher.Model;
using Nyaworks.NyaLauncher.Runtime;
using Xunit;

namespace Nyaworks.NyaLauncher.Tests;

public sealed class RuntimeWindowDetectorTests
{
    private const string Marker = "NYAWORKS_NYA_PIE_RUNTIME_P1";

    [Fact]
    public void AcceptsOneExactCepDescendantWindow()
    {
        var native = new DetectorNativeApi();
        native.Add((nint)10, Marker, visible: true, processId: 200);
        var processes = new DetectorProcessCatalog();
        processes.Names[200] = "CEPHtmlEngine";
        processes.Descendants.Add((200, 100));

        var found = new RuntimeWindowDetector(native, processes)
            .TryFind(100, Marker, out var candidate);

        Assert.True(found);
        Assert.Equal(new RuntimeWindowCandidate((nint)10, 200), candidate);
    }

    [Fact]
    public void RejectsInvalidAndUnrelatedCandidates()
    {
        var native = new DetectorNativeApi();
        native.Add(nint.Zero, Marker, true, 200);
        native.Add((nint)11, "Other", true, 201);
        native.Add((nint)12, Marker, false, 202);
        native.Add((nint)13, Marker, true, 203);
        native.Add((nint)14, Marker, true, 204);
        var processes = new DetectorProcessCatalog();
        processes.Names[203] = "explorer";
        processes.Names[204] = "CEPHtmlEngine";

        var found = new RuntimeWindowDetector(native, processes)
            .TryFind(100, Marker, out _);

        Assert.False(found);
    }

    [Fact]
    public void RejectsDuplicateExactCandidates()
    {
        var native = new DetectorNativeApi();
        native.Add((nint)10, Marker, true, 200);
        native.Add((nint)11, Marker, true, 201);
        var processes = new DetectorProcessCatalog();
        processes.Names[200] = "CEPHtmlEngine";
        processes.Names[201] = "CEPHtmlEngine";
        processes.Descendants.Add((200, 100));
        processes.Descendants.Add((201, 100));

        var found = new RuntimeWindowDetector(native, processes)
            .TryFind(100, Marker, out _);

        Assert.False(found);
    }

    private sealed class DetectorProcessCatalog : IProcessCatalog
    {
        public Dictionary<int, string> Names { get; } = [];
        public HashSet<(int ProcessId, int AncestorId)> Descendants { get; } = [];
        public string? GetProcessName(int processId) => Names.GetValueOrDefault(processId);
        public bool IsDescendantOf(int processId, int ancestorProcessId) =>
            Descendants.Contains((processId, ancestorProcessId));
    }

    private sealed class DetectorNativeApi : INativeWindowApi
    {
        private readonly List<nint> _windows = [];
        private readonly Dictionary<nint, string> _titles = [];
        private readonly Dictionary<nint, bool> _visibility = [];
        private readonly Dictionary<nint, int> _processIds = [];

        public void Add(nint hwnd, string title, bool visible, int processId)
        {
            _windows.Add(hwnd);
            _titles[hwnd] = title;
            _visibility[hwnd] = visible;
            _processIds[hwnd] = processId;
        }

        public IReadOnlyList<nint> EnumerateTopLevelWindows() => _windows;
        public string GetWindowTitle(nint hwnd) => _titles.GetValueOrDefault(hwnd, string.Empty);
        public bool IsWindowVisible(nint hwnd) => _visibility.GetValueOrDefault(hwnd);
        public int GetWindowProcessId(nint hwnd) => _processIds.GetValueOrDefault(hwnd);
        public nint GetForegroundWindow() => nint.Zero;
        public bool TryGetCursorPosition(out ScreenPoint point) { point = default; return false; }
        public nint GetWindowStyle(nint hwnd, int index) => nint.Zero;
        public nint SetWindowStyle(nint hwnd, int index, nint value) => nint.Zero;
        public bool SetWindowPosition(nint hwnd, nint insertAfter, int x, int y, int width, int height, uint flags) => false;
        public bool TryGetMonitorWorkArea(ScreenPoint point, out ScreenRect workArea) { workArea = default; return false; }
        public nint SetLowLevelKeyboardHook(LowLevelKeyboardProc callback) => nint.Zero;
        public bool UnhookKeyboard(nint hook) => false;
        public nint CallNextKeyboardHook(nint hook, int code, nint message, nint data) => nint.Zero;
        public nint SetWindowShowEventHook(WindowEventProc callback) => nint.Zero;
        public bool UnhookWindowEvent(nint hook) => false;
        public int GetLastError() => 0;
        public bool TryEnablePerMonitorV2() => false;
    }
}
