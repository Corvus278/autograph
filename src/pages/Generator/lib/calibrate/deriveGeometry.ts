import type { FontMetrics } from '../measure/measure.types';
import { FALLBACK_FONT_METRICS } from '../measure/measureFontMetrics';
import type { RulingKind } from '../paper/paper.types';

import type {
  BlockGeometry,
  CalibrationRuling,
  GeometryCorrection,
} from './calibrate.types';

/**
 * Кегль, относительно которого считается em на границе с DOM. Сама геометрия
 * живёт в пикселях: `em` появляется только там, где размер уезжает в стиль.
 *
 * Верно, пока ни один предок блока текста не меняет `font-size`: в стиле
 * страницы стоит `em`, а не `rem`, поэтому промежуточный размер сдвинул бы
 * весь расчёт.
 */
export const BASE_FONT_SIZE_PX = 16;

/**
 * Сколько шагов разлиновки занимает строка на листе в клетку. Пишут в клетку
 * через одну: тело строчной буквы занимает клетку, а верхние и нижние
 * выносные элементы соседних строк иначе налезают друг на друга.
 */
export const GRID_ROW_STEPS = 2;

/**
 * Доля шага разлиновки, которую занимает высота строчных. Принятая пропорция
 * школьного письма: тело буквы заметно ниже расстояния между линиями, зазор
 * остаётся под выносные элементы.
 */
const X_HEIGHT_SHARE = 0.55;

/**
 * Зазор между линией поля и началом текста в долях шага разлиновки: буква не
 * садится вплотную на линию поля.
 */
const MARGIN_LINE_GAP_SHARE = 0.2;

/**
 * Запасной шаг разлиновки в канонических пикселях — примерно школьная
 * линейка. Идёт в дело, когда шага нет: разлиновку на фотографии не нашли или
 * у чистого листа пользователь ещё не задал свой шаг. Без него кегль
 * обратился бы в ноль, а вместе с ним и вся геометрия.
 */
const FALLBACK_RULING_STEP = 40;

/**
 * Наименьший осмысленный кегль в пикселях. Ниже — уже не текст, а полоска
 * пикселей; поправка не должна уводить размер в ноль или в минус.
 */
const MIN_FONT_SIZE_PX = 1;

/**
 * Сколько шагов разлиновки приходится на одну строку текста.
 *
 * У чистого листа линий нет: шаг задаёт пользователь, и строка занимает
 * ровно его — удваивать нечего.
 *
 * @param kind — вид разлиновки семьи
 * @returns множитель шага
 */
const getRowSteps = (kind: RulingKind): number => {
  switch (kind) {
    case 'grid': {
      return GRID_ROW_STEPS;
    }

    case 'lined': {
      return 1;
    }

    case 'blank': {
      return 1;
    }

    default: {
      throw new Error(`Unknown ruling kind: ${kind}`);
    }
  }
};

/**
 * Выводит геометрию блока текста из разлиновки семьи и метрик шрифта.
 *
 * Модель строчного бокса — общая с отрисовкой:
 *
 * - шаг строк `lineStep = fontSizePx * lineHeight + lineSpacing`;
 * - базовая линия строки n — `topOffset + fontAscent * fontSizePx + n * lineStep`.
 *
 * Отсюда и расчёт: шаг строк берётся кратным шагу разлиновки, кегль
 * подбирается так, чтобы высота строчных заняла принятую долю шага, а верхний
 * отступ отсчитывается назад от первой линии на подъём строчного бокса.
 * Межстрочный интервал — внешний отступ строки, внутрь бокса он не идёт и в
 * верхнем отступе не участвует.
 *
 * Пользовательская поправка складывается с вычисленным, а не заменяет его:
 * после смены семьи или экземпляра листа она применяется к новому расчёту.
 *
 * @param ruling — каноническая разлиновка семьи с шириной листа
 * @param metrics — метрики шрифта в долях кегля
 * @param correction — дельты поверх вычисленного
 * @returns геометрия блока в канонических пикселях семьи
 */
export const deriveGeometry = (
  ruling: CalibrationRuling,
  metrics: FontMetrics,
  correction: GeometryCorrection = {}
): BlockGeometry => {
  const { kind, firstLineOffset, margins, marginLineX, pageWidth } = ruling;
  const { fontAscent, lineHeight } = metrics;
  const step = ruling.step > 0 ? ruling.step : FALLBACK_RULING_STEP;
  const xHeight = metrics.xHeight || FALLBACK_FONT_METRICS.xHeight;
  const rowStep = step * getRowSteps(kind);
  const fontSizePx = (step * X_HEIGHT_SHARE) / xHeight;
  const lineSpacing = rowStep - fontSizePx * lineHeight;
  const topOffset = firstLineOffset - fontAscent * fontSizePx;
  const leftPadding =
    marginLineX === null ? margins.left : marginLineX + step * MARGIN_LINE_GAP_SHARE;
  const blockWidth = pageWidth - leftPadding - margins.right;

  return {
    fontSizePx: Math.max(MIN_FONT_SIZE_PX, fontSizePx + (correction.fontSizePx || 0)),
    lineSpacing: lineSpacing + (correction.lineSpacing || 0),
    topOffset: topOffset + (correction.topOffset || 0),
    leftPadding: leftPadding + (correction.leftPadding || 0),
    blockWidth: Math.max(0, blockWidth + (correction.blockWidth || 0)),
  };
};
