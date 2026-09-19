import * as RadixToggleGroup from '@radix-ui/react-toggle-group';
import { cx } from '@shared/lib/styles';
import type { FC } from 'react';

import type { SegmentedControlProps } from './SegmentedControl.types';

export const SegmentedControl: FC<SegmentedControlProps> = (props) => {
  const { label, value, options, onChange, isDisabled = false, className } = props;

  /**
   * Одиночная группа Radix снимает выбор повторным нажатием и отдаёт
   * пустую строку. У сегментов выбор есть всегда, поэтому пустое значение
   * не пропускаем.
   */
  const handleGroupValueChange = (next: string) => {
    if (next) {
      onChange(next);
    }
  };

  return (
    <RadixToggleGroup.Root
      type="single"
      aria-label={label}
      value={value}
      disabled={isDisabled}
      className={cx(
        'flex rounded-md border border-border bg-surface-raised p-0.5',
        className
      )}
      onValueChange={handleGroupValueChange}
    >
      {options.map(({ value: optionValue, label: optionLabel }) => {
        return (
          <RadixToggleGroup.Item
            key={optionValue}
            value={optionValue}
            className="flex-1 cursor-pointer rounded-sm px-2 py-1 text-sm whitespace-nowrap text-fg-muted transition-colors hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:cursor-not-allowed disabled:opacity-50 data-[state=on]:bg-accent data-[state=on]:text-accent-fg"
          >
            {optionLabel}
          </RadixToggleGroup.Item>
        );
      })}
    </RadixToggleGroup.Root>
  );
};
