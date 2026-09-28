using Nyaworks.NyaLauncher.Model;

namespace Nyaworks.NyaLauncher.Runtime;

public static class RuntimeWindowPositioner
{
    public static WindowPlacement Calculate(
        ScreenPoint cursor,
        ScreenSize runtimeSize,
        ScreenRect workArea)
    {
        var centeredX = cursor.X - (runtimeSize.Width / 2);
        var centeredY = cursor.Y - (runtimeSize.Height / 2);
        var maximumX = workArea.Right - runtimeSize.Width;
        var maximumY = workArea.Bottom - runtimeSize.Height;

        var x = maximumX < workArea.Left
            ? workArea.Left
            : Math.Clamp(centeredX, workArea.Left, maximumX);
        var y = maximumY < workArea.Top
            ? workArea.Top
            : Math.Clamp(centeredY, workArea.Top, maximumY);

        return new WindowPlacement(
            x,
            y,
            runtimeSize.Width,
            runtimeSize.Height);
    }
}
