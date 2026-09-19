import type { ReactNode } from 'react';

export type SwatchProps = {
  /**
   * Значение, которое группа отдаст в колбэк при выборе.
   */
  value: string;

  /**
   * Доступное имя образца, оно же текст подсказки.
   */
  label: string;

  /**
   * CSS-цвет заливки.
   */
  color: string;

  /**
   * Знак поверх заливки — например, у автоматического выбора цвета.
   */
  children?: ReactNode;
};
