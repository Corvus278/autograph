import type { ReactNode } from 'react';

export type TileRadioOption = {
  /**
   * Значение, которое уедет в колбэк при выборе.
   */
  value: string;

  /**
   * Подпись под плиткой, она же доступное имя пункта.
   */
  label: string;

  /**
   * Картинка плитки. Без неё плитка — одна подпись.
   */
  preview?: ReactNode;
};

export type TileRadioProps = {
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
   * Плитки по порядку.
   */
  options: TileRadioOption[];

  /**
   * Колбэк на выбор плитки.
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
