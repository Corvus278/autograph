import * as RadixRadioGroup from '@radix-ui/react-radio-group';
import type { FC } from 'react';

import { Tooltip } from '../Tooltip';

import type { SwatchProps } from './Swatch.types';

/**
 * Образец цвета — пункт `SwatchGroup`, вне группы не работает. Цвет
 * заливки приходит из данных, поэтому ставится инлайном, а не классом.
 */
export const Swatch: FC<SwatchProps> = (props) => {
  const { value, label, color, children } = props;

  return (
    <Tooltip content={label}>
      <RadixRadioGroup.Item
        value={value}
        aria-label={label}
        style={{ backgroundColor: color }}
        className="flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-full border border-border-strong text-xs font-semibold text-accent-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:outline-2 data-[state=checked]:outline-offset-2 data-[state=checked]:outline-accent data-[state=checked]:focus-visible:outline-focus"
      >
        {children}
      </RadixRadioGroup.Item>
    </Tooltip>
  );
};
