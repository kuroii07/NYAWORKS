namespace Nyaworks.NyaLauncher.Tests;

internal sealed class ManualTimeProvider : TimeProvider
{
    private readonly List<ManualTimer> _timers = [];
    private DateTimeOffset _utcNow =
        new(2026, 9, 28, 0, 0, 0, TimeSpan.Zero);
    private long _timestamp;

    public int CreatedTimerCount => _timers.Count;
    public bool AllTimersDisposed => _timers.All(timer => timer.IsDisposed);

    public override DateTimeOffset GetUtcNow() => _utcNow;
    public override long GetTimestamp() => _timestamp;
    public override long TimestampFrequency => TimeSpan.TicksPerSecond;

    public override ITimer CreateTimer(
        TimerCallback callback,
        object? state,
        TimeSpan dueTime,
        TimeSpan period)
    {
        var timer = new ManualTimer(this, callback, state, dueTime, period);
        _timers.Add(timer);
        return timer;
    }

    public void Advance(TimeSpan elapsed)
    {
        _utcNow += elapsed;
        _timestamp += elapsed.Ticks;

        foreach (var timer in _timers.ToArray())
        {
            timer.FireDue(_utcNow);
        }
    }

    private sealed class ManualTimer : ITimer
    {
        private readonly ManualTimeProvider _owner;
        private readonly TimerCallback _callback;
        private readonly object? _state;
        private TimeSpan _period;
        private DateTimeOffset? _next;

        public ManualTimer(
            ManualTimeProvider owner,
            TimerCallback callback,
            object? state,
            TimeSpan dueTime,
            TimeSpan period)
        {
            _owner = owner;
            _callback = callback;
            _state = state;
            Change(dueTime, period);
        }

        public bool IsDisposed { get; private set; }

        public bool Change(TimeSpan dueTime, TimeSpan period)
        {
            if (IsDisposed)
            {
                return false;
            }

            _period = period;
            _next = dueTime == Timeout.InfiniteTimeSpan
                ? null
                : _owner.GetUtcNow() + dueTime;
            return true;
        }

        public void Dispose()
        {
            IsDisposed = true;
            _next = null;
        }

        public ValueTask DisposeAsync()
        {
            Dispose();
            return ValueTask.CompletedTask;
        }

        public void FireDue(DateTimeOffset now)
        {
            while (!IsDisposed && _next is { } next && now >= next)
            {
                _callback(_state);
                if (IsDisposed || _period == Timeout.InfiniteTimeSpan)
                {
                    _next = null;
                    return;
                }

                _next = next + _period;
            }
        }
    }
}
