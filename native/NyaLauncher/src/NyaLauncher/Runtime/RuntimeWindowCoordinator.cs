using Nyaworks.NyaLauncher.Interop;
using Nyaworks.NyaLauncher.Model;

namespace Nyaworks.NyaLauncher.Runtime;

public sealed class RuntimeWindowCoordinator(
    INativeWindowApi native,
    RuntimeWindowStyler styler) : IRuntimeWindowCoordinator
{
    private static readonly ScreenSize RuntimeSize = new(220, 220);
    private readonly Dictionary<nint, long> _lastPositionedSequence = [];

    public bool TryPosition(LaunchSession session)
    {
        if (
            session.RuntimeWindow == nint.Zero ||
            _lastPositionedSequence.GetValueOrDefault(session.RuntimeWindow) ==
                session.Sequence ||
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
            _lastPositionedSequence[session.RuntimeWindow] = session.Sequence;
        }

        return positioned;
    }
}
