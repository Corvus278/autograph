import type { ReactNode } from 'react';

export type SpreadPageProps = {
  /**
   * Номер страницы, считая с нуля.
   */
  pageIndex: number;

  /**
   * Текущая ли это страница — та, что сохраняется отдельным действием.
   */
  isCurrent: boolean;

  /**
   * Лист страницы.
   */
  children: ReactNode;
};
