import * as RadixRadioGroup from '@radix-ui/react-radio-group';
import { cx } from '@shared/lib/styles';
import type { FC } from 'react';
import { useId } from 'react';

import type { RadioGroupProps } from './RadioGroup.types';
import { RadioOption } from './RadioOption';

export const RadioGroup: FC<RadioGroupProps> = (props) => {
  const { label, value, options, onChange, isDisabled = false, className } = props;
  const labelId = useId();

  const handleGroupChange = (next: string) => {
    onChange(next);
  };

  return (
    <div className={cx('flex flex-col gap-2', className)}>
      <span id={labelId} className="text-sm text-zinc-300">
        {label}
      </span>

      <RadixRadioGroup.Root
        aria-labelledby={labelId}
        className="flex flex-col gap-2"
        value={value}
        disabled={isDisabled}
        onValueChange={handleGroupChange}
      >
        {options.map(({ value: optionValue, label: optionLabel }) => {
          return (
            <RadioOption key={optionValue} value={optionValue} label={optionLabel} />
          );
        })}
      </RadixRadioGroup.Root>
    </div>
  );
};
