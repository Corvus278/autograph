import { measureSheetPhoto } from '@pages/Generator/lib/paper';
import { describe, expect, it } from 'vitest';

import type { HeldOutSheetParams } from './helpers/synthetic-sheet';
import { createHeldOutSheet, RED_MARGIN_LINE_COLOUR } from './helpers/synthetic-sheet';

/**
 * Допуск найденной черты от самого внутреннего её положения в шагах — тот же,
 * что у проверки удержанной синтетики 9.1.
 */
const TOLERANCE_STEPS = 0.2;

/**
 * Цвет удержанной синтетики 9.1: красная черта, нейтральная вставная
 * вертикаль.
 */
const HELD_OUT_COLOUR = {
  paperTint: RED_MARGIN_LINE_COLOUR.paperTint,
  noise: RED_MARGIN_LINE_COLOUR.noise,
  marginLineExcess: RED_MARGIN_LINE_COLOUR.marginLineExcess || 0,
  falseColumnExcess: 0,
};

/**
 * Прямая черта справа на сходящейся клетке без вставной вертикали и без цвета.
 * На перекрёстке черты с вертикалью клетки глубины складываются, и старт
 * трассы с этого узла поднимает её порог выше собственной глубины черты: без
 * повторной трассы черта не берёт охвата ни в одной ступени.
 */
const CONVERGING_STRAIGHT_RIGHT: HeldOutSheetParams = {
  marginLineSide: 'right',
  marginLineDrift: 0,
  convergence: 0.12356657575583085,
  vanishingShare: 0.6392339216545224,
  falseColumn: null,
  widthLighting: -0.21248197886161505,
  blot: null,
  seed: 1_043_275_230,
};

/**
 * Лист 3 удержанной синтетики seed 9173: черта справа со сносом в полтора
 * шага внутрь, нейтральная вставная вертикаль слева.
 */
const HELD_OUT_9173_SHEET_3: HeldOutSheetParams = {
  marginLineSide: 'right',
  marginLineDrift: 1.5040423199534416,
  convergence: 0.12356657575583085,
  vanishingShare: 0.6392339216545224,
  falseColumn: {
    side: 'left',
    ratio: 2.20311796432361,
    offset: 2.8459092136472464,
    isOnPhase: true,
  },
  widthLighting: -0.21248197886161505,
  blot: null,
  seed: 1_043_275_230,
  colour: HELD_OUT_COLOUR,
};

/**
 * Лист 5 удержанной синтетики seed 9173: черта слева со сносом наружу и
 * сильное схождение клетки, вставная вертикаль справа вне фазы.
 */
const HELD_OUT_9173_SHEET_5: HeldOutSheetParams = {
  marginLineSide: 'left',
  marginLineDrift: -0.42173623573035,
  convergence: 0.23712140962015837,
  vanishingShare: 0.42082527633756395,
  falseColumn: {
    side: 'right',
    ratio: 1.6288819932378829,
    offset: 1.1258876156061888,
    isOnPhase: false,
  },
  widthLighting: -0.2747294273925945,
  blot: null,
  seed: 1_846_136_043,
  colour: HELD_OUT_COLOUR,
};

describe('полосовой опрос: повторная трасса кандидата без охвата', () => {
  it.each([
    ['прямая черта на сходящейся клетке', CONVERGING_STRAIGHT_RIGHT],
    ['лист 3 seed 9173', HELD_OUT_9173_SHEET_3],
    ['лист 5 seed 9173', HELD_OUT_9173_SHEET_5],
  ])('%s: черта найдена у своей стороны', (_name, params) => {
    const sheet = createHeldOutSheet(params);
    const { source } = measureSheetPhoto(sheet.image, { kind: 'grid' });

    expect(source.marginLineSide).toBe(sheet.marginLineSide);
    expect(
      Math.abs((source.marginLineX || 0) - (sheet.innermostX || 0)) / sheet.params.step
    ).toBeLessThanOrEqual(TOLERANCE_STEPS);
  });
});
