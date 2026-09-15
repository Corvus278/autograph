import type { PaperMargins, SheetOutline, SheetPoint } from '@pages/Generator/lib/paper';
import { resolveSheetBounds } from '@pages/Generator/lib/paper/resolveSheetBounds';
import { describe, expect, it } from 'vitest';

const FRAME_WIDTH = 3000;

const FRAME_HEIGHT = 4000;

/**
 * Число узлов сетки проверки по каждой оси: 20 × 20 = 400 точек.
 */
const GRID_SIZE = 20;

/**
 * Допуск на округление при проверке «точка внутри контура»: точка на стороне
 * контура считается внутренней.
 */
const INSIDE_TOLERANCE = 1e-9;

/**
 * Четырёхугольник листа, снятого под углом и в перспективе: верхняя сторона
 * короче нижней на `narrowing`, весь лист повёрнут на `angleDeg` вокруг
 * середины.
 *
 * @param angleDeg — поворот листа в градусах
 * @param narrowing — доля, на которую верхняя сторона короче нижней
 * @returns контур в пикселях кадра
 */
const createTiltedOutline = (angleDeg: number, narrowing: number): SheetOutline => {
  const centerX = FRAME_WIDTH / 2;
  const centerY = FRAME_HEIGHT / 2;
  const halfBottom = 1200;
  const halfTop = halfBottom * (1 - narrowing);
  const halfHeight = 1600;
  const angle = (angleDeg * Math.PI) / 180;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);

  const rotate = (dx: number, dy: number): SheetPoint => {
    return { x: centerX + dx * cos - dy * sin, y: centerY + dx * sin + dy * cos };
  };

  return {
    topLeft: rotate(-halfTop, -halfHeight),
    topRight: rotate(halfTop, -halfHeight),
    bottomRight: rotate(halfBottom, halfHeight),
    bottomLeft: rotate(-halfBottom, halfHeight),
  };
};

/**
 * Лежит ли точка внутри выпуклого контура или на его стороне. Обход
 * `topLeft → topRight → bottomRight → bottomLeft` в координатах кадра (ось `y`
 * вниз) идёт по часовой стрелке, и внутренняя точка лежит справа от каждой
 * стороны.
 *
 * @param outline — контур листа
 * @param point — проверяемая точка
 * @returns `true`, если точка не снаружи
 */
const isInsideOutline = (outline: SheetOutline, point: SheetPoint): boolean => {
  const { topLeft, topRight, bottomRight, bottomLeft } = outline;
  const corners = [topLeft, topRight, bottomRight, bottomLeft];

  return corners.every((start, index) => {
    const end = corners[(index + 1) % corners.length] || start;
    const cross =
      (end.x - start.x) * (point.y - start.y) - (end.y - start.y) * (point.x - start.x);

    return cross >= -INSIDE_TOLERANCE;
  });
};

/**
 * Узлы равномерной сетки прямоугольника, заданного отступами от краёв кадра,
 * включая его стороны.
 *
 * @param margins — отступы прямоугольника
 * @returns `GRID_SIZE × GRID_SIZE` точек
 */
const createGridPoints = (margins: PaperMargins): SheetPoint[] => {
  const left = margins.left;
  const right = FRAME_WIDTH - margins.right;
  const top = margins.top;
  const bottom = FRAME_HEIGHT - margins.bottom;
  const points: SheetPoint[] = [];

  for (let row = 0; row < GRID_SIZE; row += 1) {
    for (let column = 0; column < GRID_SIZE; column += 1) {
      points.push({
        x: left + ((right - left) * column) / (GRID_SIZE - 1),
        y: top + ((bottom - top) * row) / (GRID_SIZE - 1),
      });
    }
  }

  return points;
};

describe('resolveSheetBounds', () => {
  it('без контура отдаёт нулевые отступы', () => {
    expect(resolveSheetBounds(null, FRAME_WIDTH, FRAME_HEIGHT)).toEqual({
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
    });
  });

  it('у прямоугольного контура отступы равны расстояниям до его сторон', () => {
    const outline: SheetOutline = {
      topLeft: { x: 100, y: 150 },
      topRight: { x: 2900, y: 150 },
      bottomRight: { x: 2900, y: 3800 },
      bottomLeft: { x: 100, y: 3800 },
    };

    expect(resolveSheetBounds(outline, FRAME_WIDTH, FRAME_HEIGHT)).toEqual({
      top: 150,
      right: 100,
      bottom: 200,
      left: 100,
    });
  });

  it('прямоугольник повёрнутого листа с перспективным сужением лежит внутри контура', () => {
    const outline = createTiltedOutline(1.5, 0.03);
    const margins = resolveSheetBounds(outline, FRAME_WIDTH, FRAME_HEIGHT);
    const points = createGridPoints(margins);

    expect(FRAME_WIDTH - margins.left - margins.right).toBeGreaterThan(2000);
    expect(FRAME_HEIGHT - margins.top - margins.bottom).toBeGreaterThan(3000);
    expect(points).toHaveLength(400);

    const outsidePoints = points.filter((point) => {
      return !isInsideOutline(outline, point);
    });

    expect(outsidePoints).toEqual([]);
  });
});
