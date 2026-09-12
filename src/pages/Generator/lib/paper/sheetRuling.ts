import type { PaperMargins, SheetRuling, SheetRulingSource } from './paper.types';

/**
 * На сколько шагов разлиновки блок отступает от края кадра с той стороны, где
 * поле не нашлось. Полтора шага на пресет-паке — около восьмидесяти пикселей:
 * столько же, сколько отступали поля по прежним канонам семей.
 */
export const MARGIN_FALLBACK_STEPS = 1.5;

/**
 * Допуск округления до линии в долях шага. Поле, стоящее ровно на линии,
 * после вычитания фазы и деления на шаг даёт не целое, а целое плюс
 * погрешность, и честный `ceil` перепрыгнул бы на следующую линию.
 */
const LINE_SNAP_EPSILON = 1e-6;

const NO_MARGINS: PaperMargins = { top: 0, right: 0, bottom: 0, left: 0 };

/**
 * Первая линия разлиновки, лежащая не выше заданной высоты.
 *
 * @param y — высота в пикселях кадра
 * @param step — шаг разлиновки, больше нуля
 * @param phase — высота любой линии разлиновки
 * @returns высота линии в пикселях кадра
 */
const snapDownToLine = (y: number, step: number, phase: number): number => {
  return phase + Math.ceil((y - phase) / step - LINE_SNAP_EPSILON) * step;
};

/**
 * Высота первой линии разлиновки у левого края кадра, лежащей не выше
 * верхнего поля. На ней стоит базовая линия первой строки: отсчёт от линии, а
 * не от поля, держит строки на разлиновке, даже когда поле не кратно шагу.
 *
 * @param ruling — разлиновка листа
 * @returns высота линии в пикселях кадра; без шага — само верхнее поле
 */
export const resolveFirstLine = (ruling: SheetRuling): number => {
  const { step, firstLinePhase, margins } = ruling;

  if (step <= 0) {
    return margins.top;
  }

  return snapDownToLine(margins.top, step, firstLinePhase);
};

/**
 * Собирает разлиновку экземпляра из результата детектора или из записи
 * прежней формы. Каждая ненайденная сторона — нулевое поле — получает отступ в
 * полтора шага от края кадра, верхнее поле при этом опускается до ближайшей
 * линии. Линия поля без стороны считается отсутствующей.
 *
 * Готовую разлиновку функция не меняет, поэтому её можно звать и на
 * перечитанном из хранилища листе.
 *
 * @param source — шаг, фаза, наклон и то, что нашлось из полей
 * @returns разлиновка экземпляра; без шага поля остаются как пришли
 */
export const buildSheetRuling = (source: SheetRulingSource): SheetRuling => {
  const { step, firstLinePhase, skewAngle } = source;
  const margins = source.margins || NO_MARGINS;
  const marginLineX = source.marginLineX || null;
  const marginLineSide = source.marginLineSide || null;
  const hasMarginLine = marginLineX !== null && marginLineSide !== null;
  const ruling: SheetRuling = {
    step,
    firstLinePhase,
    skewAngle,
    margins,
    marginLineX: hasMarginLine ? marginLineX : null,
    marginLineSide: hasMarginLine ? marginLineSide : null,
  };

  /**
   * Без шага фолбэк считать не от чего: такой лист идёт в ручной ввод
   * разлиновки, а не рисуется молча.
   */
  if (step <= 0) {
    return ruling;
  }

  const fallback = step * MARGIN_FALLBACK_STEPS;

  return {
    ...ruling,
    margins: {
      top: margins.top || snapDownToLine(fallback, step, firstLinePhase),
      right: margins.right || fallback,
      bottom: margins.bottom || fallback,
      left: margins.left || fallback,
    },
  };
};
