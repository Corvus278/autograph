import type { BlockGeometry } from '@pages/Generator/lib/calibrate';
import type { FontMetrics } from '@pages/Generator/lib/measure/measure.types';

/**
 * Шаг строк так, как его получает отрисовка: естественная высота строчного
 * бокса плюс межстрочная добавка. Добавка — внешний отступ строки, внутрь
 * бокса она не идёт.
 *
 * @param geometry — вычисленная геометрия блока
 * @param metrics — метрики шрифта, которым набран текст
 * @returns расстояние между базовыми линиями соседних строк в пикселях
 */
export const getLineStep = (geometry: BlockGeometry, metrics: FontMetrics): number => {
  return geometry.fontSizePx * metrics.lineHeight + geometry.lineSpacing;
};

/**
 * Положение базовой линии строки так, как его получает отрисовка: верх блока,
 * подъём строчного бокса и целое число шагов строк.
 *
 * @param geometry — вычисленная геометрия блока
 * @param metrics — метрики шрифта, которым набран текст
 * @param lineIndex — номер строки от нуля
 * @returns отступ базовой линии от верха листа в пикселях
 */
export const getBaselineY = (
  geometry: BlockGeometry,
  metrics: FontMetrics,
  lineIndex: number
): number => {
  return (
    geometry.topOffset +
    metrics.fontAscent * geometry.fontSizePx +
    lineIndex * getLineStep(geometry, metrics)
  );
};
