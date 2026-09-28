using Nyaworks.NyaLauncher.Model;

namespace Nyaworks.NyaLauncher.Interop;

public interface INativeWindowApi
{
    nint GetForegroundWindow();
    int GetWindowProcessId(nint hwnd);
    bool TryGetCursorPosition(out ScreenPoint point);
    IReadOnlyList<nint> EnumerateTopLevelWindows();
    string GetWindowTitle(nint hwnd);
    bool IsWindowVisible(nint hwnd);
    nint GetWindowStyle(nint hwnd, int index);
    nint SetWindowStyle(nint hwnd, int index, nint value);
    bool SetWindowPosition(
        nint hwnd,
        nint insertAfter,
        int x,
        int y,
        int width,
        int height,
        uint flags);
    bool TryGetMonitorWorkArea(ScreenPoint point, out ScreenRect workArea);
    nint SetLowLevelKeyboardHook(LowLevelKeyboardProc callback);
    bool UnhookKeyboard(nint hook);
    nint CallNextKeyboardHook(nint hook, int code, nint message, nint data);
    nint SetWindowShowEventHook(WindowEventProc callback);
    bool UnhookWindowEvent(nint hook);
    int GetLastError();
    bool TryEnablePerMonitorV2();
}
