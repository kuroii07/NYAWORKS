using Nyaworks.NyaLauncher.Model;

namespace Nyaworks.NyaLauncher.Input;

public sealed class ShortcutStateMachine
{
    private const uint VkSpace = 0x20;
    private const uint VkMenu = 0x12;
    private long _sequence;

    public LaunchPhase Phase { get; private set; } = LaunchPhase.Idle;

    public LaunchSession? Current { get; private set; }

    public bool TryArm(
        bool isAeForeground,
        bool altDown,
        uint virtualKey,
        int aeProcessId,
        ScreenPoint cursor,
        long timestampTicks)
    {
        if (
            Phase != LaunchPhase.Idle ||
            !isAeForeground ||
            !altDown ||
            virtualKey != VkSpace ||
            aeProcessId <= 0)
        {
            return false;
        }

        Current = new LaunchSession(
            Sequence: ++_sequence,
            AeProcessId: aeProcessId,
            Cursor: cursor,
            KeyDownTicks: timestampTicks,
            RuntimeWindow: nint.Zero,
            FoundTicks: null,
            PositionedTicks: null,
            KeyUpTicks: null);
        Phase = LaunchPhase.WaitingForRuntime;
        return true;
    }

    public bool TryMarkRuntimePositioned(
        nint hwnd,
        long foundTicks,
        long positionedTicks)
    {
        if (
            Phase != LaunchPhase.WaitingForRuntime ||
            Current is null ||
            hwnd == nint.Zero)
        {
            return false;
        }

        Current = Current with
        {
            RuntimeWindow = hwnd,
            FoundTicks = foundTicks,
            PositionedTicks = positionedTicks
        };
        Phase = LaunchPhase.RuntimePositioned;
        return true;
    }

    public bool TryRelease(uint virtualKey, long timestampTicks)
    {
        if (
            Phase == LaunchPhase.Idle ||
            Current is null ||
            (virtualKey != VkSpace && virtualKey != VkMenu))
        {
            return false;
        }

        Current = Current with { KeyUpTicks = timestampTicks };
        Phase = LaunchPhase.Idle;
        return true;
    }

    public void Reset()
    {
        Phase = LaunchPhase.Idle;
        Current = null;
    }
}
