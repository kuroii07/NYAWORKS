using Nyaworks.NyaLauncher.Model;

namespace Nyaworks.NyaLauncher.Runtime;

public interface IRuntimeWindowCoordinator
{
    bool TryPosition(LaunchSession session);
}
