import type { MarginLineSide, RulingBend, SheetRuling } from './paper.types';

const DEGREES_IN_RADIAN = 180 / Math.PI;

/**
 * Остаток от деления, не уходящий в минус: фаза отражённой разлиновки должна
 * оставаться высотой линии у верха кадра, а не над ним.
 *
 * @param value — делимое
 * @param divisor — делитель, больше нуля
 * @returns остаток в `[0, divisor)`
 */
const toPositiveModulo = (value: number, divisor: number): number => {
  return ((value % divisor) + divisor) % divisor;
};

/**
 * Край линии поля после отражения.
 *
 * @param side — край до отражения
 * @returns противоположный край; `null` — линии поля нет
 */
const flipMarginLineSide = (side: MarginLineSide | null): MarginLineSide | null => {
  switch (side) {
    case 'left': {
      return 'right';
    }

    case 'right': {
      return 'left';
    }

    default: {
      return null;
    }
  }
};

/**
 * Сетка изгиба отражённой фотографии. Строки узлов сдвигаются на тот же наклон
 * во всю ширину кадра, что и фаза: координата вдоль линий отсчитывается у
 * левого края, а он после отражения — бывший правый. Первым узлом становится
 * отражённый последний, поэтому у несимметричной области с линиями сетка
 * ложится в другое место кадра.
 *
 * @param bend — сетка изгиба листа; `null` — линии прямые
 * @param shift — наклон разлиновки во всю ширину кадра в пикселях
 * @param width — ширина кадра фотографии в пикселях
 * @returns сетка отражённой фотографии; `null` — линии прямые
 */
const mirrorRulingBend = (
  bend: RulingBend | null,
  shift: number,
  width: number
): RulingBend | null => {
  if (!bend) {
    return null;
  }

  const { columnOrigin, columnSpacing, columnCount, rowOrigin, offsets } = bend;

  return {
    ...bend,
    columnOrigin: width - (columnOrigin + (columnCount - 1) * columnSpacing),
    rowOrigin: rowOrigin + shift,
    offsets: offsets.map((_, index) => {
      const column = index % columnCount;

      return offsets[index - column + columnCount - 1 - column] || 0;
    }),
  };
};

/**
 * Разлиновка того же листа, отражённого по горизонтали, — правой половины
 * разворота.
 *
 * Отражение меняет и вертикальные величины: наклонная линия, шедшая у правого
 * края кадра, после отражения оказывается у левого, где отсчитываются фаза и
 * поля, — ниже на наклон во всю ширину кадра. Двойное отражение эту поправку
 * сокращает, поэтому проверять её нужно попаданием строки на линию отражённой
 * фотографии.
 *
 * @param ruling — разлиновка листа
 * @param width — ширина кадра фотографии в пикселях
 * @returns разлиновка отражённой фотографии в тех же пикселях
 */
export const mirrorSheetRuling = (ruling: SheetRuling, width: number): SheetRuling => {
  const { step, firstLinePhase, skewAngle, margins, marginLineX, marginLineSide } =
    ruling;
  const shift = Math.tan(skewAngle / DEGREES_IN_RADIAN) * width;
  const phase = firstLinePhase + shift;

  return {
    step,
    firstLinePhase: step > 0 ? toPositiveModulo(phase, step) : phase,
    /**
     * `|| 0` убирает отрицательный ноль у ровного листа: он неотличим в
     * расчётах, но сравнение через `Object.is` видит в нём другое значение.
     */
    skewAngle: -skewAngle || 0,
    margins: {
      top: margins.top + shift,
      right: margins.left,
      bottom: margins.bottom - shift,
      left: margins.right,
    },
    marginLineX: marginLineX === null ? null : width - marginLineX,
    marginLineSide: flipMarginLineSide(marginLineSide),
    bend: mirrorRulingBend(ruling.bend, shift, width),
  };
};
