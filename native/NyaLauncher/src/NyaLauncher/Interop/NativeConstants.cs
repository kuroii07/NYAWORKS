namespace Nyaworks.NyaLauncher.Interop;

public static class NativeConstants
{
    public const int WhKeyboardLl = 13;
    public const uint VkSpace = 0x20;
    public const uint VkMenu = 0x12;
    public const uint WmKeyDown = 0x0100;
    public const uint WmKeyUp = 0x0101;
    public const uint WmSysKeyDown = 0x0104;
    public const uint WmSysKeyUp = 0x0105;
    public const uint EventObjectShow = 0x8002;
    public const uint WineventOutOfContext = 0x0000;
    public const uint WineventSkipOwnProcess = 0x0002;
    public const int ObjIdWindow = 0;
    public const int GwlStyle = -16;
    public const int GwlExStyle = -20;
    public const long WsCaption = 0x00C00000L;
    public const long WsThickFrame = 0x00040000L;
    public const long WsMinimizeBox = 0x00020000L;
    public const long WsMaximizeBox = 0x00010000L;
    public const long WsSysMenu = 0x00080000L;
    public const long WsExToolWindow = 0x00000080L;
    public const uint SwpNoSize = 0x00000001;
    public const uint SwpNoMove = 0x00000002;
    public const uint SwpNoZOrder = 0x00000004;
    public const uint SwpNoActivate = 0x00000010;
    public const uint SwpFrameChanged = 0x00000020;
    public const uint SwpShowWindow = 0x00000040;
    public const uint MonitorDefaultToNearest = 0x00000002;
    public const uint Th32csSnapProcess = 0x00000002;
    public static readonly nint HwndTopMost = new(-1);
    public static readonly nint DpiAwarenessContextPerMonitorAwareV2 = new(-4);
}
