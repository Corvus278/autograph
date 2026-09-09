import * as RadixRadioGroup from '@radix-ui/react-radio-group';
import type { FC } from 'react';
import { useId } from 'react';

import { Label } from '../../Label';

import type { RadioOptionProps } from './RadioOption.types';

export const RadioOption: FC<RadioOptionProps> = (props) => {
  const { value, label } = props;
  const controlId = useId();

  return (
    <div className="flex items-center gap-2">
      <RadixRadioGroup.Item
        id={controlId}
        value={value}
        className="flex size-4 shrink-0 cursor-pointer items-center justify-center rounded-full border border-zinc-600 bg-zinc-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-400 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:border-violet-500"
      >
        <RadixRadioGroup.Indicator className="size-2 rounded-full bg-violet-500" />
      </RadixRadioGroup.Item>

      <Label htmlFor={controlId} className="cursor-pointer">
        {label}
      </Label>
    </div>
  );
};
