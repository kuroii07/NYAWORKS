using Nyaworks.NyaLauncher.Interop;

namespace Nyaworks.NyaLauncher.Runtime;

public sealed class RuntimeWindowStyler(INativeWindowApi native)
{
    private const long RemovedStyleMask =
        NativeConstants.WsCaption |
        NativeConstants.WsThickFrame |
        NativeConstants.WsMinimizeBox |
        NativeConstants.WsMaximizeBox |
        NativeConstants.WsSysMenu;

    public bool TryApply(nint hwnd)
    {
        if (hwnd == nint.Zero)
        {
            return false;
        }

        var originalStyle = native.GetWindowStyle(hwnd, NativeConstants.GwlStyle);
        var updatedStyle = new nint(originalStyle.ToInt64() & ~RemovedStyleMask);
        if (!TrySetStyle(hwnd, NativeConstants.GwlStyle, updatedStyle))
        {
            return false;
        }

        var originalExtendedStyle = native.GetWindowStyle(
            hwnd,
            NativeConstants.GwlExStyle);
        var updatedExtendedStyle = new nint(
            originalExtendedStyle.ToInt64() |
            NativeConstants.WsExToolWindow);
        if (!TrySetStyle(hwnd, NativeConstants.GwlExStyle, updatedExtendedStyle))
        {
            return false;
        }

        return native.SetWindowPosition(
            hwnd,
            NativeConstants.HwndTopMost,
            0,
            0,
            0,
            0,
            NativeConstants.SwpNoMove |
            NativeConstants.SwpNoSize |
            NativeConstants.SwpNoActivate |
            NativeConstants.SwpFrameChanged);
    }

    private bool TrySetStyle(nint hwnd, int index, nint value)
    {
        var previous = native.SetWindowStyle(hwnd, index, value);
        return previous != nint.Zero || native.GetLastError() == 0;
    }
}
