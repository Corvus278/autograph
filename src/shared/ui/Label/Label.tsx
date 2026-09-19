import * as RadixLabel from '@radix-ui/react-label';
import { cx } from '@shared/lib/styles';
import type { FC } from 'react';

import type { LabelProps } from './Label.types';

export const Label: FC<LabelProps> = (props) => {
  const { htmlFor, children, className } = props;

  return (
    <RadixLabel.Root
      htmlFor={htmlFor}
      className={cx('text-fg-muted text-sm font-medium select-none', className)}
    >
      {children}
    </RadixLabel.Root>
  );
};
