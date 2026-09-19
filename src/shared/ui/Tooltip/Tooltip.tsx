import * as RadixTooltip from '@radix-ui/react-tooltip';
import type { FC } from 'react';

import type { TooltipProps } from './Tooltip.types';

/**
 * Подсказка с собственным провайдером: контролов с подсказками на экране
 * единицы, общий провайдер ради них городить незачем.
 */
export const Tooltip: FC<TooltipProps> = (props) => {
  const { children, content } = props;

  return (
    <RadixTooltip.Provider delayDuration={200}>
      <RadixTooltip.Root>
        <RadixTooltip.Trigger asChild>{children}</RadixTooltip.Trigger>

        <RadixTooltip.Portal>
          <RadixTooltip.Content
            sideOffset={6}
            className="z-50 max-w-64 rounded-md bg-surface-raised px-2 py-1 text-xs text-fg shadow-popover"
          >
            {content}

            <RadixTooltip.Arrow className="fill-surface-raised" />
          </RadixTooltip.Content>
        </RadixTooltip.Portal>
      </RadixTooltip.Root>
    </RadixTooltip.Provider>
  );
};
