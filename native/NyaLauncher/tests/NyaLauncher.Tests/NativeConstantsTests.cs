using Nyaworks.NyaLauncher.Interop;
using Xunit;

namespace Nyaworks.NyaLauncher.Tests;

public sealed class NativeConstantsTests
{
    [Fact]
    public void PinsKeyboardAndWindowConstants()
    {
        Assert.Equal(13, NativeConstants.WhKeyboardLl);
        Assert.Equal(0x20u, NativeConstants.VkSpace);
        Assert.Equal(0x12u, NativeConstants.VkMenu);
        Assert.Equal(0x8002u, NativeConstants.EventObjectShow);
        Assert.Equal(-16, NativeConstants.GwlStyle);
        Assert.Equal(-20, NativeConstants.GwlExStyle);
        Assert.Equal(0x00C00000L, NativeConstants.WsCaption);
        Assert.Equal(0x00040000L, NativeConstants.WsThickFrame);
        Assert.Equal(0x00080000L, NativeConstants.WsSysMenu);
        Assert.Equal(0x00000020u, NativeConstants.SwpFrameChanged);
        Assert.Equal(0x00000010u, NativeConstants.SwpNoActivate);
    }
}
