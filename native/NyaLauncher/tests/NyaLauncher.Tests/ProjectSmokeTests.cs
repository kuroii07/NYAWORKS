using Xunit;

namespace Nyaworks.NyaLauncher.Tests;

public sealed class ProjectSmokeTests
{
    [Fact]
    public void TestHostRunsOnWindows()
    {
        Assert.True(OperatingSystem.IsWindows());
    }
}
