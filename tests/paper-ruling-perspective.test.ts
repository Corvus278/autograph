import type { RulingProjection } from '@pages/Generator/lib/paper';
import {
  lineCoordinateAt,
  lineHeightAt,
  lineHeightScaleAt,
  lineHeightSlopeAt,
} from '@pages/Generator/lib/paper/rulingPerspective';
import { describe, expect, it } from 'vitest';

const FRAME_WIDTH = 3000;

const FRAME_HEIGHT = 4000;

const DEGREES_IN_RADIAN = 180 / Math.PI;

/**
 * Дрейф шага по кадру: на всю ширину и на всю высоту шаг меняется на 8 %.
 */
const DRIFT = 0.08;

/**
 * Число узлов сетки проверки по каждой оси, включая края кадра.
 */
const GRID_SIZE = 16;

/**
 * Шаг конечной разности для сверки производных, px.
 */
const DIFFERENCE_STEP = 0.01;

type GridPoint = {
  /**
   * Отступ от левого края кадра.
   */
  x: number;

  /**
   * Отступ от верхнего края кадра.
   */
  y: number;
};

/**
 * Разлиновки с перспективой обоих знаков схождения: ошибка знака в одной из
 * формул проявилась бы только на одном из них.
 */
const DRIFT_PROJECTIONS: [string, RulingProjection][] = [
  [
    'сходятся вправо, шаг растёт вниз',
    {
      skewAngle: 1.2,
      perspective: {
        originX: FRAME_WIDTH / 2,
        originY: FRAME_HEIGHT / 2,
        convergenceX: DRIFT / FRAME_WIDTH,
        convergenceY: DRIFT / FRAME_HEIGHT,
      },
    },
  ],
  [
    'сходятся влево, шаг падает вниз',
    {
      skewAngle: -0.9,
      perspective: {
        originX: FRAME_WIDTH / 2,
        originY: FRAME_HEIGHT / 2,
        convergenceX: -DRIFT / FRAME_WIDTH,
        convergenceY: -DRIFT / FRAME_HEIGHT,
      },
    },
  ],
];

/**
 * Разлиновка, для которой координата и высота посчитаны по формулам design вне
 * модуля — на python с десятичной арифметикой в 40 знаков.
 */
const REFERENCE_PROJECTION: RulingProjection = {
  skewAngle: 1,
  perspective: {
    originX: 1500,
    originY: 2000,
    convergenceX: -2e-5,
    convergenceY: 1.5e-5,
  },
};

/**
 * Узлы равномерной сетки кадра, включая края.
 *
 * @returns `GRID_SIZE × GRID_SIZE` точек
 */
const createGridPoints = (): GridPoint[] => {
  const points: GridPoint[] = [];

  for (let row = 0; row < GRID_SIZE; row += 1) {
    for (let column = 0; column < GRID_SIZE; column += 1) {
      points.push({
        x: (FRAME_WIDTH * column) / (GRID_SIZE - 1),
        y: (FRAME_HEIGHT * row) / (GRID_SIZE - 1),
      });
    }
  }

  return points;
};

/**
 * Наибольшее значение функции по узлам сетки кадра.
 *
 * @param measure — величина в узле
 * @returns максимум по сетке
 */
const maxOverGrid = (measure: (point: GridPoint) => number): number => {
  return createGridPoints().reduce((max, point) => {
    return Math.max(max, measure(point));
  }, 0);
};

describe('координата вдоль линий', () => {
  it('без перспективы — прямая наклонная гребёнка, точно', () => {
    const projection: RulingProjection = { skewAngle: -1.3, perspective: null };
    const tangent = Math.tan(projection.skewAngle / DEGREES_IN_RADIAN);

    const mismatches = createGridPoints().filter(({ x, y }) => {
      const coordinate = lineCoordinateAt(projection, x, y);

      return (
        coordinate !== y - x * tangent ||
        lineHeightAt(projection, x, y) !== y + x * tangent
      );
    });

    expect(mismatches).toEqual([]);
  });

  it('совпадает с числами, посчитанными по формуле design вне модуля', () => {
    expect(lineCoordinateAt(REFERENCE_PROJECTION, 100, 300)).toBeCloseTo(
      302.43295462713,
      9
    );
    expect(lineCoordinateAt(REFERENCE_PROJECTION, 2900, 3800)).toBeCloseTo(
      3751.157651957519,
      9
    );
    expect(lineCoordinateAt(REFERENCE_PROJECTION, 2400, 900)).toBeCloseTo(
      818.240438925234,
      9
    );

    expect(lineHeightAt(REFERENCE_PROJECTION, 100, 250)).toBeCloseTo(248.760866633186, 9);
    expect(lineHeightAt(REFERENCE_PROJECTION, 2900, 3700)).toBeCloseTo(
      3747.535044291689,
      9
    );
    expect(lineHeightAt(REFERENCE_PROJECTION, 2400, 850)).toBeCloseTo(
      930.155516799233,
      9
    );
  });

  it.each(DRIFT_PROJECTIONS)(
    '%s: высота обращает координату на всём кадре',
    (_, projection) => {
      const tangent = Math.tan(projection.skewAngle / DEGREES_IN_RADIAN);
      const flatCornerCoordinate = FRAME_HEIGHT - FRAME_WIDTH * tangent;

      expect(Math.abs(lineCoordinateAt(projection, 0, 0))).toBeGreaterThan(100);
      expect(
        Math.abs(
          lineCoordinateAt(projection, FRAME_WIDTH, FRAME_HEIGHT) - flatCornerCoordinate
        )
      ).toBeGreaterThan(100);

      const maxError = maxOverGrid(({ x, y }) => {
        return Math.abs(
          lineHeightAt(projection, x, lineCoordinateAt(projection, x, y)) - y
        );
      });

      expect(maxError).toBeLessThanOrEqual(1e-6);
    }
  );

  it.each([
    ...DRIFT_PROJECTIONS,
    ['без перспективы', { skewAngle: 0.7, perspective: null }] satisfies [
      string,
      RulingProjection,
    ],
  ])('%s: производные высоты совпадают с конечными разностями', (_, projection) => {
    const maxSlopeError = maxOverGrid(({ x, y }) => {
      const coordinate = lineCoordinateAt(projection, x, y);
      const difference =
        (lineHeightAt(projection, x + DIFFERENCE_STEP, coordinate) -
          lineHeightAt(projection, x - DIFFERENCE_STEP, coordinate)) /
        (2 * DIFFERENCE_STEP);

      return Math.abs(lineHeightSlopeAt(projection, coordinate) - difference);
    });

    const maxScaleError = maxOverGrid(({ x, y }) => {
      const coordinate = lineCoordinateAt(projection, x, y);
      const difference =
        (lineHeightAt(projection, x, coordinate + DIFFERENCE_STEP) -
          lineHeightAt(projection, x, coordinate - DIFFERENCE_STEP)) /
        (2 * DIFFERENCE_STEP);

      return Math.abs(lineHeightScaleAt(projection, x, coordinate) - difference);
    });

    expect(maxSlopeError).toBeLessThanOrEqual(1e-7);
    expect(maxScaleError).toBeLessThanOrEqual(1e-7);
  });

  it.each(DRIFT_PROJECTIONS)(
    '%s: у отражённой разлиновки координата сдвинута на наклон во всю ширину',
    (_, projection) => {
      const { skewAngle, perspective } = projection;

      expect(perspective).not.toBeNull();

      const mirrored: RulingProjection = {
        skewAngle: -skewAngle,
        perspective: perspective && {
          ...perspective,
          originX: FRAME_WIDTH - perspective.originX,
          convergenceX: -perspective.convergenceX,
        },
      };
      const shift = FRAME_WIDTH * Math.tan(skewAngle / DEGREES_IN_RADIAN);

      const maxError = maxOverGrid(({ x, y }) => {
        return Math.abs(
          lineCoordinateAt(mirrored, FRAME_WIDTH - x, y) -
            (lineCoordinateAt(projection, x, y) + shift)
        );
      });

      expect(maxError).toBeLessThanOrEqual(1e-9);
    }
  );
});
