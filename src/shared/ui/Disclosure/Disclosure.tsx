import * as RadixCollapsible from '@radix-ui/react-collapsible';
import { cx } from '@shared/lib/styles';
import type { FC } from 'react';

import type { DisclosureProps } from './Disclosure.types';

export const Disclosure: FC<DisclosureProps> = (props) => {
  const { title, children, isDefaultOpen = false, className } = props;

  return (
    <RadixCollapsible.Root
      defaultOpen={isDefaultOpen}
      className={cx('flex flex-col', className)}
    >
      <RadixCollapsible.Trigger className="group flex cursor-pointer items-center gap-1.5 rounded-sm py-1 text-left text-sm font-medium text-fg-muted transition-colors hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus">
        <svg
          aria-hidden
          viewBox="0 0 16 16"
          className="size-3 shrink-0 transition-transform group-data-[state=open]:rotate-90"
        >
          <path
            d="M6 3.5 10.5 8 6 12.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          />
        </svg>

        {title}
      </RadixCollapsible.Trigger>

      <RadixCollapsible.Content className="pt-2">{children}</RadixCollapsible.Content>
    </RadixCollapsible.Root>
  );
};
