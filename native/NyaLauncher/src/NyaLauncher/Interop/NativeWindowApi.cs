using System.Runtime.InteropServices;
using System.Text;
using Nyaworks.NyaLauncher.Model;

namespace Nyaworks.NyaLauncher.Interop;

public sealed class NativeWindowApi : INativeWindowApi
{
    public nint GetForegroundWindow() => NativeMethods.GetForegroundWindow();

    public int GetWindowProcessId(nint hwnd)
    {
        NativeMethods.GetWindowThreadProcessId(hwnd, out var processId);
        return processId > int.MaxValue ? 0 : (int)processId;
    }

    public bool TryGetCursorPosition(out ScreenPoint point)
    {
        if (NativeMethods.GetCursorPos(out var nativePoint))
        {
            point = new ScreenPoint(nativePoint.X, nativePoint.Y);
            return true;
        }

        point = default;
        return false;
    }

    public IReadOnlyList<nint> EnumerateTopLevelWindows()
    {
        var windows = new List<nint>();
        NativeMethods.EnumWindows(
            (hwnd, _) =>
            {
                windows.Add(hwnd);
                return true;
            },
            nint.Zero);
        return windows;
    }

    public string GetWindowTitle(nint hwnd)
    {
        var length = NativeMethods.GetWindowTextLengthW(hwnd);
        if (length <= 0)
        {
            return string.Empty;
        }

        var buffer = new StringBuilder(length + 1);
        return NativeMethods.GetWindowTextW(hwnd, buffer, buffer.Capacity) > 0
            ? buffer.ToString()
            : string.Empty;
    }

    public bool IsWindowVisible(nint hwnd) => NativeMethods.IsWindowVisible(hwnd);

    public nint GetWindowStyle(nint hwnd, int index) =>
        NativeMethods.GetWindowLongPtr(hwnd, index);

    public nint SetWindowStyle(nint hwnd, int index, nint value) =>
        NativeMethods.SetWindowLongPtr(hwnd, index, value);

    public bool SetWindowPosition(
        nint hwnd,
        nint insertAfter,
        int x,
        int y,
        int width,
        int height,
        uint flags) =>
        NativeMethods.SetWindowPos(
            hwnd,
            insertAfter,
            x,
            y,
            width,
            height,
            flags);

    public bool TryGetMonitorWorkArea(ScreenPoint point, out ScreenRect workArea)
    {
        var monitor = NativeMethods.MonitorFromPoint(
            new NativePoint { X = point.X, Y = point.Y },
            NativeConstants.MonitorDefaultToNearest);
        var info = new MonitorInfo
        {
            Size = (uint)Marshal.SizeOf<MonitorInfo>()
        };

        if (monitor != nint.Zero && NativeMethods.GetMonitorInfoW(monitor, ref info))
        {
            workArea = new ScreenRect(
                info.WorkArea.Left,
                info.WorkArea.Top,
                info.WorkArea.Right,
                info.WorkArea.Bottom);
            return true;
        }

        workArea = default;
        return false;
    }

    public nint SetLowLevelKeyboardHook(LowLevelKeyboardProc callback) =>
        NativeMethods.SetWindowsHookExW(
            NativeConstants.WhKeyboardLl,
            callback,
            nint.Zero,
            0);

    public bool UnhookKeyboard(nint hook) =>
        NativeMethods.UnhookWindowsHookEx(hook);

    public nint CallNextKeyboardHook(
        nint hook,
        int code,
        nint message,
        nint data) =>
        NativeMethods.CallNextHookEx(hook, code, message, data);

    public nint SetWindowShowEventHook(WindowEventProc callback) =>
        NativeMethods.SetWinEventHook(
            NativeConstants.EventObjectShow,
            NativeConstants.EventObjectShow,
            nint.Zero,
            callback,
            0,
            0,
            NativeConstants.WineventOutOfContext |
            NativeConstants.WineventSkipOwnProcess);

    public bool UnhookWindowEvent(nint hook) =>
        NativeMethods.UnhookWinEvent(hook);

    public int GetLastError() => Marshal.GetLastWin32Error();

    public bool TryEnablePerMonitorV2() =>
        NativeMethods.SetProcessDpiAwarenessContext(
            NativeConstants.DpiAwarenessContextPerMonitorAwareV2);
}
