import * as RadixAccordion from '@radix-ui/react-accordion';
import type { FC } from 'react';

import type { AccordionSectionProps } from './AccordionSection.types';

export const AccordionSection: FC<AccordionSectionProps> = (props) => {
  const { value, title, children } = props;

  return (
    <RadixAccordion.Item
      value={value}
      className="overflow-hidden rounded-md border border-border bg-surface-raised"
    >
      <RadixAccordion.Header>
        <RadixAccordion.Trigger className="flex w-full cursor-pointer items-center justify-between px-3 py-2 text-left text-sm font-medium text-fg hover:bg-border focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus">
          {title}

          <span aria-hidden="true" className="text-fg-subtle">
            ▾
          </span>
        </RadixAccordion.Trigger>
      </RadixAccordion.Header>

      <RadixAccordion.Content className="border-t border-border px-3 py-3">
        {children}
      </RadixAccordion.Content>
    </RadixAccordion.Item>
  );
};
