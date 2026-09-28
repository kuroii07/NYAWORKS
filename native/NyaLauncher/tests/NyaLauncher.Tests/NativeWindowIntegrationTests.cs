using System.Drawing;
using System.Runtime.InteropServices;
using Nyaworks.NyaLauncher.Interop;
using Nyaworks.NyaLauncher.Model;
using Nyaworks.NyaLauncher.Runtime;
using Xunit;

namespace Nyaworks.NyaLauncher.Tests;

public sealed class NativeWindowIntegrationTests
{
    private const long RemovedStyleMask =
        NativeConstants.WsCaption |
        NativeConstants.WsThickFrame |
        NativeConstants.WsMinimizeBox |
        NativeConstants.WsMaximizeBox |
        NativeConstants.WsSysMenu;

    [Fact]
    public void StylesPositionsAndClosesOnlyTheOwnedTestWindow()
    {
        var native = new NativeWindowApi();
        nint testWindow;
        nint finalStyle;
        nint finalExtendedStyle;
        Rectangle finalBounds;
        WindowPlacement expectedPlacement;
        IReadOnlyList<nint> mutatedWindows;
        int enumerationCalls;

        using (var window = OwnedTestWindow.Start())
        {
            testWindow = window.Handle;
            var guardedNative = new OwnedWindowNativeApi(native, testWindow);
            var cursor = CreateInteriorCursor(native, window.Bounds);
            Assert.True(native.TryGetMonitorWorkArea(cursor, out var workArea));
            expectedPlacement = RuntimeWindowPositioner.Calculate(
                cursor,
                new ScreenSize(220, 220),
                workArea);
            var coordinator = new RuntimeWindowCoordinator(
                guardedNative,
                new RuntimeWindowStyler(guardedNative));
            var session = new LaunchSession(
                Sequence: 1,
                AeProcessId: Environment.ProcessId,
                Cursor: cursor,
                KeyDownTicks: 100,
                RuntimeWindow: testWindow,
                FoundTicks: 110,
                PositionedTicks: null,
                KeyUpTicks: null);

            Assert.True(coordinator.TryPosition(session));

            finalStyle = native.GetWindowStyle(
                testWindow,
                NativeConstants.GwlStyle);
            finalExtendedStyle = native.GetWindowStyle(
                testWindow,
                NativeConstants.GwlExStyle);
            finalBounds = window.Bounds;
            mutatedWindows = guardedNative.MutatedWindows.ToArray();
            enumerationCalls = guardedNative.EnumerationCalls;
        }

        Assert.Equal(0, finalStyle.ToInt64() & RemovedStyleMask);
        Assert.NotEqual(
            0,
            finalExtendedStyle.ToInt64() & NativeConstants.WsExToolWindow);
        Assert.Equal(
            new Rectangle(
                expectedPlacement.X,
                expectedPlacement.Y,
                expectedPlacement.Width,
                expectedPlacement.Height),
            finalBounds);
        Assert.Equal(0, enumerationCalls);
        Assert.NotEmpty(mutatedWindows);
        Assert.All(mutatedWindows, hwnd => Assert.Equal(testWindow, hwnd));
        Assert.False(IsWindow(testWindow));
    }

    private static ScreenPoint CreateInteriorCursor(
        INativeWindowApi native,
        Rectangle initialBounds)
    {
        var initialPoint = new ScreenPoint(
            initialBounds.Left + (initialBounds.Width / 2),
            initialBounds.Top + (initialBounds.Height / 2));
        Assert.True(native.TryGetMonitorWorkArea(initialPoint, out var workArea));

        return new ScreenPoint(
            Math.Min(workArea.Right - 111, workArea.Left + 360),
            Math.Min(workArea.Bottom - 111, workArea.Top + 360));
    }

    [DllImport("user32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool IsWindow(nint hwnd);

    private sealed class OwnedWindowNativeApi(
        INativeWindowApi inner,
        nint ownedWindow) : INativeWindowApi
    {
        public List<nint> MutatedWindows { get; } = [];
        public int EnumerationCalls { get; private set; }

        public nint GetWindowStyle(nint hwnd, int index)
        {
            EnsureOwned(hwnd);
            return inner.GetWindowStyle(hwnd, index);
        }

        public nint SetWindowStyle(nint hwnd, int index, nint value)
        {
            EnsureOwned(hwnd);
            MutatedWindows.Add(hwnd);
            return inner.SetWindowStyle(hwnd, index, value);
        }

        public bool SetWindowPosition(
            nint hwnd,
            nint insertAfter,
            int x,
            int y,
            int width,
            int height,
            uint flags)
        {
            EnsureOwned(hwnd);
            MutatedWindows.Add(hwnd);
            return inner.SetWindowPosition(
                hwnd,
                insertAfter,
                x,
                y,
                width,
                height,
                flags);
        }

        public IReadOnlyList<nint> EnumerateTopLevelWindows()
        {
            EnumerationCalls++;
            throw new InvalidOperationException(
                "The coordinator must not enumerate unrelated desktop windows.");
        }

        public bool TryGetMonitorWorkArea(
            ScreenPoint point,
            out ScreenRect workArea) =>
            inner.TryGetMonitorWorkArea(point, out workArea);

        public nint GetForegroundWindow() => inner.GetForegroundWindow();
        public int GetWindowProcessId(nint hwnd) => inner.GetWindowProcessId(hwnd);
        public bool TryGetCursorPosition(out ScreenPoint point) =>
            inner.TryGetCursorPosition(out point);
        public string GetWindowTitle(nint hwnd) => inner.GetWindowTitle(hwnd);
        public bool IsWindowVisible(nint hwnd) => inner.IsWindowVisible(hwnd);
        public nint SetLowLevelKeyboardHook(LowLevelKeyboardProc callback) =>
            inner.SetLowLevelKeyboardHook(callback);
        public bool UnhookKeyboard(nint hook) => inner.UnhookKeyboard(hook);
        public nint CallNextKeyboardHook(
            nint hook,
            int code,
            nint message,
            nint data) =>
            inner.CallNextKeyboardHook(hook, code, message, data);
        public nint SetWindowShowEventHook(WindowEventProc callback) =>
            inner.SetWindowShowEventHook(callback);
        public bool UnhookWindowEvent(nint hook) =>
            inner.UnhookWindowEvent(hook);
        public int GetLastError() => inner.GetLastError();
        public bool TryEnablePerMonitorV2() => inner.TryEnablePerMonitorV2();

        private void EnsureOwned(nint hwnd)
        {
            if (hwnd != ownedWindow)
            {
                throw new InvalidOperationException(
                    $"Attempted to mutate unrelated window 0x{hwnd:X}.");
            }
        }
    }

    private sealed class OwnedTestWindow : IDisposable
    {
        private readonly ManualResetEventSlim _ready = new(false);
        private readonly Thread _thread;
        private TestForm? _form;
        private Exception? _startupError;

        private OwnedTestWindow()
        {
            _thread = new Thread(Run)
            {
                IsBackground = true,
                Name = "NyaLauncher native integration test window"
            };
            _thread.SetApartmentState(ApartmentState.STA);
        }

        public nint Handle => Invoke(form => form.Handle);
        public Rectangle Bounds => Invoke(form => form.Bounds);

        public static OwnedTestWindow Start()
        {
            var window = new OwnedTestWindow();
            window._thread.Start();
            if (!window._ready.Wait(TimeSpan.FromSeconds(5)))
            {
                window.Dispose();
                throw new TimeoutException("The test window did not become ready.");
            }

            if (window._startupError is not null)
            {
                window.Dispose();
                throw new InvalidOperationException(
                    "The test window failed to start.",
                    window._startupError);
            }

            return window;
        }

        public void Dispose()
        {
            if (_form is { IsDisposed: false } form)
            {
                try
                {
                    form.BeginInvoke(form.Close);
                }
                catch (InvalidOperationException)
                {
                }
            }

            if (
                _thread.IsAlive &&
                !_thread.Join(TimeSpan.FromSeconds(5)))
            {
                throw new TimeoutException("The test window did not close.");
            }

            _ready.Dispose();
        }

        private T Invoke<T>(Func<Form, T> callback)
        {
            var form = _form ??
                throw new InvalidOperationException("The test window is unavailable.");
            return (T)form.Invoke(callback, form)!;
        }

        private void Run()
        {
            try
            {
                _form = new TestForm
                {
                    Text = $"NYAWORKS_NATIVE_TEST_{Guid.NewGuid():N}",
                    StartPosition = FormStartPosition.Manual,
                    Bounds = new Rectangle(80, 80, 320, 260),
                    ShowInTaskbar = false
                };
                _form.Shown += (_, _) => _ready.Set();
                Application.Run(_form);
            }
            catch (Exception error)
            {
                _startupError = error;
                _ready.Set();
            }
            finally
            {
                _form?.Dispose();
            }
        }

        private sealed class TestForm : Form
        {
            protected override bool ShowWithoutActivation => true;
        }
    }
}
