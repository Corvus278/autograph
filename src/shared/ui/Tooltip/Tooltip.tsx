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
            className="z-50 max-w-64 rounded-md bg-zinc-800 px-2 py-1 text-xs text-zinc-100 shadow-lg"
          >
            {content}

            <RadixTooltip.Arrow className="fill-zinc-800" />
          </RadixTooltip.Content>
        </RadixTooltip.Portal>
      </RadixTooltip.Root>
    </RadixTooltip.Provider>
  );
};
