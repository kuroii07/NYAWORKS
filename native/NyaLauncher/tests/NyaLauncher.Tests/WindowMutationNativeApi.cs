using Nyaworks.NyaLauncher.Interop;
using Nyaworks.NyaLauncher.Model;

namespace Nyaworks.NyaLauncher.Tests;

internal sealed class WindowMutationNativeApi : INativeWindowApi
{
    public nint Style { get; init; } = new(1);
    public nint ExtendedStyle { get; init; }
    public ScreenRect WorkArea { get; init; }
    public bool FailStyleMutation { get; init; }
    public nint AppliedStyle { get; private set; }
    public nint AppliedExtendedStyle { get; private set; }
    public List<PositionCall> PositionCalls { get; } = [];

    public nint GetWindowStyle(nint hwnd, int index) =>
        index == NativeConstants.GwlStyle ? Style : ExtendedStyle;

    public nint SetWindowStyle(nint hwnd, int index, nint value)
    {
        if (FailStyleMutation)
        {
            return nint.Zero;
        }

        if (index == NativeConstants.GwlStyle)
        {
            AppliedStyle = value;
            return Style;
        }

        AppliedExtendedStyle = value;
        return ExtendedStyle == nint.Zero ? new nint(1) : ExtendedStyle;
    }

    public bool SetWindowPosition(
        nint hwnd,
        nint insertAfter,
        int x,
        int y,
        int width,
        int height,
        uint flags)
    {
        PositionCalls.Add(new PositionCall(
            hwnd,
            insertAfter,
            x,
            y,
            width,
            height,
            flags));
        return true;
    }

    public bool TryGetMonitorWorkArea(ScreenPoint point, out ScreenRect workArea)
    {
        workArea = WorkArea;
        return true;
    }

    public int GetLastError() => FailStyleMutation ? 5 : 0;
    public nint GetForegroundWindow() => nint.Zero;
    public int GetWindowProcessId(nint hwnd) => 0;
    public bool TryGetCursorPosition(out ScreenPoint point) { point = default; return false; }
    public IReadOnlyList<nint> EnumerateTopLevelWindows() => [];
    public string GetWindowTitle(nint hwnd) => string.Empty;
    public bool IsWindowVisible(nint hwnd) => false;
    public nint SetLowLevelKeyboardHook(LowLevelKeyboardProc callback) => nint.Zero;
    public bool UnhookKeyboard(nint hook) => false;
    public nint CallNextKeyboardHook(nint hook, int code, nint message, nint data) => nint.Zero;
    public nint SetWindowShowEventHook(WindowEventProc callback) => nint.Zero;
    public bool UnhookWindowEvent(nint hook) => false;
    public bool TryEnablePerMonitorV2() => false;
}

internal sealed record PositionCall(
    nint Window,
    nint InsertAfter,
    int X,
    int Y,
    int Width,
    int Height,
    uint Flags);
