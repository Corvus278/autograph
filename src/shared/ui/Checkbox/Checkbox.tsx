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
        className="flex size-4 shrink-0 cursor-pointer items-center justify-center rounded-sm border border-zinc-600 bg-zinc-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-400 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:border-violet-500 data-[state=checked]:bg-violet-600"
      >
        <RadixCheckbox.Indicator className="text-xs leading-none text-white">
          ✓
        </RadixCheckbox.Indicator>
      </RadixCheckbox.Root>

      <Label htmlFor={controlId} className="cursor-pointer">
        {label}
      </Label>
    </div>
  );
};
