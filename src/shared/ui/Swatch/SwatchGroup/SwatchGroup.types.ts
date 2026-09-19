import type { ReactNode } from 'react';

export type SwatchGroupProps = {
  /**
   * Доступное имя группы. Видимую подпись рисует секция, в которой группа
   * стоит.
   */
  label: string;

  /**
   * Выбранное значение.
   */
  value: string;

  /**
   * Образцы — `Swatch`.
   */
  children: ReactNode;

  /**
   * Колбэк на выбор образца.
   */
  onChange: (value: string) => void;

  /**
   * Группа недоступна.
   */
  isDisabled?: boolean;

  /**
   * Дополнительные классы.
   */
  className?: string;
};
