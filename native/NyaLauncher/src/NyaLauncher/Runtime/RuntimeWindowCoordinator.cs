using Nyaworks.NyaLauncher.Interop;
using Nyaworks.NyaLauncher.Model;

namespace Nyaworks.NyaLauncher.Runtime;

public sealed class RuntimeWindowCoordinator(
    INativeWindowApi native,
    RuntimeWindowStyler styler) : IRuntimeWindowCoordinator
{
    private static readonly ScreenSize RuntimeSize = new(220, 220);
    private readonly HashSet<nint> _positionedWindows = [];

    public bool TryPosition(LaunchSession session)
    {
        if (
            session.RuntimeWindow == nint.Zero ||
            _positionedWindows.Contains(session.RuntimeWindow) ||
            !native.TryGetMonitorWorkArea(session.Cursor, out var workArea) ||
            !styler.TryApply(session.RuntimeWindow))
        {
            return false;
        }

        var placement = RuntimeWindowPositioner.Calculate(
            session.Cursor,
            RuntimeSize,
            workArea);
        var positioned = native.SetWindowPosition(
            session.RuntimeWindow,
            NativeConstants.HwndTopMost,
            placement.X,
            placement.Y,
            placement.Width,
            placement.Height,
            NativeConstants.SwpNoActivate |
            NativeConstants.SwpFrameChanged |
            NativeConstants.SwpShowWindow);

        if (positioned)
        {
            _positionedWindows.Add(session.RuntimeWindow);
        }

        return positioned;
    }
}
