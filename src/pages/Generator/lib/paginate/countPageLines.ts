import type { BlockGeometry, SheetCalibration } from '../calibrate/calibrate.types';
import { deriveTextHeight } from '../calibrate/deriveGeometry';
import type { FontMetrics } from '../measure/measure.types';
import { FALLBACK_FONT_METRICS } from '../measure/measureFontMetrics';

/**
 * Сколько строк помещается на листе страницы: строка ставится, если её
 * базовая линия лежит не ниже нижнего поля листа, поднятого на запас снизу.
 * Хвосты букв последней строки при этом могут зайти в поле — зато у низа листа
 * не остаётся пустой полосы высотой в строку.
 *
 * Базовые линии считаются по той же модели, по которой их ставит отрисовка:
 * первая — на подъём строчного бокса ниже верха блока, следующие — через шаг
 * строк `fontSizePx * lineHeight + lineSpacing`, с теми же запасными метриками,
 * когда они не измерены. Разойдись формулы — страница набиралась бы на одно
 * число строк, а рисовалась бы с другим шагом и уезжала за нижнее поле.
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
  const { fontSizePx, lineSpacing } = geometry;
  const lineHeight = metrics.lineHeight || FALLBACK_FONT_METRICS.lineHeight;
  const fontAscent = metrics.fontAscent || FALLBACK_FONT_METRICS.fontAscent;
  const lineStep = fontSizePx * lineHeight + lineSpacing;
  const baselineRoom =
    deriveTextHeight(sheet, geometry, bottomMargin) - fontAscent * fontSizePx;

  return Math.floor(baselineRoom / lineStep) + 1;
};
