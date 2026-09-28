using Nyaworks.NyaLauncher.Interop;
using Nyaworks.NyaLauncher.Runtime;
using Xunit;

namespace Nyaworks.NyaLauncher.Tests;

public sealed class RuntimeWindowStylerTests
{
    [Fact]
    public void RemovesFrameStylesAndAddsToolWindowStyle()
    {
        var native = new WindowMutationNativeApi
        {
            Style = new nint(
                NativeConstants.WsCaption |
                NativeConstants.WsThickFrame |
                NativeConstants.WsMinimizeBox |
                NativeConstants.WsMaximizeBox |
                NativeConstants.WsSysMenu |
                0x1),
            ExtendedStyle = nint.Zero
        };

        var applied = new RuntimeWindowStyler(native).TryApply((nint)50);

        Assert.True(applied);
        Assert.Equal(new nint(0x1), native.AppliedStyle);
        Assert.Equal(
            new nint(NativeConstants.WsExToolWindow),
            native.AppliedExtendedStyle);
        Assert.Single(native.PositionCalls);
        Assert.Equal(
            NativeConstants.SwpNoMove |
            NativeConstants.SwpNoSize |
            NativeConstants.SwpNoActivate |
            NativeConstants.SwpFrameChanged,
            native.PositionCalls[0].Flags);
    }

    [Fact]
    public void StopsWhenStyleMutationFails()
    {
        var native = new WindowMutationNativeApi
        {
            Style = new nint(NativeConstants.WsCaption),
            FailStyleMutation = true
        };

        var applied = new RuntimeWindowStyler(native).TryApply((nint)50);

        Assert.False(applied);
        Assert.Empty(native.PositionCalls);
    }
}
