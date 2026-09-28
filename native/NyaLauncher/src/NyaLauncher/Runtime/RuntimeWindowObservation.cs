namespace Nyaworks.NyaLauncher.Runtime;

public readonly record struct RuntimeWindowObservation(
    long Sequence,
    RuntimeWindowCandidate Candidate,
    long FoundTicks);
