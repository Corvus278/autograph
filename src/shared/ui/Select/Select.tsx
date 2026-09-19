import * as RadixSelect from '@radix-ui/react-select';
import { cx } from '@shared/lib/styles';
import type { FC } from 'react';
import { useId } from 'react';

import { Label } from '../Label';

import type { SelectProps } from './Select.types';

/**
 * Выпадающий список. Раскрывается под полем (`popper`), а не поверх него:
 * выровненный по пункту список ставится один раз и при прокрутке страницы
 * отрывается от поля. Ширина — ширина поля, высота — не больше места до края
 * окна, лишнее прокручивается внутри списка.
 */
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
          className="flex cursor-pointer items-center justify-between gap-2 rounded-md border border-border-strong bg-surface-raised px-3 py-2 text-sm text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:cursor-not-allowed disabled:opacity-50"
        >
          <RadixSelect.Value />

          <RadixSelect.Icon className="text-fg-muted">▾</RadixSelect.Icon>
        </RadixSelect.Trigger>

        <RadixSelect.Portal>
          <RadixSelect.Content
            position="popper"
            sideOffset={4}
            className="z-50 max-h-(--radix-select-content-available-height) w-(--radix-select-trigger-width) overflow-hidden rounded-md border border-border-strong bg-surface-raised text-fg shadow-popover"
          >
            <RadixSelect.Viewport className="max-h-72 p-1">
              {options.map(({ value: optionValue, label: optionLabel }) => {
                return (
                  <RadixSelect.Item
                    key={optionValue}
                    value={optionValue}
                    className="cursor-pointer rounded-sm px-3 py-1.5 text-sm text-fg-muted outline-hidden data-highlighted:bg-border data-[state=checked]:font-medium data-[state=checked]:text-fg"
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
