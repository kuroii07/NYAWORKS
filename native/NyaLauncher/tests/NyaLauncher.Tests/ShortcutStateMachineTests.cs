using Nyaworks.NyaLauncher.Input;
using Nyaworks.NyaLauncher.Model;
using Xunit;

namespace Nyaworks.NyaLauncher.Tests;

public sealed class ShortcutStateMachineTests
{
    private const uint VkSpace = 0x20;
    private const uint VkMenu = 0x12;

    [Fact]
    public void AeForegroundAltSpaceArmsOneSession()
    {
        var machine = new ShortcutStateMachine();

        var armed = machine.TryArm(
            isAeForeground: true,
            altDown: true,
            virtualKey: VkSpace,
            aeProcessId: 42,
            cursor: new ScreenPoint(640, 360),
            timestampTicks: 100);

        Assert.True(armed);
        Assert.Equal(LaunchPhase.WaitingForRuntime, machine.Phase);
        Assert.Equal(1, machine.Current?.Sequence);
        Assert.Equal(42, machine.Current?.AeProcessId);
        Assert.Equal(new ScreenPoint(640, 360), machine.Current?.Cursor);
        Assert.Equal(100, machine.Current?.KeyDownTicks);
    }

    [Theory]
    [InlineData(false, true, VkSpace)]
    [InlineData(true, false, VkSpace)]
    [InlineData(true, true, 0x41)]
    public void InvalidArmConditionsRemainIdle(
        bool isAeForeground,
        bool altDown,
        uint virtualKey)
    {
        var machine = new ShortcutStateMachine();

        var armed = machine.TryArm(
            isAeForeground,
            altDown,
            virtualKey,
            aeProcessId: 42,
            cursor: new ScreenPoint(1, 2),
            timestampTicks: 100);

        Assert.False(armed);
        Assert.Equal(LaunchPhase.Idle, machine.Phase);
        Assert.Null(machine.Current);
    }

    [Fact]
    public void AutoRepeatDoesNotReplaceTheActiveSession()
    {
        var machine = new ShortcutStateMachine();
        machine.TryArm(true, true, VkSpace, 42, new ScreenPoint(10, 20), 100);

        var repeated = machine.TryArm(
            true,
            true,
            VkSpace,
            99,
            new ScreenPoint(900, 800),
            200);

        Assert.False(repeated);
        Assert.Equal(1, machine.Current?.Sequence);
        Assert.Equal(42, machine.Current?.AeProcessId);
        Assert.Equal(new ScreenPoint(10, 20), machine.Current?.Cursor);
        Assert.Equal(100, machine.Current?.KeyDownTicks);
    }

    [Fact]
    public void RuntimePositionTransitionStoresWindowAndTimestamps()
    {
        var machine = new ShortcutStateMachine();
        machine.TryArm(true, true, VkSpace, 42, new ScreenPoint(10, 20), 100);

        var positioned = machine.TryMarkRuntimePositioned(
            hwnd: (nint)1234,
            foundTicks: 140,
            positionedTicks: 150);

        Assert.True(positioned);
        Assert.Equal(LaunchPhase.RuntimePositioned, machine.Phase);
        Assert.Equal((nint)1234, machine.Current?.RuntimeWindow);
        Assert.Equal(140, machine.Current?.FoundTicks);
        Assert.Equal(150, machine.Current?.PositionedTicks);
    }

    [Theory]
    [InlineData(VkSpace)]
    [InlineData(VkMenu)]
    public void ShortcutKeyUpRecordsReleaseAndReturnsToIdle(uint virtualKey)
    {
        var machine = new ShortcutStateMachine();
        machine.TryArm(true, true, VkSpace, 42, new ScreenPoint(10, 20), 100);

        var released = machine.TryRelease(virtualKey, timestampTicks: 190);

        Assert.True(released);
        Assert.Equal(LaunchPhase.Idle, machine.Phase);
        Assert.Equal(190, machine.Current?.KeyUpTicks);
    }

    [Fact]
    public void ResetClearsAnActiveSession()
    {
        var machine = new ShortcutStateMachine();
        machine.TryArm(true, true, VkSpace, 42, new ScreenPoint(10, 20), 100);

        machine.Reset();

        Assert.Equal(LaunchPhase.Idle, machine.Phase);
        Assert.Null(machine.Current);
    }

    [Fact]
    public void StalePositionCallbackIsRejectedAfterReset()
    {
        var machine = new ShortcutStateMachine();
        machine.TryArm(true, true, VkSpace, 42, new ScreenPoint(10, 20), 100);
        machine.Reset();

        var positioned = machine.TryMarkRuntimePositioned(
            hwnd: (nint)1234,
            foundTicks: 140,
            positionedTicks: 150);

        Assert.False(positioned);
        Assert.Equal(LaunchPhase.Idle, machine.Phase);
        Assert.Null(machine.Current);
    }
}
