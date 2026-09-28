using Nyaworks.NyaLauncher.Interop;
using Nyaworks.NyaLauncher.Model;
using Nyaworks.NyaLauncher.Runtime;
using Xunit;

namespace Nyaworks.NyaLauncher.Tests;

public sealed class RuntimeWindowCoordinatorTests
{
    [Fact]
    public void StylesAndPositionsOnNegativeCoordinateMonitor()
    {
        var native = new WindowMutationNativeApi
        {
            WorkArea = new ScreenRect(-1920, 0, 0, 1040)
        };
        var coordinator = new RuntimeWindowCoordinator(
            native,
            new RuntimeWindowStyler(native));
        var session = CreateSession((nint)50, new ScreenPoint(-960, 540));

        var positioned = coordinator.TryPosition(session);

        Assert.True(positioned);
        Assert.Equal(2, native.PositionCalls.Count);
        var finalCall = native.PositionCalls[1];
        Assert.Equal((-1070, 430, 220, 220), (
            finalCall.X,
            finalCall.Y,
            finalCall.Width,
            finalCall.Height));
        Assert.Equal(
            NativeConstants.SwpNoActivate |
            NativeConstants.SwpFrameChanged |
            NativeConstants.SwpShowWindow,
            finalCall.Flags);
    }

    [Fact]
    public void FailedStyleMutationStopsBeforeFinalPositioning()
    {
        var native = new WindowMutationNativeApi
        {
            FailStyleMutation = true,
            WorkArea = new ScreenRect(0, 0, 1920, 1040)
        };
        var coordinator = new RuntimeWindowCoordinator(
            native,
            new RuntimeWindowStyler(native));

        Assert.False(coordinator.TryPosition(
            CreateSession((nint)50, new ScreenPoint(960, 520))));
        Assert.Empty(native.PositionCalls);
    }

    [Fact]
    public void DoesNotMutateTheSameRuntimeTwice()
    {
        var native = new WindowMutationNativeApi
        {
            WorkArea = new ScreenRect(0, 0, 1920, 1040)
        };
        var coordinator = new RuntimeWindowCoordinator(
            native,
            new RuntimeWindowStyler(native));
        var session = CreateSession((nint)50, new ScreenPoint(960, 520));

        Assert.True(coordinator.TryPosition(session));
        Assert.False(coordinator.TryPosition(session));
        Assert.Equal(2, native.PositionCalls.Count);
    }

    [Fact]
    public void AllowsAReusedRuntimeHandleInANewLaunchSequence()
    {
        var native = new WindowMutationNativeApi
        {
            WorkArea = new ScreenRect(0, 0, 1920, 1040)
        };
        var coordinator = new RuntimeWindowCoordinator(
            native,
            new RuntimeWindowStyler(native));

        Assert.True(coordinator.TryPosition(
            CreateSession((nint)50, new ScreenPoint(960, 520), sequence: 1)));
        Assert.True(coordinator.TryPosition(
            CreateSession((nint)50, new ScreenPoint(700, 400), sequence: 2)));
        Assert.Equal(4, native.PositionCalls.Count);
    }

    private static LaunchSession CreateSession(
        nint hwnd,
        ScreenPoint cursor,
        long sequence = 1) =>
        new(
            Sequence: sequence,
            AeProcessId: 42,
            Cursor: cursor,
            KeyDownTicks: 100,
            RuntimeWindow: hwnd,
            FoundTicks: 120,
            PositionedTicks: null,
            KeyUpTicks: null);
}
