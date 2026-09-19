import type { ReactNode } from 'react';

export type DisclosureProps = {
  /**
   * Текст кнопки-раскрывашки.
   */
  title: string;

  /**
   * Содержимое, видимое в раскрытом состоянии.
   */
  children: ReactNode;

  /**
   * Раскрыт при первом показе.
   */
  isDefaultOpen?: boolean;

  /**
   * Дополнительные классы.
   */
  className?: string;
};
