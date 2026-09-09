import * as RadixAccordion from '@radix-ui/react-accordion';
import { cx } from '@shared/lib/styles';
import type { FC } from 'react';

import type { AccordionProps } from './Accordion.types';

/**
 * Аккордеон с независимыми секциями: свернуть одну группу настроек, не
 * закрывая остальные.
 */
export const Accordion: FC<AccordionProps> = (props) => {
  const { children, defaultOpenSections, className } = props;

  return (
    <RadixAccordion.Root
      type="multiple"
      defaultValue={defaultOpenSections}
      className={cx('flex flex-col gap-2', className)}
    >
      {children}
    </RadixAccordion.Root>
  );
};
