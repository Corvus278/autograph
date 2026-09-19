import type { ReactNode } from 'react';

export type GeneratorLayoutProps = {
  /**
   * Шапка экрана.
   */
  header: ReactNode;

  /**
   * Колонка текста слева.
   */
  text: ReactNode;

  /**
   * Область просмотра листа в центре: занимает всё место между колонками.
   */
  viewport: ReactNode;

  /**
   * Колонка настроек оформления справа.
   */
  settings: ReactNode;

  /**
   * Полоса главных действий внизу.
   */
  actions: ReactNode;
};
