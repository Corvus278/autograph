import type { ReactNode } from 'react';

export type AccordionSectionProps = {
  /**
   * Идентификатор секции: по нему секция разворачивается по умолчанию.
   */
  value: string;

  /**
   * Заголовок секции.
   */
  title: string;

  /**
   * Содержимое секции.
   */
  children: ReactNode;
};
