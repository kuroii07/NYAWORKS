interface BrightnessControlProps {
  value: number;
  min: number;
  max: number;
  ariaLabel: string;
  onChange: (value: number) => void;
}

export function BrightnessControl({
  value,
  min,
  max,
  ariaLabel,
  onChange
}: BrightnessControlProps) {
  return (
    <div className="brightness-control">
      <input
        type="range"
        min={min}
        max={max}
        step={1}
        value={value}
        aria-label={ariaLabel}
        onChange={(event) => onChange(Number(event.currentTarget.value))}
      />
      <output aria-live="polite">{value}%</output>
    </div>
  );
}
