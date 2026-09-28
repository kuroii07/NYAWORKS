using System.Runtime.InteropServices;
using Nyaworks.NyaLauncher.Input;
using Nyaworks.NyaLauncher.Interop;
using Xunit;

namespace Nyaworks.NyaLauncher.Tests;

public sealed class KeyboardHookTests
{
    [Fact]
    public void ForwardsKeyboardSamplesAndDelegatesToTheNextHook()
    {
        var native = new HookWatcherNativeApi();
        using var hook = new KeyboardHook(native, () => 1234);
        KeyboardSample? received = null;
        hook.Start(sample => received = sample);

        var result = Invoke(
            native.KeyboardCallback!,
            NativeConstants.WmSysKeyDown,
            NativeConstants.VkSpace,
            flags: 0x20);

        Assert.Equal(new nint(987), result);
        Assert.Equal(
            new KeyboardSample(
                NativeConstants.VkSpace,
                IsKeyDown: true,
                IsKeyUp: false,
                AltDown: true,
                TimestampTicks: 1234),
            received);
        Assert.Equal(1, native.CallNextCount);
    }

    [Fact]
    public void DelegatesToTheNextHookWhenTheConsumerThrows()
    {
        var native = new HookWatcherNativeApi();
        using var hook = new KeyboardHook(native, () => 100);
        hook.Start(_ => throw new InvalidOperationException("test"));

        var result = Invoke(
            native.KeyboardCallback!,
            NativeConstants.WmKeyDown,
            NativeConstants.VkSpace,
            flags: 0);

        Assert.Equal(new nint(987), result);
        Assert.Equal(1, native.CallNextCount);
    }

    [Fact]
    public void DisposeUnhooksOnlyOnce()
    {
        var native = new HookWatcherNativeApi();
        var hook = new KeyboardHook(native, () => 100);
        hook.Start(_ => { });

        hook.Dispose();
        hook.Dispose();

        Assert.Equal(1, native.UnhookKeyboardCount);
        Assert.False(hook.IsRunning);
    }

    private static nint Invoke(
        LowLevelKeyboardProc callback,
        uint message,
        uint virtualKey,
        uint flags)
    {
        var input = new LowLevelKeyboardInput
        {
            VirtualKey = virtualKey,
            Flags = flags
        };
        var pointer = Marshal.AllocHGlobal(
            Marshal.SizeOf<LowLevelKeyboardInput>());

        try
        {
            Marshal.StructureToPtr(input, pointer, fDeleteOld: false);
            return callback(0, new nint(message), pointer);
        }
        finally
        {
            Marshal.FreeHGlobal(pointer);
        }
    }
}
