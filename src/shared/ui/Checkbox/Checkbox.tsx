import * as RadixCheckbox from '@radix-ui/react-checkbox';
import { cx } from '@shared/lib/styles';
import type { FC } from 'react';
import { useId } from 'react';

import { Label } from '../Label';

import type { CheckboxProps } from './Checkbox.types';

export const Checkbox: FC<CheckboxProps> = (props) => {
  const { label, isChecked, onChange, isDisabled = false, className } = props;
  const controlId = useId();

  const handleCheckboxChange = (checked: RadixCheckbox.CheckedState) => {
    onChange(checked === true);
  };

  return (
    <div className={cx('flex items-center gap-2', className)}>
      <RadixCheckbox.Root
        id={controlId}
        checked={isChecked}
        disabled={isDisabled}
        onCheckedChange={handleCheckboxChange}
        className="flex size-4 shrink-0 cursor-pointer items-center justify-center rounded-sm border border-border-strong bg-surface-raised focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:border-accent data-[state=checked]:bg-accent"
      >
        <RadixCheckbox.Indicator className="text-xs leading-none text-accent-fg">
          ✓
        </RadixCheckbox.Indicator>
      </RadixCheckbox.Root>

      <Label htmlFor={controlId} className="cursor-pointer">
        {label}
      </Label>
    </div>
  );
};
