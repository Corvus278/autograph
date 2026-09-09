import * as RadixSlider from '@radix-ui/react-slider';
import { cx } from '@shared/lib/styles';
import type { FC } from 'react';
import { useId } from 'react';

import type { SliderProps } from './Slider.types';

export const Slider: FC<SliderProps> = (props) => {
  const { label, value, min, max, step, onChange, isDisabled = false, className } = props;
  const labelId = useId();

  const handleSliderChange = (values: number[]) => {
    const [next] = values;

    if (next !== undefined) {
      onChange(next);
    }
  };

  return (
    <div className={cx('flex flex-col gap-1.5', className)}>
      <div className="flex items-baseline justify-between">
        <span id={labelId} className="text-sm text-zinc-300">
          {label}
        </span>

        <span className="text-sm text-zinc-400 tabular-nums">{value}</span>
      </div>

      <RadixSlider.Root
        className="relative flex h-4 w-full touch-none items-center select-none data-disabled:opacity-50"
        value={[value]}
        min={min}
        max={max}
        step={step}
        disabled={isDisabled}
        onValueChange={handleSliderChange}
      >
        <RadixSlider.Track className="relative h-1 grow rounded-full bg-zinc-700">
          <RadixSlider.Range className="absolute h-full rounded-full bg-violet-500" />
        </RadixSlider.Track>

        <RadixSlider.Thumb
          aria-labelledby={labelId}
          className="block size-4 rounded-full bg-zinc-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-400"
        />
      </RadixSlider.Root>
    </div>
  );
};
