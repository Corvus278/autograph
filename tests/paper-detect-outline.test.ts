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
 * Наклон сторон на краю гарантии spec: «не больше чем на пять градусов».
 */
const GUARANTEED_SIDE_ANGLE = 5;

/**
 * Прямоугольный лист на столе, повёрнутый вокруг своей середины. Поворот
 * вокруг середины листа, а не кадра: лист у угла кадра остаётся у угла.
 *
 * @param sheetWidth — ширина листа
 * @param sheetHeight — высота листа
 * @param degrees — угол поворота в градусах
 * @param left — левый край листа до поворота; по умолчанию лист по середине
 * @param top — верхний край листа до поворота; по умолчанию лист по середине
 * @returns параметры листа
 */
const createRotatedSheet = (
  sheetWidth: number,
  sheetHeight: number,
  degrees: number,
  left = (WIDTH - sheetWidth) / 2,
  top = (HEIGHT - sheetHeight) / 2
): SyntheticSheetParams => {
  const shiftX = left + sheetWidth / 2 - WIDTH / 2;
  const shiftY = top + sheetHeight / 2 - HEIGHT / 2;

  const toCorner = (offsetX: number, offsetY: number): SheetPoint => {
    const { x, y } = rotateAroundCenter(
      { x: WIDTH / 2 + offsetX, y: HEIGHT / 2 + offsetY },
      degrees
    );

    return { x: x + shiftX, y: y + shiftY };
  };

  return {
    ...SHEET_BASE,
    surface: {
      outline: {
        topLeft: toCorner(-sheetWidth / 2, -sheetHeight / 2),
        topRight: toCorner(sheetWidth / 2, -sheetHeight / 2),
        bottomRight: toCorner(sheetWidth / 2, sheetHeight / 2),
        bottomLeft: toCorner(-sheetWidth / 2, sheetHeight / 2),
      },
      cornerRadius: 70,
      brightness: 0.3,
    },
  };
};

/**
 * Отступ листа у угла кадра: при повороте на пять градусов углы листа в
 * половину кадра ещё остаются в кадре.
 */
const CORNER_GAP = 150;

/**
 * Листы на краях гарантии: наклон ±5° на нескольких размерах — оценка наклона
 * под самым пределом рассыпается по-разному в зависимости от того, как стороны
 * ложатся на полосы, — и лист ровно в половину кадра по ширине и по высоте, без
 * наклона и под пределом, по середине кадра и у каждого его угла. У угла часть
 * стороны попадает в немые концы, а дальняя сторона лежит почти в середине
 * кадра. Стол виден со всех четырёх сторон, ни один угол не уходит за кадр.
 */
const EDGE_GUARANTEE_SHEETS: [string, SyntheticSheetParams][] = [
  [2000, 3000, GUARANTEED_SIDE_ANGLE],
  [2000, 3000, -GUARANTEED_SIDE_ANGLE],
  [2200, 3200, GUARANTEED_SIDE_ANGLE],
  [2200, 3200, -GUARANTEED_SIDE_ANGLE],
  [2400, 3400, GUARANTEED_SIDE_ANGLE],
  [2400, 3400, -GUARANTEED_SIDE_ANGLE],
  [WIDTH / 2, HEIGHT / 2, 0],
  [WIDTH / 2, HEIGHT / 2, GUARANTEED_SIDE_ANGLE],
  [WIDTH / 2, HEIGHT / 2, -GUARANTEED_SIDE_ANGLE],
].map(([sheetWidth = 0, sheetHeight = 0, degrees = 0]) => {
  return [
    `${sheetWidth}×${sheetHeight} по середине под ${degrees}°`,
    createRotatedSheet(sheetWidth, sheetHeight, degrees),
  ];
});

const CORNER_GUARANTEE_SHEETS: [string, SyntheticSheetParams][] = [
  [CORNER_GAP, CORNER_GAP],
  [WIDTH / 2 - CORNER_GAP, CORNER_GAP],
  [CORNER_GAP, HEIGHT / 2 - CORNER_GAP],
  [WIDTH / 2 - CORNER_GAP, HEIGHT / 2 - CORNER_GAP],
].flatMap(([left = 0, top = 0]) => {
  return [GUARANTEED_SIDE_ANGLE, -GUARANTEED_SIDE_ANGLE].map<
    [string, SyntheticSheetParams]
  >((degrees) => {
    return [
      `${WIDTH / 2}×${HEIGHT / 2} с углом в (${left}, ${top}) под ${degrees}°`,
      createRotatedSheet(WIDTH / 2, HEIGHT / 2, degrees, left, top),
    ];
  });
});

/**
 * Листы, стороны которых явно круче гарантии: сторона отказывается целиком, а
 * не встаёт сдвинутой или прижатой к пределу. Отказ всех сторон — `null`.
 */
const STEEP_SHEETS: [string, SyntheticSheetParams][] = [8, -8, 10, -10].map((degrees) => {
  return [`2200×3200 под ${degrees}°`, createRotatedSheet(2200, 3200, degrees)];
});

/**
 * Листы за гарантией, но в запасе оценки наклона у части сторон: запас
 * короткой стороны кадра шире, чем длинной, и сторона вдоль ширины проходит,
 * а соседняя вдоль высоты отказана. Контур из таких сторон уводил бы углы на
 * сотни пикселей, поэтому отказывается целиком.
 */
const MIXED_STEEP_SHEETS: [string, SyntheticSheetParams][] = [
  [1500, 2000, 5.8],
  [1500, 2000, -5.8],
  [2200, 3200, 5.8],
  [2200, 3200, -5.8],
  [1500, 2000, 6],
].map(([sheetWidth = 0, sheetHeight = 0, degrees = 0]) => {
  return [
    `${sheetWidth}×${sheetHeight} под ${degrees}°`,
    createRotatedSheet(sheetWidth, sheetHeight, degrees),
  ];
});

/**
 * Лист во весь кадр, у которого справа сверху виден клин стола под семь
 * градусов: верхняя сторона от левого верхнего угла кадра уходит вниз круче
 * гарантии.
 */
const STEEP_WEDGE_SHEET: SyntheticSheetParams = {
  ...SHEET_BASE,
  surface: {
    outline: {
      topLeft: { x: 0, y: 0 },
      topRight: { x: WIDTH, y: WIDTH * Math.tan((7 * Math.PI) / 180) },
      bottomRight: { x: WIDTH, y: HEIGHT },
      bottomLeft: { x: 0, y: HEIGHT },
    },
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
 * Лист шире кадра, повёрнутый за гарантию, но в запасе верхней и нижней
 * сторон: боковых сторон в кадре нет вовсе. Отсутствие стороны за кадром — не
 * отказ по наклону, и верх с низом остаются найденными.
 */
const WIDE_STEEP_SHEET: SyntheticSheetParams = createRotatedSheet(3600, 3000, 5.5);

/**
 * Глубина прямой через две точки в заданном столбце кадра.
 *
 * @param from — первая точка прямой
 * @param to — вторая точка прямой
 * @param x — столбец кадра
 * @returns строка прямой в этом столбце
 */
const lineYAt = (from: SheetPoint, to: SheetPoint, x: number): number => {
  return from.y + ((to.y - from.y) * (x - from.x)) / (to.x - from.x);
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

  it.each([...EDGE_GUARANTEE_SHEETS, ...CORNER_GUARANTEE_SHEETS])(
    'находит четыре стороны листа на краю гарантии: %s',
    (_name, params) => {
      const outline = detectSheetOutline(createSyntheticSheet(params));
      const expected = computeSyntheticOutline(params);

      expect(outline).not.toBeNull();
      toCornerPairs(outline || expected, expected).forEach(([corner, reference]) => {
        expect(Math.abs(corner.x - reference.x)).toBeLessThanOrEqual(X_TOLERANCE);
        expect(Math.abs(corner.y - reference.y)).toBeLessThanOrEqual(Y_TOLERANCE);
      });
    }
  );

  it('оставляет верх и низ круче пяти градусов, когда боковые стороны за кадром', () => {
    const outline = detectSheetOutline(createSyntheticSheet(WIDE_STEEP_SHEET));
    const expected = computeSyntheticOutline(WIDE_STEEP_SHEET);

    expect(outline).not.toBeNull();
    [
      [outline?.topLeft, expected.topLeft, expected.topRight],
      [outline?.topRight, expected.topLeft, expected.topRight],
      [outline?.bottomLeft, expected.bottomLeft, expected.bottomRight],
      [outline?.bottomRight, expected.bottomLeft, expected.bottomRight],
    ].forEach(([corner, from = expected.topLeft, to = expected.topRight]) => {
      const x = corner?.x || 0;

      expect(Math.abs((corner?.y || 0) - lineYAt(from, to, x))).toBeLessThanOrEqual(
        Y_TOLERANCE
      );
    });
    expect(outline?.topLeft.x).toBe(0);
    expect(outline?.bottomRight.x).toBe(WIDTH);
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
    ...STEEP_SHEETS,
    ...MIXED_STEEP_SHEETS,
    ['клин стола под 7° у листа во весь кадр', STEEP_WEDGE_SHEET],
  ])('не находит ни одной стороны: %s', (_name, params) => {
    expect(detectSheetOutline(createSyntheticSheet(params))).toBeNull();
  });
});
