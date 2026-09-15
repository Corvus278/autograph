import type { SheetRuling } from '@pages/Generator/lib/paper';
import { mirrorSheetRuling, resolveFirstLine } from '@pages/Generator/lib/paper';
import { describe, expect, it } from 'vitest';

/**
 * Наклонный лист пресет-пака `grid-1`: при таком угле и кадре наклон во всю
 * ширину ≈33 px ≈0.6 шага — больше допуска, поэтому потерянная поправка на
 * наклон не пройдёт незамеченной.
 */
const FRAME_WIDTH = 1600;
const STEP = 53.7;
const SKEW_ANGLE = -1.17;

/**
 * Допуск попадания базовой линии на линию разлиновки в долях шага — из
 * требования «Чётные страницы зеркалятся».
 */
const DRIFT_TOLERANCE = 0.1;

const DEGREES_IN_RADIAN = 180 / Math.PI;

const RULING: SheetRuling = {
  step: STEP,
  firstLinePhase: 21.4,
  skewAngle: SKEW_ANGLE,
  margins: { top: 180, right: 240, bottom: 150, left: 90 },
  marginLineX: 1360,
  marginLineSide: 'right',
  bend: null,
  perspective: null,
  outline: null,
};

/**
 * Точка кадра.
 */
type Point = {
  /**
   * Горизонталь в пикселях кадра.
   */
  x: number;

  /**
   * Вертикаль в пикселях кадра.
   */
  y: number;
};

/**
 * Отражение точки фотографии по горизонтали: так отражается сама фотография.
 */
const reflectPoint = ({ x, y }: Point): Point => {
  return { x: FRAME_WIDTH - x, y };
};

/**
 * Высота прямой, проходящей через две точки, на заданной горизонтали.
 */
const interpolateY = (first: Point, second: Point, x: number): number => {
  return first.y + ((second.y - first.y) * (x - first.x)) / (second.x - first.x);
};

/**
 * Где наклонная прямая исходного листа, идущая от высоты `y0` у его левого
 * края, проходит у левого края отражённой фотографии. Эталон строится
 * отражением двух точек прямой, а не формулой отражения разлиновки.
 */
const reflectLineAtLeftEdge = (y0: number): number => {
  const tilt = Math.tan(SKEW_ANGLE / DEGREES_IN_RADIAN);
  const left = reflectPoint({ x: 0, y: y0 });
  const right = reflectPoint({ x: FRAME_WIDTH, y: y0 + tilt * FRAME_WIDTH });

  return interpolateY(right, left, 0);
};

/**
 * Первая линия отражённой фотографии, лежащая не выше отражённого верхнего
 * поля, у левого края кадра — перебором линий исходного листа.
 */
const findMirroredFirstLine = (): number => {
  const top = reflectLineAtLeftEdge(RULING.margins.top);
  let firstLine = Number.POSITIVE_INFINITY;

  for (let index = -10; index < 100; index += 1) {
    const line = reflectLineAtLeftEdge(RULING.firstLinePhase + index * STEP);

    if (line >= top - 1e-6) {
      firstLine = Math.min(firstLine, line);
    }
  }

  return firstLine;
};

describe('mirrorSheetRuling', () => {
  it('первая базовая строка зеркальной страницы садится на линию отражённой фотографии', () => {
    const mirrored = mirrorSheetRuling(RULING, FRAME_WIDTH);
    const drift = Math.abs(resolveFirstLine(mirrored) - findMirroredFirstLine());

    expect(drift / STEP).toBeLessThanOrEqual(DRIFT_TOLERANCE);
  });

  it('наклон во всю ширину кадра больше допуска: без поправки строка ушла бы с линии', () => {
    const shift = Math.abs(reflectLineAtLeftEdge(0));

    expect(shift / STEP).toBeGreaterThan(DRIFT_TOLERANCE);
  });

  it('переносит линию поля к противоположному краю вместе со стороной', () => {
    const mirrored = mirrorSheetRuling(RULING, FRAME_WIDTH);

    expect(mirrored.marginLineX).toBe(reflectPoint({ x: 1360, y: 0 }).x);
    expect(mirrored.marginLineSide).toBe('left');
    expect(
      mirrorSheetRuling({ ...RULING, marginLineSide: 'left' }, FRAME_WIDTH).marginLineSide
    ).toBe('right');
  });

  it('меняет местами левое и правое поля и инвертирует наклон', () => {
    const mirrored = mirrorSheetRuling(RULING, FRAME_WIDTH);

    expect(mirrored.margins.left).toBe(RULING.margins.right);
    expect(mirrored.margins.right).toBe(RULING.margins.left);
    expect(mirrored.skewAngle).toBe(-SKEW_ANGLE);
    expect(mirrored.step).toBe(STEP);
  });

  it('сдвигает нижнее поле на наклон во всю ширину кадра', () => {
    const mirrored = mirrorSheetRuling(RULING, FRAME_WIDTH);
    const bottomLine = reflectLineAtLeftEdge(-RULING.margins.bottom);

    expect(mirrored.margins.bottom).toBeCloseTo(-bottomLine, 9);
  });

  it('без линии поля оставляет её отсутствующей', () => {
    const mirrored = mirrorSheetRuling(
      { ...RULING, marginLineX: null, marginLineSide: null },
      FRAME_WIDTH
    );

    expect(mirrored.marginLineX).toBeNull();
    expect(mirrored.marginLineSide).toBeNull();
  });

  it('ровный лист отражает без сдвига по вертикали', () => {
    const mirrored = mirrorSheetRuling({ ...RULING, skewAngle: 0 }, FRAME_WIDTH);

    expect(mirrored.skewAngle).toBe(0);
    expect(mirrored.firstLinePhase).toBeCloseTo(RULING.firstLinePhase, 9);
    expect(mirrored.margins.top).toBe(RULING.margins.top);
  });
});
