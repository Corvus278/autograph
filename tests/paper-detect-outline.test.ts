import type { SheetOutline, SheetPoint } from '@pages/Generator/lib/paper';
import { detectSheetOutline } from '@pages/Generator/lib/paper';
import { describe, expect, it } from 'vitest';

import {
  computeSyntheticOutline,
  createSyntheticSheet,
  type SyntheticSheetParams,
} from './helpers/synthetic-sheet';

/**
 * Кадр размером со снимок телефона: контур ищется по уменьшенной копии, и на
 * кадре поменьше проверка не поймала бы промах масштабирования обратно.
 */
const WIDTH = 3000;

const HEIGHT = 4000;

/**
 * Допуск задачи: 0,6 % стороны кадра. Столбцы меряются долей ширины, строки —
 * долей высоты.
 */
const SIDE_TOLERANCE_SHARE = 0.006;

const X_TOLERANCE = WIDTH * SIDE_TOLERANCE_SHARE;

const Y_TOLERANCE = HEIGHT * SIDE_TOLERANCE_SHARE;

/**
 * Разлиновка, освещение и зерно, общие у всех листов: контур обязан находиться
 * на листе с линиями, а не на пустой заливке.
 */
const SHEET_BASE: SyntheticSheetParams = {
  width: WIDTH,
  height: HEIGHT,
  step: 99.5,
  phase: 21,
  angle: 1,
  kind: 'grid',
  margins: { top: 560, right: 460, bottom: 560, left: 560 },
  lineWidth: 4,
  lineDarkness: 0.3,
  noise: 0.04,
  lighting: 0.3,
  seed: 5,
};

/**
 * Контур листа на столе: стороны наклонены к краям кадра меньше чем на два
 * градуса, лист занимает большую часть кадра.
 */
const TABLE_OUTLINE: SheetOutline = {
  topLeft: { x: 380, y: 300 },
  topRight: { x: 2680, y: 240 },
  bottomRight: { x: 2720, y: 3720 },
  bottomLeft: { x: 420, y: 3780 },
};

/**
 * Ширина тени спирали: шире одного процента стороны кадра, иначе тень не
 * отличить от линии разлиновки, и уже полосы соседнего листа за ней.
 */
const SPIRAL_SHADOW_WIDTH = 90;

/**
 * Лист на столе: справа, сверху и снизу — стол вдвое темнее бумаги, слева —
 * тень спирали, за ней соседний лист светлее самой бумаги, и только за ним
 * стол. Полосой `cover` тень задана потому, что полоса у хелпера — это любая
 * полоса вдоль стороны, а ближней к листу здесь лежит именно тень.
 */
const TABLE_SHEET: SyntheticSheetParams = {
  ...SHEET_BASE,
  surface: {
    outline: TABLE_OUTLINE,
    cornerRadius: 70,
    brightness: 0.3,
    cover: { side: 'left', width: SPIRAL_SHADOW_WIDTH, brightness: 0.22 },
    neighbour: { side: 'left', width: 300, brightness: 0.95 },
  },
  spiral: { x: 400, period: 150, phase: 40, radius: 18, darkness: 0.7 },
};

/**
 * Поворот точки вокруг середины кадра.
 *
 * @param point — точка кадра
 * @param degrees — угол поворота в градусах
 * @returns повёрнутая точка
 */
const rotateAroundCenter = (point: SheetPoint, degrees: number): SheetPoint => {
  const radians = (degrees * Math.PI) / 180;
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  const offsetX = point.x - WIDTH / 2;
  const offsetY = point.y - HEIGHT / 2;

  return {
    x: WIDTH / 2 + offsetX * cosine - offsetY * sine,
    y: HEIGHT / 2 + offsetX * sine + offsetY * cosine,
  };
};

/**
 * Лист, повёрнутый на полтора градуса и сужённый перспективой на три процента:
 * верхняя сторона короче нижней, и прямые сторон уже не параллельны краям
 * кадра.
 */
const TILTED_OUTLINE: SheetOutline = {
  topLeft: rotateAroundCenter({ x: 384.5, y: 300 }, 1.5),
  topRight: rotateAroundCenter({ x: 2615.5, y: 300 }, 1.5),
  bottomRight: rotateAroundCenter({ x: 2650, y: 3700 }, 1.5),
  bottomLeft: rotateAroundCenter({ x: 350, y: 3700 }, 1.5),
};

const TILTED_SHEET: SyntheticSheetParams = {
  ...SHEET_BASE,
  surface: {
    outline: TILTED_OUTLINE,
    cornerRadius: 80,
    brightness: 0.3,
  },
};

/**
 * Лист шире кадра с трёх сторон: стол виден только полосой сверху.
 */
const TOP_BAND_OUTLINE: SheetOutline = {
  topLeft: { x: -200, y: 340 },
  topRight: { x: 3200, y: 280 },
  bottomRight: { x: 3200, y: 4200 },
  bottomLeft: { x: -200, y: 4200 },
};

const TOP_BAND_SHEET: SyntheticSheetParams = {
  ...SHEET_BASE,
  surface: { outline: TOP_BAND_OUTLINE, brightness: 0.3 },
};

/**
 * Обрезанная по краям листа фотография: поверхности в кадре нет.
 */
const CROPPED_SHEET: SyntheticSheetParams = { ...SHEET_BASE, surface: null };

/**
 * Лист на поверхности светлее бумаги: контура быть не должно, но и
 * отбрасывать фотографию не за что.
 */
const PALE_SURFACE_SHEET: SyntheticSheetParams = {
  ...SHEET_BASE,
  surface: { outline: TABLE_OUTLINE, cornerRadius: 70, brightness: 0.9 },
};

/**
 * Лист во весь кадр с виньеткой объектива: к углам кадра бумага темнеет, и
 * потемнение обязано остаться светом, а не краем листа.
 */
const VIGNETTE_SHEET: SyntheticSheetParams = {
  ...SHEET_BASE,
  lighting: 0.2,
  surface: {
    outline: {
      topLeft: { x: 0, y: 0 },
      topRight: { x: WIDTH, y: 0 },
      bottomRight: { x: WIDTH, y: HEIGHT },
      bottomLeft: { x: 0, y: HEIGHT },
    },
    vignette: 0.25,
  },
};

/**
 * Углы контура парами «найденный — эталонный».
 *
 * @param found — найденный контур
 * @param expected — эталонный контур
 * @returns пары углов
 */
const toCornerPairs = (
  found: SheetOutline,
  expected: SheetOutline
): [SheetPoint, SheetPoint][] => {
  return [
    [found.topLeft, expected.topLeft],
    [found.topRight, expected.topRight],
    [found.bottomRight, expected.bottomRight],
    [found.bottomLeft, expected.bottomLeft],
  ];
};

describe('detectSheetOutline: лист на поверхности', () => {
  it('находит четыре стороны листа на столе со спиралью слева', () => {
    const outline = detectSheetOutline(createSyntheticSheet(TABLE_SHEET));
    const expected = computeSyntheticOutline(TABLE_SHEET);

    expect(outline).not.toBeNull();
    toCornerPairs(outline || expected, expected).forEach(([corner, reference]) => {
      expect(Math.abs(corner.x - reference.x)).toBeLessThanOrEqual(X_TOLERANCE);
      expect(Math.abs(corner.y - reference.y)).toBeLessThanOrEqual(Y_TOLERANCE);
    });
  });

  it('левая сторона идёт по внутреннему краю тени спирали, а не за соседним листом', () => {
    const outline = detectSheetOutline(createSyntheticSheet(TABLE_SHEET));
    const expected = computeSyntheticOutline(TABLE_SHEET);

    expect(outline).not.toBeNull();
    expect((outline || expected).topLeft.x).toBeGreaterThan(
      expected.topLeft.x - SPIRAL_SHADOW_WIDTH
    );
    expect((outline || expected).bottomLeft.x).toBeGreaterThan(
      expected.bottomLeft.x - SPIRAL_SHADOW_WIDTH
    );
  });

  it('находит стороны повёрнутого и сужённого перспективой листа со скруглёнными углами', () => {
    const outline = detectSheetOutline(createSyntheticSheet(TILTED_SHEET));
    const expected = computeSyntheticOutline(TILTED_SHEET);

    expect(outline).not.toBeNull();
    toCornerPairs(outline || expected, expected).forEach(([corner, reference]) => {
      expect(Math.abs(corner.x - reference.x)).toBeLessThanOrEqual(X_TOLERANCE);
      expect(Math.abs(corner.y - reference.y)).toBeLessThanOrEqual(Y_TOLERANCE);
    });
  });

  it('находит одну верхнюю сторону, когда стол виден только полосой сверху', () => {
    const outline = detectSheetOutline(createSyntheticSheet(TOP_BAND_SHEET));
    const expected = computeSyntheticOutline(TOP_BAND_SHEET);
    const expectedTopLeftY =
      expected.topLeft.y +
      ((expected.topRight.y - expected.topLeft.y) * (0 - expected.topLeft.x)) /
        (expected.topRight.x - expected.topLeft.x);
    const expectedTopRightY =
      expected.topLeft.y +
      ((expected.topRight.y - expected.topLeft.y) * (WIDTH - expected.topLeft.x)) /
        (expected.topRight.x - expected.topLeft.x);

    expect(outline).not.toBeNull();
    expect(outline?.topLeft.x).toBe(0);
    expect(outline?.topRight.x).toBe(WIDTH);
    expect(outline?.bottomLeft).toEqual({ x: 0, y: HEIGHT });
    expect(outline?.bottomRight).toEqual({ x: WIDTH, y: HEIGHT });
    expect(Math.abs((outline?.topLeft.y || 0) - expectedTopLeftY)).toBeLessThanOrEqual(
      Y_TOLERANCE
    );
    expect(Math.abs((outline?.topRight.y || 0) - expectedTopRightY)).toBeLessThanOrEqual(
      Y_TOLERANCE
    );
  });

  it.each([
    ['обрезанная по краям листа фотография', CROPPED_SHEET],
    ['поверхность светлее бумаги', PALE_SURFACE_SHEET],
    ['лист во весь кадр с виньеткой', VIGNETTE_SHEET],
  ])('не находит ни одной стороны: %s', (_name, params) => {
    expect(detectSheetOutline(createSyntheticSheet(params))).toBeNull();
  });
});
