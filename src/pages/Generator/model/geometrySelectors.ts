import type { BlockGeometry, CalibrationRuling } from '../lib/calibrate/calibrate.types';
import type { FontMetrics } from '../lib/measure/measure.types';

import { buildBlockGeometry } from './buildPageRenderParams';
import type { GeneratorState } from './generator.types';
import { selectActiveFamily, selectActiveSheet } from './paperSelectors';

/**
 * Разлиновка выбранной семьи вместе с шириной её канонического листа.
 *
 * @param state — состояние генератора
 * @returns разлиновка; `null` — семья не выбрана и считать не по чему
 */
export const selectCalibrationRuling = (
  state: GeneratorState
): CalibrationRuling | null => {
  const family = selectActiveFamily(state);

  if (!family) {
    return null;
  }

  return { ...family.ruling, pageWidth: family.width };
};

/**
 * Итоговая геометрия блока: вычисленная из разлиновки семьи и метрик шрифта,
 * со сложенной поверх ручной поправкой. Поправка задана дельтами, поэтому
 * смена экземпляра листа и смена семьи её не теряют — она применяется к
 * заново вычисленному.
 *
 * @param state — состояние генератора
 * @param metrics — метрики выбранного шрифта в долях кегля
 * @returns геометрия блока; `null` — семья не выбрана
 */
export const selectBlockGeometry = (
  state: GeneratorState,
  metrics: FontMetrics
): BlockGeometry | null => {
  const family = selectActiveFamily(state);

  if (!family) {
    return null;
  }

  return buildBlockGeometry({ family, metrics, correction: state.geometryCorrection });
};

/**
 * Угол, на который наклонён блок текста: наклон разлиновки выбранного
 * экземпляра. Фотография не выправляется, вдоль её наклона выкладывается
 * текст.
 *
 * @param state — состояние генератора
 * @returns угол в градусах; ноль — экземпляр не выбран или снят ровно
 */
export const selectBlockSkewAngle = (state: GeneratorState): number => {
  return selectActiveSheet(state)?.skewAngle || 0;
};
