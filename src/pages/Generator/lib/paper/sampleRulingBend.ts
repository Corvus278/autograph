import type { RulingBend } from './paper.types';

const DEGREES_IN_RADIAN = 180 / Math.PI;

/**
 * Выборка одной строки узлов в координате вдоль строки, где узлы стоят на
 * целых числах.
 */
type RowSampler = (bend: RulingBend, row: number, column: number) => number;

/**
 * Ограничивает число отрезком.
 *
 * @param value — число
 * @param max — верхняя граница, нижняя — ноль
 * @returns число в `[0, max]`
 */
const clampToRange = (value: number, max: number): number => {
  return Math.min(Math.max(value, 0), max);
};

/**
 * Узел строки с фантомными узлами за краями: за краем берётся узел, зеркальный
 * крайнему соседу (`P₋₁ = P₁`, `P_N = P_{N−2}`). Касательная в крайнем узле
 * от этого нулевая, и кривая стыкуется с константой за ним без излома.
 *
 * @param bend — сетка изгиба, в строке не меньше двух узлов
 * @param row — номер строки узлов
 * @param column — номер узла, от `−1` до `columnCount`
 * @returns смещение в узле в пикселях кадра
 */
const readNode = (bend: RulingBend, row: number, column: number): number => {
  const { columnCount, offsets } = bend;
  const last = columnCount - 1;
  const mirrored = last - Math.abs(last - Math.abs(column));

  return offsets[row * columnCount + mirrored] || 0;
};

/**
 * Равномерный Катмулл — Ром по узлам строки: гладкая производная нужна повороту
 * букв и не даёт строке изломов на узлах. За крайними узлами — их значение.
 *
 * @param bend — сетка изгиба
 * @param row — номер строки узлов
 * @param column — координата вдоль строки, узлы на целых числах
 * @returns смещение в пикселях кадра
 */
const sampleRowValue: RowSampler = (bend, row, column) => {
  const last = bend.columnCount - 1;

  if (last < 1) {
    return readNode(bend, row, 0);
  }

  const position = clampToRange(column, last);
  const index = Math.min(Math.floor(position), last - 1);
  const t = position - index;
  const p0 = readNode(bend, row, index - 1);
  const p1 = readNode(bend, row, index);
  const p2 = readNode(bend, row, index + 1);
  const p3 = readNode(bend, row, index + 2);

  return (
    0.5 *
    (2 * p1 +
      (p2 - p0) * t +
      (2 * p0 - 5 * p1 + 4 * p2 - p3) * t ** 2 +
      (-p0 + 3 * p1 - 3 * p2 + p3) * t ** 3)
  );
};

/**
 * Производная строки узлов по горизонтали кадра. За крайними узлами строка
 * постоянна, и производная там нулевая.
 *
 * @param bend — сетка изгиба
 * @param row — номер строки узлов
 * @param column — координата вдоль строки, узлы на целых числах
 * @returns производная смещения по горизонтали в пикселях на пиксель
 */
const sampleRowSlope: RowSampler = (bend, row, column) => {
  const last = bend.columnCount - 1;

  if (last < 1 || column <= 0 || column >= last) {
    return 0;
  }

  const index = Math.min(Math.floor(column), last - 1);
  const t = column - index;
  const p0 = readNode(bend, row, index - 1);
  const p1 = readNode(bend, row, index);
  const p2 = readNode(bend, row, index + 1);
  const p3 = readNode(bend, row, index + 2);
  const derivative =
    0.5 *
    (p2 -
      p0 +
      2 * (2 * p0 - 5 * p1 + 4 * p2 - p3) * t +
      3 * (-p0 + 3 * p1 - 3 * p2 + p3) * t ** 2);

  return derivative / bend.columnSpacing;
};

/**
 * Смешивает две соседние строки узлов линейно по координате вдоль линий.
 * Базовые линии садятся ровно на линии, а между ними смещение нужно только
 * телу букв, которому излом производной на линии не заметен. Над первой и
 * под последней строкой берётся крайняя строка.
 *
 * @param bend — сетка изгиба
 * @param skewAngle — наклон разлиновки в градусах
 * @param x — горизонталь в пикселях кадра
 * @param y — вертикаль в пикселях кадра
 * @param sampleRow — выборка одной строки
 * @returns смешанное значение строк
 */
const blendRows = (
  bend: RulingBend,
  skewAngle: number,
  x: number,
  y: number,
  sampleRow: RowSampler
): number => {
  const { columnOrigin, columnSpacing, rowOrigin, rowSpacing, rowCount } = bend;
  const column = (x - columnOrigin) / columnSpacing;
  const last = rowCount - 1;

  if (last < 1) {
    return sampleRow(bend, 0, column);
  }

  const u = y - x * Math.tan(skewAngle / DEGREES_IN_RADIAN);
  const position = clampToRange((u - rowOrigin) / rowSpacing, last);
  const row = Math.min(Math.floor(position), last - 1);
  const weight = position - row;

  return (
    (1 - weight) * sampleRow(bend, row, column) +
    weight * sampleRow(bend, row + 1, column)
  );
};

/**
 * Вертикальное смещение линий разлиновки от прямой наклонной гребёнки в точке
 * кадра. Линия `k` проходит на высоте
 * `firstLinePhase + k·step + x·tgθ + sampleRulingBend(bend, θ, x, firstLinePhase + k·step + x·tgθ)`.
 *
 * @param bend — сетка изгиба листа
 * @param skewAngle — наклон разлиновки в градусах
 * @param x — горизонталь в пикселях кадра
 * @param y — вертикаль в пикселях кадра
 * @returns смещение в пикселях кадра, положительное — вниз
 */
export const sampleRulingBend = (
  bend: RulingBend,
  skewAngle: number,
  x: number,
  y: number
): number => {
  return blendRows(bend, skewAngle, x, y, sampleRowValue);
};

/**
 * Производная смещения по горизонтали вдоль линии разлиновки, а не при
 * постоянной высоте: поворот буквы должен добавить к наклону разлиновки ровно
 * кривизну линии, а производная при постоянной высоте отличалась бы на наклон,
 * умноженный на изменение смещения поперёк линий.
 *
 * @param bend — сетка изгиба листа
 * @param skewAngle — наклон разлиновки в градусах
 * @param x — горизонталь в пикселях кадра
 * @param y — вертикаль в пикселях кадра
 * @returns производная в пикселях на пиксель; за крайними узлами — ноль
 */
export const sampleRulingBendSlope = (
  bend: RulingBend,
  skewAngle: number,
  x: number,
  y: number
): number => {
  return blendRows(bend, skewAngle, x, y, sampleRowSlope);
};
