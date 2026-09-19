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
        className="border-border-strong bg-surface-raised focus-visible:outline-focus data-[state=checked]:border-accent data-[state=checked]:bg-accent flex size-4 shrink-0 cursor-pointer items-center justify-center rounded-sm border focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <RadixCheckbox.Indicator className="text-accent-fg text-xs leading-none">
          ✓
        </RadixCheckbox.Indicator>
      </RadixCheckbox.Root>

      <Label htmlFor={controlId} className="cursor-pointer">
        {label}
      </Label>
    </div>
  );
};
