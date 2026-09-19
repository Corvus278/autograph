import * as RadixRadioGroup from '@radix-ui/react-radio-group';
import { cx } from '@shared/lib/styles';
import type { FC } from 'react';

import type { TileRadioProps } from './TileRadio.types';

export const TileRadio: FC<TileRadioProps> = (props) => {
  const { label, value, options, onChange, isDisabled = false, className } = props;

  const handleGroupValueChange = (next: string) => {
    onChange(next);
  };

  return (
    <RadixRadioGroup.Root
      aria-label={label}
      orientation="horizontal"
      value={value}
      disabled={isDisabled}
      className={cx('flex flex-wrap gap-2', className)}
      onValueChange={handleGroupValueChange}
    >
      {options.map(({ value: optionValue, label: optionLabel, preview }) => {
        return (
          <RadixRadioGroup.Item
            key={optionValue}
            value={optionValue}
            className="flex w-16 cursor-pointer flex-col items-center gap-1 rounded-md border border-border bg-surface-raised p-1 text-xs text-fg-muted transition-colors hover:border-border-strong hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:border-accent data-[state=checked]:text-fg"
          >
            {preview ? (
              <span className="flex aspect-square w-full items-center justify-center overflow-hidden rounded-sm bg-canvas">
                {preview}
              </span>
            ) : null}

            <span>{optionLabel}</span>
          </RadixRadioGroup.Item>
        );
      })}
    </RadixRadioGroup.Root>
  );
};
