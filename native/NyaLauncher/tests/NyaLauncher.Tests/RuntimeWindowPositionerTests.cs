using Nyaworks.NyaLauncher.Model;
using Nyaworks.NyaLauncher.Runtime;
using Xunit;

namespace Nyaworks.NyaLauncher.Tests;

public sealed class RuntimeWindowPositionerTests
{
    private static readonly ScreenSize RuntimeSize = new(220, 220);
    private static readonly ScreenRect PrimaryWorkArea = new(0, 0, 1920, 1040);

    [Fact]
    public void CentersRuntimeOnCursor()
    {
        var result = RuntimeWindowPositioner.Calculate(
            new ScreenPoint(960, 520),
            RuntimeSize,
            PrimaryWorkArea);

        Assert.Equal(new WindowPlacement(850, 410, 220, 220), result);
    }

    [Theory]
    [InlineData(20, 520, 0, 410)]
    [InlineData(1900, 520, 1700, 410)]
    [InlineData(960, 20, 850, 0)]
    [InlineData(960, 1020, 850, 820)]
    [InlineData(0, 0, 0, 0)]
    [InlineData(1920, 1040, 1700, 820)]
    public void ClampsAtWorkAreaEdges(
        int cursorX,
        int cursorY,
        int expectedX,
        int expectedY)
    {
        var result = RuntimeWindowPositioner.Calculate(
            new ScreenPoint(cursorX, cursorY),
            RuntimeSize,
            PrimaryWorkArea);

        Assert.Equal(new WindowPlacement(expectedX, expectedY, 220, 220), result);
    }

    [Fact]
    public void PreservesNegativeCoordinateMonitor()
    {
        var result = RuntimeWindowPositioner.Calculate(
            new ScreenPoint(-960, 540),
            RuntimeSize,
            new ScreenRect(-1920, 0, 0, 1040));

        Assert.Equal(new WindowPlacement(-1070, 430, 220, 220), result);
    }

    [Fact]
    public void PreservesNonZeroWorkAreaOrigin()
    {
        var result = RuntimeWindowPositioner.Calculate(
            new ScreenPoint(2440, 700),
            RuntimeSize,
            new ScreenRect(1920, 40, 3000, 1000));

        Assert.Equal(new WindowPlacement(2330, 590, 220, 220), result);
    }

    [Fact]
    public void OversizedRuntimeAnchorsToWorkAreaOrigin()
    {
        var result = RuntimeWindowPositioner.Calculate(
            new ScreenPoint(150, 150),
            new ScreenSize(600, 500),
            new ScreenRect(100, 100, 500, 400));

        Assert.Equal(new WindowPlacement(100, 100, 600, 500), result);
    }
}
