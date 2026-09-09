import type { ReactNode } from 'react';

export type LabelProps = {
  /**
   * Идентификатор контрола, с которым связана подпись.
   */
  htmlFor: string;

  /**
   * Содержимое подписи.
   */
  children: ReactNode;

  /**
   * Дополнительные классы.
   */
  className?: string;
};
