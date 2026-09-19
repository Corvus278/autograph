import * as RadixSlider from '@radix-ui/react-slider';
import { cx } from '@shared/lib/styles';
import type { FC } from 'react';
import { useId } from 'react';

import type { ValueSliderProps } from './ValueSlider.types';

export const ValueSlider: FC<ValueSliderProps> = (props) => {
  const {
    label,
    value,
    min,
    max,
    step,
    formatValue,
    onChange,
    onValueCommit,
    isDisabled = false,
    className,
  } = props;
  const labelId = useId();
  const valueText = formatValue(value);

  const handleSliderChange = (values: number[]) => {
    const [next] = values;

    if (next !== undefined) {
      onChange(next);
    }
  };

  const handleSliderCommit = (values: number[]) => {
    const [next] = values;

    if (next !== undefined && onValueCommit) {
      onValueCommit(next);
    }
  };

  return (
    <div className={cx('flex flex-col gap-1.5', className)}>
      <div className="flex items-baseline justify-between">
        <span id={labelId} className="text-sm text-fg-muted">
          {label}
        </span>

        <span className="text-sm text-fg tabular-nums">{valueText}</span>
      </div>

      <RadixSlider.Root
        className="relative flex h-4 w-full touch-none items-center select-none data-disabled:opacity-50"
        value={[value]}
        min={min}
        max={max}
        step={step}
        disabled={isDisabled}
        onValueChange={handleSliderChange}
        onValueCommit={handleSliderCommit}
      >
        <RadixSlider.Track className="relative h-1 grow rounded-full bg-border-strong">
          <RadixSlider.Range className="absolute h-full rounded-full bg-accent" />
        </RadixSlider.Track>

        <RadixSlider.Thumb
          aria-labelledby={labelId}
          aria-valuetext={valueText}
          className="block size-4 rounded-full bg-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        />
      </RadixSlider.Root>
    </div>
  );
};
