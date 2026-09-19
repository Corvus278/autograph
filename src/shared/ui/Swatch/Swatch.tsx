import * as RadixRadioGroup from '@radix-ui/react-radio-group';
import type { FC } from 'react';

import { Tooltip } from '../Tooltip';

import type { SwatchProps } from './Swatch.types';

/**
 * Образец цвета — пункт `SwatchGroup`, вне группы не работает. Цвет
 * заливки приходит из данных, поэтому ставится инлайном, а не классом.
 *
 * Выбранный образец отмечен дважды: светлым кольцом и галочкой на заливке.
 * Одно кольцо цвета акцента на тёмном фоне рядом с тёмными соседями читается
 * слабо, а галочка не зависит от того, различает ли глаз оттенки. Кольцо —
 * цвета текста: на тёмной поверхности и рядом с тёмными заливками оно
 * контрастнее 3:1, у фокуса своё кольцо цвета фокуса.
 */
export const Swatch: FC<SwatchProps> = (props) => {
  const { value, label, color } = props;

  return (
    <Tooltip content={label}>
      <RadixRadioGroup.Item
        value={value}
        aria-label={label}
        style={{ backgroundColor: color }}
        className="flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-full border border-border-strong text-xs font-semibold text-accent-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:outline-2 data-[state=checked]:outline-offset-2 data-[state=checked]:outline-fg data-[state=checked]:focus-visible:outline-focus"
      >
        <RadixRadioGroup.Indicator aria-hidden className="text-sm leading-none">
          ✓
        </RadixRadioGroup.Indicator>
      </RadixRadioGroup.Item>
    </Tooltip>
  );
};
