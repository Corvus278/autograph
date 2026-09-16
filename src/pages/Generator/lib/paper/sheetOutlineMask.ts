import type { SheetOutline, SheetPoint } from './paper.types';

/**
 * Сторона контура: пара соседних углов по обходу.
 */
type SheetOutlineEdge = [SheetPoint, SheetPoint];

/**
 * Точка лежит на бумаге, а не на поверхности вокруг листа.
 *
 * Контур выпуклый, поэтому проверка сводится к знаку косого произведения на
 * каждой стороне: точка внутри, если ни разу не оказалась по разные стороны от
 * обхода. Точка ровно на стороне считается внутренней — иначе клетка, легшая на
 * край листа, теряла бы часть выборок на ровном месте.
 *
 * @param outline — контур листа в пикселях кадра
 * @param x — столбец кадра
 * @param y — строка кадра
 * @returns `true`, если точка на бумаге
 */
export const isInsideSheetOutline = (
  outline: SheetOutline,
  x: number,
  y: number
): boolean => {
  const { topLeft, topRight, bottomRight, bottomLeft } = outline;
  const edges: SheetOutlineEdge[] = [
    [topLeft, topRight],
    [topRight, bottomRight],
    [bottomRight, bottomLeft],
    [bottomLeft, topLeft],
  ];

  let hasPositive = false;
  let hasNegative = false;

  edges.forEach(([from, to]) => {
    const cross = (to.x - from.x) * (y - from.y) - (to.y - from.y) * (x - from.x);

    hasPositive = hasPositive || cross > 0;
    hasNegative = hasNegative || cross < 0;
  });

  return !hasPositive || !hasNegative;
};
