import type { RulingProjection, SheetImageData } from './paper.types';
import { lineCoordinateAt } from './rulingPerspective';

const DEGREES_IN_RADIAN = 180 / Math.PI;

/**
 * Выпрямленная копия вырезки вместе с тем, где она начинается.
 */
export type RectifiedSheetImage = {
  /**
   * Копия: строка `r` в столбце `x` — точка вырезки на линии с координатой
   * вдоль линий `top + r − x·tgθ`.
   */
  image: SheetImageData;

  /**
   * Координата `v` верхней строки копии в координате вдоль линий вырезки.
   */
  top: number;
};

/**
 * Выпрямляет вырезку по перспективе: `R(x, r) = L(x, Y(x, top + r − x·tgθ))`.
 * Линии в копии — ровная наклонная гребёнка с тем же наклоном и шагом, поэтому
 * их меряет прежний детектор разлиновки.
 *
 * Ось `x` у копии та же, что у вырезки, выборка идёт только по высоте. Высота
 * копии — диапазон `v`, при котором высота выборки лежит внутри вырезки во всех
 * столбцах: края не заполняются выдуманной бумагой.
 *
 * Разность красного и зелёного каналов выбирается в тех же точках и с теми же
 * долями, что и яркость, и округляется до уровня: иначе на проходе по копии
 * краснота кандидата бралась бы не из того столбца. Нет её в вырезке — нет и в
 * копии.
 *
 * @param image — полутоновая выжимка вырезки
 * @param projection — наклон и перспектива в пикселях вырезки
 * @returns копия; без перспективы или без диапазона — копия нулевой высоты
 */
export const rectifySheetImage = (
  image: SheetImageData,
  projection: RulingProjection
): RectifiedSheetImage => {
  const { width, height, luminance, redMinusGreen } = image;
  const { perspective } = projection;
  const tangent = Math.tan(projection.skewAngle / DEGREES_IN_RADIAN);

  if (!perspective || width < 1 || height < 2) {
    return {
      image: redMinusGreen
        ? {
            width,
            height: 0,
            luminance: new Float32Array(0),
            redMinusGreen: new Int16Array(0),
          }
        : { width, height: 0, luminance: new Float32Array(0) },
      top: 0,
    };
  }

  let top = Number.NEGATIVE_INFINITY;
  let bottom = Number.POSITIVE_INFINITY;

  for (let x = 0; x < width; x += 1) {
    top = Math.max(top, lineCoordinateAt(projection, x, 0) + x * tangent);
    bottom = Math.min(bottom, lineCoordinateAt(projection, x, height - 1) + x * tangent);
  }

  top = Math.ceil(top);

  const rows = Math.max(0, Math.floor(bottom - top) + 1);
  const values = new Float32Array(width * rows);
  const colour = redMinusGreen ? new Int16Array(width * rows) : null;
  const { originX, originY, convergenceX, convergenceY } = perspective;
  /**
   * `Y(x, U)` записана здесь развёрнуто, а не вызовом `lineHeightAt`: на кадре
   * телефона это десяток миллионов выборок, и тангенс с разбором аргументов на
   * каждой из них стоил бы заметной доли импорта.
   */
  const base = originX * tangent - originY;

  for (let x = 0; x < width; x += 1) {
    const offsetX = x - originX;
    const widthScale = 1 + convergenceX * offsetX;
    const shear = offsetX * tangent;
    const start = top - x * tangent + base;

    for (let row = 0; row < rows; row += 1) {
      const offset = start + row;
      const y = originY + (offset * widthScale + shear) / (1 - offset * convergenceY);
      const clamped = Math.min(height - 1, Math.max(0, y));
      const upper = Math.min(height - 2, Math.floor(clamped));
      const share = clamped - upper;
      const above = luminance[upper * width + x] || 0;
      const below = luminance[(upper + 1) * width + x] || 0;

      values[row * width + x] = above + (below - above) * share;

      if (redMinusGreen && colour) {
        const colourAbove = redMinusGreen[upper * width + x] || 0;
        const colourBelow = redMinusGreen[(upper + 1) * width + x] || 0;

        colour[row * width + x] = Math.round(
          colourAbove + (colourBelow - colourAbove) * share
        );
      }
    }
  }

  return {
    image: colour
      ? { width, height: rows, luminance: values, redMinusGreen: colour }
      : { width, height: rows, luminance: values },
    top,
  };
};
