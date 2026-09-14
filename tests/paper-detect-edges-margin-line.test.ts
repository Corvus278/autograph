import { detectRuling } from '@pages/Generator/lib/paper/detectRuling';
import { describe, expect, it } from 'vitest';

import {
  computeSyntheticMarginLineX,
  createSyntheticSheet,
  type SyntheticCurve,
  type SyntheticSheetParams,
} from './helpers/synthetic-sheet';

/**
 * Допуск на положение линии поля в пикселях.
 */
const PIXEL_TOLERANCE = 1;

/**
 * Лист в линейку с линией поля. Высокий кадр: полоса трассировки — полтора
 * шага, и чем выше кадр при той же амплитуде изгиба, тем меньше линия успевает
 * уйти в пределах одной полосы, крайней в том числе.
 */
const MARGIN_SHEET = {
  width: 420,
  height: 2400,
  step: 24,
  phase: 8,
  margins: { top: 48, right: 30, bottom: 48, left: 30 },
  noise: 0.04,
} satisfies SyntheticSheetParams;

const LEFT_MARGIN_LINE_X = 90;

const RIGHT_MARGIN_LINE_X = 330;

/**
 * Амплитуда изгиба линии поля — три десятых шага.
 */
const BEND_AMPLITUDE = 0.3 * MARGIN_SHEET.step;

const REGION_TOP = MARGIN_SHEET.margins.top;

const REGION_BOTTOM = MARGIN_SHEET.height - MARGIN_SHEET.margins.bottom;

/**
 * `marginLineX` прямой линии поля на тех же листах и с тем же углом, снятый
 * измерением по среднему профилю столбцов, без трассировки по полосам: на
 * прямой линии трассировка не должна его сдвигать.
 */
const STRAIGHT_LEFT_BASE_X = 89.9995;

const STRAIGHT_RIGHT_TILTED_BASE_X = 329.998;

/**
 * Положение строки внутри области с линиями: −1 у верхнего края области, 1 у
 * нижнего.
 */
const toRegionShare = (y: number): number => {
  return (2 * (y - REGION_TOP)) / (REGION_BOTTOM - REGION_TOP) - 1;
};

/**
 * Параболический изгиб, самый сильный у верхнего и нижнего края области.
 *
 * @param sign — направление: 1 — вправо, −1 — влево
 * @returns сдвиг линии поля по высоте кадра
 */
const bendAtEdges = (sign: number): SyntheticCurve => {
  return (y) => {
    return sign * BEND_AMPLITUDE * toRegionShare(y) ** 2;
  };
};

/**
 * Параболический изгиб, самый сильный в середине высоты области.
 *
 * @param sign — направление: 1 — вправо, −1 — влево
 * @returns сдвиг линии поля по высоте кадра
 */
const bendAtMiddle = (sign: number): SyntheticCurve => {
  return (y) => {
    return sign * BEND_AMPLITUDE * (1 - toRegionShare(y) ** 2);
  };
};

/**
 * Самая внутренняя точка линии поля в области с линиями: у левой линии поля
 * область письма справа, у правой — слева.
 */
const findInnermostMarginLineX = (params: SyntheticSheetParams): number => {
  const isLeft = (params.marginLineX || 0) < (params.width || 0) / 2;
  let innermost = isLeft ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY;

  for (let y = REGION_TOP; y <= REGION_BOTTOM; y += 1) {
    const x = computeSyntheticMarginLineX(params, y) || 0;

    innermost = isLeft ? Math.max(innermost, x) : Math.min(innermost, x);
  }

  return innermost;
};

/**
 * Стирает или бледнит линию поля на строках `[from, to)`: точки вокруг линии
 * смешиваются с точками той же строки на `shift` левее, где линии поля нет, а
 * остальная разлиновка та же.
 *
 * @param image — растр листа, правится на месте
 * @param lineX — столбец линии поля по строке кадра
 * @param rows — строки `[from, to)`
 * @param shift — на сколько столбцов левее берётся фон
 * @param keep — какая доля глубины линии остаётся: 0 — линия стёрта
 */
const fadeMarginLine = (
  image: ReturnType<typeof createSyntheticSheet>,
  lineX: (y: number) => number,
  rows: [number, number],
  shift: number,
  keep: number
): void => {
  const { width, luminance } = image;
  const [from, to] = rows;

  for (let y = from; y < to; y += 1) {
    const row = y * width;
    const center = Math.round(lineX(y));

    for (let x = center - 8; x <= center + 8; x += 1) {
      const background = luminance[row + x - shift] || 0;
      const value = luminance[row + x] || 0;

      luminance[row + x] = background + keep * (value - background);
    }
  }
};

describe('detectRuling: трассировка линии поля', () => {
  it.each([
    ['слева, самая внутренняя точка у краёв области', LEFT_MARGIN_LINE_X, bendAtEdges(1)],
    ['слева, самая внутренняя точка в середине', LEFT_MARGIN_LINE_X, bendAtMiddle(1)],
    [
      'справа, самая внутренняя точка у краёв области',
      RIGHT_MARGIN_LINE_X,
      bendAtEdges(-1),
    ],
    ['справа, самая внутренняя точка в середине', RIGHT_MARGIN_LINE_X, bendAtMiddle(-1)],
  ])(
    'изогнутая линия поля %s не дальше от области письма, чем её самая внутренняя точка',
    (_label, marginLineX, marginLineBend) => {
      const params = { ...MARGIN_SHEET, marginLineX, marginLineBend };
      const innermost = findInnermostMarginLineX(params);
      const detection = detectRuling(createSyntheticSheet(params), { skewAngle: 0 });
      const detectedX = detection.marginLineX || 0;

      expect(detection.marginLineSide).toBe(
        marginLineX === LEFT_MARGIN_LINE_X ? 'left' : 'right'
      );

      if (marginLineX === LEFT_MARGIN_LINE_X) {
        expect(detectedX).toBeGreaterThanOrEqual(innermost - PIXEL_TOLERANCE);
        expect(detectedX).toBeLessThanOrEqual(innermost + MARGIN_SHEET.step / 6);

        return;
      }

      expect(detectedX).toBeLessThanOrEqual(innermost + PIXEL_TOLERANCE);
      expect(detectedX).toBeGreaterThanOrEqual(innermost - MARGIN_SHEET.step / 6);
    }
  );

  it('прямая линия поля даёт прежний результат', () => {
    const left = detectRuling(
      createSyntheticSheet({ ...MARGIN_SHEET, marginLineX: LEFT_MARGIN_LINE_X }),
      { skewAngle: 0 }
    );
    const rightTilted = detectRuling(
      createSyntheticSheet({
        ...MARGIN_SHEET,
        marginLineX: RIGHT_MARGIN_LINE_X,
        angle: 1.3,
      }),
      { skewAngle: 1.3 }
    );

    expect(Math.abs((left.marginLineX || 0) - STRAIGHT_LEFT_BASE_X)).toBeLessThanOrEqual(
      PIXEL_TOLERANCE
    );
    expect(
      Math.abs((rightTilted.marginLineX || 0) - STRAIGHT_RIGHT_TILTED_BASE_X)
    ).toBeLessThanOrEqual(PIXEL_TOLERANCE);
  });

  /**
   * Самая внутренняя точка — у верха области, а между ней и остальной линией
   * линия стёрта на несколько полос. Выше разрыва линия бледнее, чтобы старт
   * трассировки пришёлся ниже разрыва: трасса обязана перешагнуть его.
   */
  it('уточняет линию поля по остальным полосам, если в части полос её нет', () => {
    const marginLineBend: SyntheticCurve = (y) => {
      return BEND_AMPLITUDE * ((REGION_BOTTOM - y) / (REGION_BOTTOM - REGION_TOP)) ** 2;
    };

    const params = { ...MARGIN_SHEET, marginLineX: LEFT_MARGIN_LINE_X, marginLineBend };
    const image = createSyntheticSheet(params);

    const lineX = (y: number): number => {
      return LEFT_MARGIN_LINE_X + marginLineBend(y);
    };

    fadeMarginLine(image, lineX, [0, 300], 20, 0.9);
    fadeMarginLine(image, lineX, [300, 420], 20, 0);

    const { marginLineX } = detectRuling(image, { skewAngle: 0 });

    expect(marginLineX || 0).toBeGreaterThanOrEqual(
      findInnermostMarginLineX(params) - PIXEL_TOLERANCE
    );
  });

  /**
   * Вертикаль клетки стоит в окне трассировки с внутренней стороны линии поля.
   * Там, где линия поля стёрта, в окне остаётся только вертикаль, и трасса,
   * принявшая её, увела бы линию поля внутрь.
   */
  it('на клетчатом листе трасса не уходит на обычную вертикаль', () => {
    const marginLineX = 80;
    const params = {
      width: 420,
      height: 1200,
      step: 28,
      phase: 0,
      kind: 'grid',
      margins: { top: 56, right: 28, bottom: 56, left: 28 },
      marginLineX,
      marginLineDarkness: 0.9,
      noise: 0.04,
    } satisfies SyntheticSheetParams;
    const image = createSyntheticSheet(params);

    fadeMarginLine(
      image,
      () => {
        return marginLineX;
      },
      [400, 600],
      params.step,
      0
    );

    const detection = detectRuling(image, { skewAngle: 0 });

    expect(detection.kind).toBe('grid');
    expect(detection.marginLineSide).toBe('left');
    expect(Math.abs((detection.marginLineX || 0) - marginLineX)).toBeLessThanOrEqual(
      PIXEL_TOLERANCE
    );
  });
});
