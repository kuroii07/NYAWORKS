using Nyaworks.NyaLauncher.Ae;
using Nyaworks.NyaLauncher.Diagnostics;
using Nyaworks.NyaLauncher.Input;
using Nyaworks.NyaLauncher.Interop;
using Nyaworks.NyaLauncher.Runtime;

namespace Nyaworks.NyaLauncher;

internal static class Program
{
    [STAThread]
    private static int Main()
    {
        try
        {
            var native = new NativeWindowApi();
            native.TryEnablePerMonitorV2();
            ApplicationConfiguration.Initialize();

            if (!SingleInstanceGuard.TryAcquire(out var instance))
            {
                return 0;
            }

            using (instance)
            {
                var processes = new ProcessCatalog();
                using var context = new LauncherApplicationContext(
                    native,
                    new AeForegroundGuard(native, processes),
                    new Input.ShortcutStateMachine(),
                    new KeyboardHook(native),
                    new RuntimeWindowWatcher(
                        native,
                        new RuntimeWindowDetector(native, processes)),
                    new RuntimeWindowCoordinator(
                        native,
                        new RuntimeWindowStyler(native)),
                    new LauncherLog());
                Application.Run(context);
            }

            return 0;
        }
        catch (Exception error)
        {
            LauncherFailureReporter.TryWrite(error);
            return 1;
        }
    }
}
