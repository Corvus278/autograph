import type { BlockGeometry, SheetCalibration } from '../calibrate/calibrate.types';
import { deriveTextHeight } from '../calibrate/deriveGeometry';
import type { FontMetrics } from '../measure/measure.types';
import { FALLBACK_FONT_METRICS } from '../measure/measureFontMetrics';

/**
 * Сколько строк помещается на листе страницы: высота под текст — кадр без
 * верхнего отступа блока, нижнего поля и запаса снизу — делится на шаг строк.
 *
 * Шаг строк — тот же, по которому отрисовка ставит базовые линии:
 * `fontSizePx * lineHeight + lineSpacing`, с тем же запасным `lineHeight`,
 * когда метрика не измерена. Разойдись формулы — страница набиралась бы на
 * одно число строк, а рисовалась бы с другим шагом и уезжала за нижнее поле.
 *
 * @param sheet — лист страницы
 * @param geometry — геометрия блока на этом листе
 * @param metrics — метрики шрифта в долях кегля
 * @param bottomMargin — запас снизу в долях шага разлиновки
 * @returns число строк; ноль и меньше — не помещается ни одной
 */
export const countPageLines = (
  sheet: SheetCalibration,
  geometry: BlockGeometry,
  metrics: FontMetrics,
  bottomMargin: number
): number => {
  const lineHeight = metrics.lineHeight || FALLBACK_FONT_METRICS.lineHeight;
  const lineStep = geometry.fontSizePx * lineHeight + geometry.lineSpacing;

  return Math.floor(deriveTextHeight(sheet, geometry, bottomMargin) / lineStep);
};
