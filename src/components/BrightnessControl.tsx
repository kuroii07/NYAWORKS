import type { CSSProperties } from "react";

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
  const progress =
    max > min ? Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100)) : 0;
  const sliderStyle = {
    "--brightness-progress": `${progress}%`
  } as CSSProperties;

  return (
    <div className="brightness-control">
      <input
        type="range"
        min={min}
        max={max}
        step={1}
        value={value}
        style={sliderStyle}
        aria-label={ariaLabel}
        onChange={(event) => onChange(Number(event.currentTarget.value))}
      />
      <output aria-live="polite">{value}%</output>
    </div>
  );
}
