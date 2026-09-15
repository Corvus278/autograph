import type { PaperMargins, SheetOutline } from './paper.types';

/**
 * Прямоугольник, вписанный в контур листа, отступами от краёв кадра — в той же
 * форме, что поля листа. В нём идут все измерения фотографии.
 *
 * У выпуклого контура с почти осевыми сторонами прямоугольник лежит внутри:
 * сторона между двумя углами не выходит за крайнюю из их координат, поэтому
 * каждая сторона прямоугольника берётся по внутреннему из двух углов. Отступа
 * внутрь сверх этого нет: первая линия у края прямоугольника легла бы в начало
 * профиля, и верхнее поле ушло бы в фолбэк.
 *
 * @param outline — контур листа; `null` — лист во весь кадр
 * @param width — ширина кадра, px
 * @param height — высота кадра, px
 * @returns отступы сторон прямоугольника от краёв кадра; без контура — нули
 */
export const resolveSheetBounds = (
  outline: SheetOutline | null,
  width: number,
  height: number
): PaperMargins => {
  if (!outline) {
    return { top: 0, right: 0, bottom: 0, left: 0 };
  }

  const { topLeft, topRight, bottomRight, bottomLeft } = outline;

  return {
    top: Math.max(topLeft.y, topRight.y),
    right: width - Math.min(topRight.x, bottomRight.x),
    bottom: height - Math.min(bottomLeft.y, bottomRight.y),
    left: Math.max(topLeft.x, bottomLeft.x),
  };
};
