import type { SheetImageData } from '@pages/Generator/lib/paper';
import { detectRuling } from '@pages/Generator/lib/paper/detectRuling';
import { describe, expect, it } from 'vitest';

import {
  computeSyntheticLineEnds,
  createSyntheticSheet,
  type SyntheticCurve,
  type SyntheticSheetParams,
} from './helpers/synthetic-sheet';

/**
 * Допуск на поле в пикселях.
 */
const PIXEL_TOLERANCE = 1;

/**
 * Лист в линейку без линии поля: горизонтальные линии кончаются внутри кадра.
 */
const ENDS_SHEET = {
  width: 420,
  height: 1200,
  step: 24,
  phase: 8,
  margins: { top: 48, right: 60, bottom: 48, left: 60 },
  noise: 0.04,
} satisfies SyntheticSheetParams;

const EDGE_GAP = ENDS_SHEET.step / 5;

const REGION_TOP = ENDS_SHEET.margins.top;

const REGION_BOTTOM = ENDS_SHEET.height - ENDS_SHEET.margins.bottom;

/**
 * Амплитуда изгиба — три десятых шага.
 */
const BEND_AMPLITUDE = 0.3 * ENDS_SHEET.step;

/**
 * Поля на этих листах с тем же углом, снятые по отклику гребёнки, усреднённому
 * по всей высоте кадра, без полос: на листе, где концы линий ровные,
 * полосный отклик не должен их сдвигать.
 */
const BASE_MARGINS = {
  straight: { left: 64.8001, right: 63.8001 },
  bend: { left: 64.8003, right: 63.8003 },
  tiltPlus: { left: 64.8007, right: 63.8007 },
  tiltMinus: { left: 65.8007, right: 63.8007 },
  spiralStep: { left: 64.8003, right: 63.8003 },
  pale: { left: 64.8001, right: 63.8001 },
};

type SideMargins = (typeof BASE_MARGINS)['straight'];

const toRegionShare = (y: number): number => {
  return (2 * (y - REGION_TOP)) / (REGION_BOTTOM - REGION_TOP) - 1;
};

const detect = (params: SyntheticSheetParams, image?: SheetImageData): SideMargins => {
  const { margins } = detectRuling(image || createSyntheticSheet(params), {
    skewAngle: params.angle || 0,
  });

  return { left: margins.left, right: margins.right };
};

/**
 * Запас на округление эталона: граница области дискретна по столбцам, и сдвиг
 * ровно на столбец — ещё в допуске, а эталон записан с четырьмя знаками.
 */
const BASE_ROUNDING = 1e-3;

const expectBaseMargins = (margins: SideMargins, base: SideMargins): void => {
  expect(Math.abs(margins.left - base.left)).toBeLessThanOrEqual(
    PIXEL_TOLERANCE + BASE_ROUNDING
  );
  expect(Math.abs(margins.right - base.right)).toBeLessThanOrEqual(
    PIXEL_TOLERANCE + BASE_ROUNDING
  );
};

/**
 * Темнит кадр правее столбца `from`: стол или соседний лист за концами линий.
 */
const darkenBeyond = (image: SheetImageData, from: number, amount: number): void => {
  const { width, height, luminance } = image;

  for (let y = 0; y < height; y += 1) {
    for (let x = from; x < width; x += 1) {
      luminance[y * width + x] = Math.max(0, (luminance[y * width + x] || 0) - amount);
    }
  }
};

describe('detectRuling: концы горизонтальных линий по полосам', () => {
  it('ставит боковые поля не ближе к краю кадра, чем самый внутренний конец линий плюс пятая часть шага', () => {
    const leftBend: SyntheticCurve = (y) => {
      return BEND_AMPLITUDE * toRegionShare(y) ** 2;
    };

    const rightBend: SyntheticCurve = (y) => {
      return -BEND_AMPLITUDE * (1 - toRegionShare(y) ** 2);
    };

    const params = { ...ENDS_SHEET, lineEndsBend: { left: leftBend, right: rightBend } };
    let innermostLeft = Number.NEGATIVE_INFINITY;
    let innermostRight = Number.POSITIVE_INFINITY;

    for (let y = REGION_TOP; y <= REGION_BOTTOM; y += 1) {
      const ends = computeSyntheticLineEnds(params, y);

      innermostLeft = Math.max(innermostLeft, ends.left);
      innermostRight = Math.min(innermostRight, ends.right);
    }

    const { left, right } = detect(params);

    expect(left).toBeGreaterThanOrEqual(innermostLeft + EDGE_GAP - PIXEL_TOLERANCE);
    expect(left).toBeLessThanOrEqual(innermostLeft + EDGE_GAP + ENDS_SHEET.step / 6);
    expect(right).toBeGreaterThanOrEqual(
      ENDS_SHEET.width - innermostRight + EDGE_GAP - PIXEL_TOLERANCE
    );
    expect(right).toBeLessThanOrEqual(
      ENDS_SHEET.width - innermostRight + EDGE_GAP + ENDS_SHEET.step / 6
    );
  });

  it('не сдвигает поля, если горизонтали изогнуты на три десятых шага в углах, а концы ровные', () => {
    const margins = detect({
      ...ENDS_SHEET,
      bend: (x, y) => {
        return (
          BEND_AMPLITUDE *
          ((2 * x) / ENDS_SHEET.width - 1) *
          ((2 * y) / ENDS_SHEET.height - 1)
        );
      },
    });

    expectBaseMargins(margins, BASE_MARGINS.bend);
  });

  it('не сдвигает поля на листе с наклоном ±1,5° и ровными концами', () => {
    expectBaseMargins(detect({ ...ENDS_SHEET, angle: 1.5 }), BASE_MARGINS.tiltPlus);
    expectBaseMargins(detect({ ...ENDS_SHEET, angle: -1.5 }), BASE_MARGINS.tiltMinus);
  });

  /**
   * Пятна спирали ближе шага от левых концов линий, шаг пятен не равен шагу
   * линий; за правыми концами кадр темнее — стол.
   */
  it('не сдвигает поля из-за пятен спирали и яркостной ступени за концами линий', () => {
    const params = { ...ENDS_SHEET, spiral: { x: 46, period: 33, radius: 5 } };
    const image = createSyntheticSheet(params);

    darkenBeyond(image, ENDS_SHEET.width - ENDS_SHEET.margins.right + 10, 0.15);

    expectBaseMargins(detect(params, image), BASE_MARGINS.spiralStep);
  });

  /**
   * Бледное пятно — на три с половиной полосы по высоте и на четыре шага по
   * ширине, в двух шагах от правых концов. В этих полосах отклик за пятном
   * снова держится, и обрыв на пятне — не конец линий.
   */
  it('не сдвигает поля из-за пятна пониженного контраста на нескольких соседних полосах у края', () => {
    const margins = detect({
      ...ENDS_SHEET,
      lowContrastArea: { left: 216, right: 312, top: 400, bottom: 568, contrast: 0.3 },
    });

    expectBaseMargins(margins, BASE_MARGINS.pale);
  });

  it('не сдвигает поля на ровном листе с ровными концами', () => {
    expectBaseMargins(detect(ENDS_SHEET), BASE_MARGINS.straight);
  });

  /**
   * Концы в двух шагах от края высокого кадра: защитная полоса наклона по
   * высоте кадра шире двух шагов и прячет их от отклика во всю высоту.
   * Правая граница области — за последним столбцом, где линия ещё рисуется.
   */
  it('находит концы линий в двух шагах от края кадра высотой 4000 px при наклоне 1,5°', () => {
    const tallSheet = {
      width: 600,
      height: 4000,
      step: 48,
      phase: 20,
      margins: { top: 96, right: 96, bottom: 96, left: 96 },
      noise: 0.04,
    } satisfies SyntheticSheetParams;
    const gap = tallSheet.step / 5;
    const bothEnds = detect({ ...tallSheet, angle: -1.5 });
    const leftEnd = detect({
      ...tallSheet,
      angle: 1.5,
      margins: { ...tallSheet.margins, right: 0 },
    });

    expect(Math.abs(bothEnds.left - (tallSheet.margins.left + gap))).toBeLessThanOrEqual(
      PIXEL_TOLERANCE
    );
    expect(
      Math.abs(bothEnds.right - (tallSheet.margins.right - 1 + gap))
    ).toBeLessThanOrEqual(PIXEL_TOLERANCE);
    expect(Math.abs(leftEnd.left - (tallSheet.margins.left + gap))).toBeLessThanOrEqual(
      PIXEL_TOLERANCE
    );
    expect(leftEnd.right).toBe(0);
  });
});
