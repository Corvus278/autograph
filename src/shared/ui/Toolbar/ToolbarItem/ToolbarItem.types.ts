import type { ReactElement } from 'react';

export type ToolbarItemProps = {
  /**
   * Кнопка пункта: элемент, который пробрасывает атрибуты и `ref` на свой
   * `<button>`, например `IconButton`.
   */
  children: ReactElement;
};
