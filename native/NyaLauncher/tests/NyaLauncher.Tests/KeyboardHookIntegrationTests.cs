using Nyaworks.NyaLauncher.Input;
using Nyaworks.NyaLauncher.Interop;
using Xunit;

namespace Nyaworks.NyaLauncher.Tests;

public sealed class KeyboardHookIntegrationTests
{
    [Fact]
    public void RealHookCanBeInstalledAndDisposed()
    {
        var hook = new KeyboardHook(
            new NativeWindowApi(),
            () => 0);

        try
        {
            hook.Start(_ => { });
            Assert.True(hook.IsRunning);
        }
        finally
        {
            hook.Dispose();
        }

        Assert.False(hook.IsRunning);
    }
}
