import type { ReactNode } from 'react';

export type ButtonProps = {
  /**
   * Текст кнопки.
   */
  children: ReactNode;

  /**
   * Колбэк на нажатие.
   */
  onClick: () => void;

  /**
   * Оформление: `primary` — главное действие экрана, `secondary` — обычное,
   * `ghost` — без заливки.
   */
  variant?: 'primary' | 'secondary' | 'ghost';

  /**
   * Кнопка недоступна.
   */
  isDisabled?: boolean;

  /**
   * Дополнительные классы.
   */
  className?: string;
};
