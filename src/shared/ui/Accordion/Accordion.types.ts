import type { ReactNode } from 'react';

export type AccordionProps = {
  /**
   * Секции аккордеона — компоненты `AccordionSection`.
   */
  children: ReactNode;

  /**
   * Идентификаторы секций, развёрнутых при первом показе.
   */
  defaultOpenSections: string[];

  /**
   * Дополнительные классы.
   */
  className?: string;
};
