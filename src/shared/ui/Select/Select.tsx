import * as RadixSelect from '@radix-ui/react-select';
import { cx } from '@shared/lib/styles';
import type { FC } from 'react';
import { useId } from 'react';

import { Label } from '../Label';

import type { SelectProps } from './Select.types';

export const Select: FC<SelectProps> = (props) => {
  const { label, value, options, onChange, isDisabled = false, className } = props;
  const controlId = useId();

  const handleSelectChange = (next: string) => {
    onChange(next);
  };

  return (
    <div className={cx('flex flex-col gap-1.5', className)}>
      <Label htmlFor={controlId}>{label}</Label>

      <RadixSelect.Root
        value={value}
        disabled={isDisabled}
        onValueChange={handleSelectChange}
      >
        <RadixSelect.Trigger
          id={controlId}
          className="flex cursor-pointer items-center justify-between gap-2 rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-400 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <RadixSelect.Value />

          <RadixSelect.Icon className="text-zinc-400">▾</RadixSelect.Icon>
        </RadixSelect.Trigger>

        <RadixSelect.Portal>
          <RadixSelect.Content className="z-50 overflow-hidden rounded-md border border-zinc-700 bg-zinc-900 text-zinc-100 shadow-lg">
            <RadixSelect.Viewport className="max-h-72 p-1">
              {options.map(({ value: optionValue, label: optionLabel }) => {
                return (
                  <RadixSelect.Item
                    key={optionValue}
                    value={optionValue}
                    className="cursor-pointer rounded-sm px-3 py-1.5 text-sm outline-hidden data-highlighted:bg-zinc-800 data-[state=checked]:text-violet-300"
                  >
                    <RadixSelect.ItemText>{optionLabel}</RadixSelect.ItemText>
                  </RadixSelect.Item>
                );
              })}
            </RadixSelect.Viewport>
          </RadixSelect.Content>
        </RadixSelect.Portal>
      </RadixSelect.Root>
    </div>
  );
};
