import * as RadixRadioGroup from '@radix-ui/react-radio-group';
import { cx } from '@shared/lib/styles';
import type { FC } from 'react';

import type { SwatchGroupProps } from './SwatchGroup.types';

/**
 * Образцы — дети, а не массив опций: у автоматического выбора свой знак
 * поверх заливки, и так его не приходится описывать флагом в данных.
 */
export const SwatchGroup: FC<SwatchGroupProps> = (props) => {
  const { label, value, children, onChange, isDisabled = false, className } = props;

  const handleGroupValueChange = (next: string) => {
    onChange(next);
  };

  return (
    <RadixRadioGroup.Root
      aria-label={label}
      orientation="horizontal"
      value={value}
      disabled={isDisabled}
      className={cx('flex flex-wrap items-center gap-2.5 p-0.5', className)}
      onValueChange={handleGroupValueChange}
    >
      {children}
    </RadixRadioGroup.Root>
  );
};
