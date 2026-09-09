import type { ReactNode } from 'react';

export type TooltipProps = {
  /**
   * Элемент, у которого показывается подсказка.
   */
  children: ReactNode;

  /**
   * Текст подсказки.
   */
  content: string;
};
