import type { GlyphPoint } from '@pages/Generator/lib/glyph';

/**
 * Отступ вокруг чернил, чтобы рисунок не упирался в край растра.
 */
export const PADDING = 6;

/**
 * На сколько отрезков дробится кривая. Восьми хватает: при кегле в сотню
 * пикселей звено короче пикселя.
 */
export const CURVE_STEPS = 8;

/**
 * Замкнутая ломаная в пикселях.
 */
export type Polyline = GlyphPoint[];

/**
 * Ребро ломаной, подготовленное к развёртке по строкам.
 */
export type Edge = {
  /**
   * Начало ребра.
   */
  from: GlyphPoint;

  /**
   * Конец ребра.
   */
  to: GlyphPoint;
};

/**
 * Окно растеризации в пикселях.
 */
export type InkBox = {
  /**
   * Левая граница окна.
   */
  minX: number;

  /**
   * Верхняя граница окна.
   */
  minY: number;

  /**
   * Ширина окна в пикселях.
   */
  width: number;

  /**
   * Высота окна в пикселях.
   */
  height: number;
};

/**
 * Пересечение ребра со строкой развёртки.
 */
type Crossing = {
  /**
   * Горизонтальная координата пересечения.
   */
  x: number;

  /**
   * Направление обхода: вверх или вниз.
   */
  winding: number;
};

/**
 * Точка на квадратичной кривой.
 */
export const quadPoint = (
  from: GlyphPoint,
  control: GlyphPoint,
  to: GlyphPoint,
  t: number
): GlyphPoint => {
  const rest = 1 - t;

  return {
    x: rest * rest * from.x + 2 * rest * t * control.x + t * t * to.x,
    y: rest * rest * from.y + 2 * rest * t * control.y + t * t * to.y,
  };
};

/**
 * Точка на кубической кривой.
 */
export const cubicPoint = (
  from: GlyphPoint,
  first: GlyphPoint,
  second: GlyphPoint,
  to: GlyphPoint,
  t: number
): GlyphPoint => {
  const rest = 1 - t;

  return {
    x:
      rest * rest * rest * from.x +
      3 * rest * rest * t * first.x +
      3 * rest * t * t * second.x +
      t * t * t * to.x,
    y:
      rest * rest * rest * from.y +
      3 * rest * rest * t * first.y +
      3 * rest * t * t * second.y +
      t * t * t * to.y,
  };
};

/**
 * Рёбра всех ломаных, замкнутых на первую точку.
 */
export const toEdges = (polylines: readonly Polyline[]): Edge[] => {
  return polylines.reduce<Edge[]>((acc, polyline) => {
    for (const [index, point] of polyline.entries()) {
      const next = polyline[(index + 1) % polyline.length] || point;

      if (point.y !== next.y) {
        acc.push({ from: point, to: next });
      }
    }

    return acc;
  }, []);
};

/**
 * Окно, покрывающее рёбра с запасом на отступ.
 */
export const edgeBounds = (edges: readonly Edge[]): InkBox => {
  const xs = edges.flatMap((edge) => {
    return [edge.from.x, edge.to.x];
  });
  const ys = edges.flatMap((edge) => {
    return [edge.from.y, edge.to.y];
  });
  const minX = Math.min(...xs) - PADDING;
  const minY = Math.min(...ys) - PADDING;

  return {
    minX,
    minY,
    width: Math.ceil(Math.max(...xs) + PADDING - minX),
    height: Math.ceil(Math.max(...ys) + PADDING - minY),
  };
};

/**
 * Заливает рёбра по правилу ненулевого числа оборотов в маску заданного окна.
 */
export const fillMask = (edges: readonly Edge[], box: InkBox): Uint8Array => {
  const { minX, minY, width, height } = box;
  const ink = new Uint8Array(width * height);

  for (let row = 0; row < height; row += 1) {
    const scanY = minY + row + 0.5;
    const crossings = edges.reduce<Crossing[]>((acc, edge) => {
      const { from, to } = edge;
      const isInside = scanY >= Math.min(from.y, to.y) && scanY < Math.max(from.y, to.y);

      if (isInside) {
        acc.push({
          x: from.x + ((scanY - from.y) / (to.y - from.y)) * (to.x - from.x),
          winding: to.y > from.y ? 1 : -1,
        });
      }

      return acc;
    }, []);

    crossings.sort((first, second) => {
      return first.x - second.x;
    });

    let winding = 0;

    for (const [index, crossing] of crossings.entries()) {
      winding += crossing.winding;

      const next = crossings[index + 1];

      if (winding === 0 || !next) {
        continue;
      }

      const fromColumn = Math.max(0, Math.ceil(crossing.x - minX - 0.5));
      const toColumn = Math.min(width - 1, Math.floor(next.x - minX - 0.5));

      for (let column = fromColumn; column <= toColumn; column += 1) {
        ink[row * width + column] = 1;
      }
    }
  }

  return ink;
};

/**
 * Расширяет чернила на радиус допуска: волосяное касание в исходном шрифте
 * держится на округлении растра, а не на геометрии, и без допуска счётчик
 * реагирует на него, а не на деформацию.
 */
export const growInk = (ink: Uint8Array, box: InkBox, tolerance: number): Uint8Array => {
  const { width, height } = box;
  const grown = tolerance > 0 ? new Uint8Array(ink) : ink;

  if (tolerance > 0) {
    for (let row = 0; row < height; row += 1) {
      for (let column = 0; column < width; column += 1) {
        if (ink[row * width + column] !== 1) {
          continue;
        }

        for (let deltaRow = -tolerance; deltaRow <= tolerance; deltaRow += 1) {
          for (let deltaColumn = -tolerance; deltaColumn <= tolerance; deltaColumn += 1) {
            const nextRow = row + deltaRow;
            const nextColumn = column + deltaColumn;
            const isInside =
              nextRow >= 0 && nextRow < height && nextColumn >= 0 && nextColumn < width;

            if (isInside) {
              grown[nextRow * width + nextColumn] = 1;
            }
          }
        }
      }
    }
  }

  return grown;
};

/**
 * Число связных областей чернил в маске: обход в ширину по соседям через
 * сторону.
 */
const countMaskComponents = (ink: Uint8Array, box: InkBox): number => {
  const { width, height } = box;
  const seen = new Uint8Array(ink.length);
  let components = 0;

  for (let start = 0; start < ink.length; start += 1) {
    if (ink[start] !== 1 || seen[start] === 1) {
      continue;
    }

    components += 1;
    seen[start] = 1;

    const queue = [start];

    while (queue.length > 0) {
      const index = queue.pop() || 0;
      const row = Math.floor(index / width);
      const column = index % width;
      const neighbours = [
        row > 0 ? index - width : -1,
        row < height - 1 ? index + width : -1,
        column > 0 ? index - 1 : -1,
        column < width - 1 ? index + 1 : -1,
      ];

      for (const neighbour of neighbours) {
        if (neighbour >= 0 && ink[neighbour] === 1 && seen[neighbour] !== 1) {
          seen[neighbour] = 1;
          queue.push(neighbour);
        }
      }
    }
  }

  return components;
};

/**
 * Сколько связных областей чернил образуют ломаные.
 *
 * Проверка связности почерка держится именно на этом числе: слово связного
 * шрифта — это несколько сомкнутых росчерков, и разрыв соединения виден как
 * лишняя область, а не как смещение точки.
 *
 * @param polylines — замкнутые ломаные в пикселях
 * @param tolerance — допуск смыкания в пикселях
 * @returns число связных областей; ноль — чернил нет вовсе
 */
export const countInkComponents = (
  polylines: readonly Polyline[],
  tolerance = 1
): number => {
  const edges = toEdges(polylines);

  if (edges.length === 0) {
    return 0;
  }

  const box = edgeBounds(edges);

  return countMaskComponents(growInk(fillMask(edges, box), box, tolerance), box);
};
