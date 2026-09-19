import type { RefObject } from 'react';

export type WheelZoomInput = {
  /**
   * Прокручиваемая область просмотра: на ней слушается колесо.
   */
  viewportRef: RefObject<HTMLElement | null>;

  /**
   * Узел листа: по нему считается точка под курсором.
   */
  sheetRef: RefObject<HTMLElement | null>;

  /**
   * Текущий масштаб числом, вписывание уже разрешено.
   */
  zoom: number;
};

/**
 * Точка листа под курсором, которую зум должен оставить под курсором.
 */
export type WheelAnchor = {
  /**
   * Горизонталь курсора в координатах окна.
   */
  clientX: number;

  /**
   * Вертикаль курсора в координатах окна.
   */
  clientY: number;

  /**
   * Горизонталь точки на листе в пикселях кадра.
   */
  sheetX: number;

  /**
   * Вертикаль точки на листе в пикселях кадра.
   */
  sheetY: number;
};
