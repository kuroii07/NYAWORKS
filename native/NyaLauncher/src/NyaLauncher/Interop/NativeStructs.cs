using System.Runtime.InteropServices;

namespace Nyaworks.NyaLauncher.Interop;

[StructLayout(LayoutKind.Sequential)]
public struct NativePoint
{
    public int X;
    public int Y;
}

[StructLayout(LayoutKind.Sequential)]
public struct NativeRect
{
    public int Left;
    public int Top;
    public int Right;
    public int Bottom;
}

[StructLayout(LayoutKind.Sequential)]
public struct MonitorInfo
{
    public uint Size;
    public NativeRect Monitor;
    public NativeRect WorkArea;
    public uint Flags;
}

[StructLayout(LayoutKind.Sequential)]
public struct LowLevelKeyboardInput
{
    public uint VirtualKey;
    public uint ScanCode;
    public uint Flags;
    public uint Time;
    public nuint ExtraInfo;
}

[StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
internal struct ProcessEntry32
{
    public uint Size;
    public uint Usage;
    public uint ProcessId;
    public nint DefaultHeapId;
    public uint ModuleId;
    public uint Threads;
    public uint ParentProcessId;
    public int PriorityClassBase;
    public uint Flags;

    [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 260)]
    public string ExecutableFile;
}

public delegate nint LowLevelKeyboardProc(int code, nint message, nint data);

public delegate void WindowEventProc(
    nint hook,
    uint eventType,
    nint hwnd,
    int objectId,
    int childId,
    uint eventThread,
    uint eventTime);
