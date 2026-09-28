using Nyaworks.NyaLauncher.Interop;
using Nyaworks.NyaLauncher.Model;

namespace Nyaworks.NyaLauncher.Tests;

internal sealed class HookWatcherNativeApi : INativeWindowApi
{
    private readonly List<nint> _windows = [];
    private readonly Dictionary<nint, string> _titles = [];
    private readonly Dictionary<nint, bool> _visibility = [];
    private readonly Dictionary<nint, int> _processIds = [];

    public LowLevelKeyboardProc? KeyboardCallback { get; private set; }
    public WindowEventProc? WindowEventCallback { get; private set; }
    public nint KeyboardHookHandle { get; init; } = new(101);
    public nint WindowEventHookHandle { get; init; } = new(202);
    public nint ForegroundWindow { get; set; }
    public int ForegroundProcessId { get; set; }
    public ScreenPoint Cursor { get; set; }
    public int CallNextCount { get; private set; }
    public int UnhookKeyboardCount { get; private set; }
    public int UnhookWindowEventCount { get; private set; }

    public void AddWindow(
        nint hwnd,
        string title,
        bool visible,
        int processId)
    {
        _windows.Add(hwnd);
        _titles[hwnd] = title;
        _visibility[hwnd] = visible;
        _processIds[hwnd] = processId;
    }

    public nint SetLowLevelKeyboardHook(LowLevelKeyboardProc callback)
    {
        KeyboardCallback = callback;
        return KeyboardHookHandle;
    }

    public bool UnhookKeyboard(nint hook)
    {
        UnhookKeyboardCount++;
        return true;
    }

    public nint CallNextKeyboardHook(
        nint hook,
        int code,
        nint message,
        nint data)
    {
        CallNextCount++;
        return new nint(987);
    }

    public nint SetWindowShowEventHook(WindowEventProc callback)
    {
        WindowEventCallback = callback;
        return WindowEventHookHandle;
    }

    public bool UnhookWindowEvent(nint hook)
    {
        UnhookWindowEventCount++;
        return true;
    }

    public IReadOnlyList<nint> EnumerateTopLevelWindows() => _windows;
    public string GetWindowTitle(nint hwnd) =>
        _titles.GetValueOrDefault(hwnd, string.Empty);
    public bool IsWindowVisible(nint hwnd) =>
        _visibility.GetValueOrDefault(hwnd);
    public int GetWindowProcessId(nint hwnd) =>
        hwnd == ForegroundWindow
            ? ForegroundProcessId
            : _processIds.GetValueOrDefault(hwnd);
    public nint GetForegroundWindow() => ForegroundWindow;
    public bool TryGetCursorPosition(out ScreenPoint point)
    {
        point = Cursor;
        return true;
    }
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
    public bool TryGetMonitorWorkArea(
        ScreenPoint point,
        out ScreenRect workArea)
    {
        workArea = default;
        return false;
    }
    public int GetLastError() => 0;
    public bool TryEnablePerMonitorV2() => false;
}
