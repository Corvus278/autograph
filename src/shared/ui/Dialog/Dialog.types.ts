import type { ReactNode } from 'react';

export type DialogProps = {
  /**
   * Диалог открыт.
   */
  isOpen: boolean;

  /**
   * Заголовок, он же доступное имя диалога.
   */
  title: string;

  /**
   * Пояснение под заголовком.
   */
  description?: string;

  /**
   * Кнопка, открывающая диалог. Без неё диалог открывают снаружи через
   * `isOpen`, и фокус после закрытия возвращается туда, где был до
   * открытия.
   */
  trigger?: ReactNode;

  /**
   * Содержимое диалога.
   */
  children: ReactNode;

  /**
   * Колбэк на открытие и закрытие: кнопка-триггер, Esc, клик мимо,
   * кнопка «Закрыть».
   */
  onOpenChange: (isOpen: boolean) => void;

  /**
   * Дополнительные классы окна.
   */
  className?: string;
};
