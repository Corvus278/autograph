import type { ComponentPropsWithRef, ReactNode } from 'react';

/**
 * Атрибуты кнопки, которые компонент задаёт сам: подпись, доступность и
 * нажатие приходят своими пропсами.
 */
type OwnButtonAttributes =
  'aria-label' | 'children' | 'className' | 'disabled' | 'onClick' | 'type';

export type IconButtonProps = Omit<
  ComponentPropsWithRef<'button'>,
  OwnButtonAttributes
> & {
  /**
   * Доступное имя кнопки, оно же текст подсказки.
   */
  label: string;

  /**
   * Иконка.
   */
  children: ReactNode;

  /**
   * Колбэк на нажатие.
   */
  onClick: () => void;

  /**
   * Кнопка недоступна.
   */
  isDisabled?: boolean;

  /**
   * Дополнительные классы.
   */
  className?: string;
};
