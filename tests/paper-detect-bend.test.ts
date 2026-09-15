import type { RulingBend } from '@pages/Generator/lib/paper';
import {
  detectRulingBend,
  type RulingBendRegion,
} from '@pages/Generator/lib/paper/detectRulingBend';
import { sampleRulingBend } from '@pages/Generator/lib/paper/sampleRulingBend';
import { describe, expect, it } from 'vitest';

import {
  computeSyntheticLineY,
  createSyntheticSheet,
  type SyntheticField,
  type SyntheticSheetParams,
} from './helpers/synthetic-sheet';

const STEP = 24;

const WIDTH = 720;

const HEIGHT = 960;

/**
 * Допуск попадания по спеке: двадцатая часть шага.
 */
const LINE_TOLERANCE = STEP / 20;

/**
 * Изогнутый лист в линейку во весь кадр по ширине: линии от края до края,
 * сверху и снизу — чистое поле в три шага, чтобы наклонные крайние линии не
 * уходили из кадра.
 */
const BASE_SHEET = {
  width: WIDTH,
  height: HEIGHT,
  step: STEP,
  phase: 10,
  margins: { top: 72, right: 0, bottom: 72, left: 0 },
  noise: 0.04,
  seed: 7,
} satisfies SyntheticSheetParams;

const FULL_REGION: RulingBendRegion = { left: 0, right: WIDTH };

/**
 * Область наклонного листа. Концы линий на нём идут наклоном, и у края кадра
 * нижние линии кончаются раньше: область — там, где линии нарисованы на всех
 * строках, как её и отдаёт поиск концов линий.
 */
const TILT_REGION: RulingBendRegion = { left: 24, right: WIDTH - 24 };

const DEGREES_TO_RADIANS = Math.PI / 180;

const toFrameShare = (value: number, size: number): number => {
  return (2 * value) / size - 1;
};

/**
 * Перспектива: концы линий у углов кадра расходятся с прямой на три десятых
 * шага в разные стороны.
 */
const PERSPECTIVE: SyntheticField = (x, y) => {
  return 0.3 * STEP * toFrameShare(x, WIDTH) * toFrameShare(y, HEIGHT);
};

/**
 * Прогиб по ширине: середина линии ниже концов на три десятых шага.
 */
const SAG: SyntheticField = (x) => {
  return 0.3 * STEP * (1 - toFrameShare(x, WIDTH) ** 2);
};

const WAVE_LENGTH = 9 * STEP;

/**
 * Местная волна бумаги: амплитуда десятая шага, длина девять шагов, к краям
 * кадра гаснет.
 */
const LOCAL_WAVE: SyntheticField = (x) => {
  const envelope = Math.exp(-0.5 * ((x - WIDTH / 2) / WAVE_LENGTH) ** 2);

  return 0.1 * STEP * envelope * Math.sin((2 * Math.PI * (x - WIDTH / 2)) / WAVE_LENGTH);
};

/**
 * Центральная полоса из пятнадцати, на которые режется область во весь кадр.
 */
const CENTRAL_STRIP = { left: 336, right: 383 };

/**
 * Номер линии гребёнки, на которой лежит строка узлов.
 */
const toLineIndex = (
  params: SyntheticSheetParams,
  bend: RulingBend,
  row: number
): number => {
  const { step = STEP, phase = 0 } = params;

  return Math.round((bend.rowOrigin - phase) / step) + row;
};

/**
 * Наибольшее расхождение восстановленных по сетке линий с эталоном: по
 * каждому пикселю области, между узлами и в полуполосах у её краёв.
 */
const measureRestoreError = (
  params: SyntheticSheetParams,
  region: RulingBendRegion,
  bend: RulingBend
): number => {
  const { step = STEP, phase = 0, angle = 0 } = params;
  const tangent = Math.tan(angle * DEGREES_TO_RADIANS);
  const projection = { skewAngle: angle, perspective: null };
  let maxError = 0;

  for (let row = 0; row < bend.rowCount; row += 1) {
    const index = toLineIndex(params, bend, row);

    for (let x = Math.ceil(region.left); x < Math.floor(region.right); x += 1) {
      const straightY = phase + index * step + x * tangent;
      const restored = straightY + sampleRulingBend(bend, projection, x, straightY);
      const error = Math.abs(restored - computeSyntheticLineY(params, index, x));

      maxError = Math.max(maxError, error);
    }
  }

  return maxError;
};

/**
 * Число линий, нарисованных внутри полей листа.
 */
const countDrawnLines = (params: typeof BASE_SHEET): number => {
  const { step, phase, margins, height } = params;
  const first = Math.ceil((margins.top - phase) / step);
  const last = Math.floor((height - margins.bottom - phase) / step);

  return last - first + 1;
};

const detect = (
  params: typeof BASE_SHEET & SyntheticSheetParams,
  region: RulingBendRegion
) => {
  const { step, phase, angle = 0, margins } = params;

  return detectRulingBend(
    createSyntheticSheet(params),
    { step, firstLinePhase: phase, skewAngle: angle, margins },
    region
  );
};

type BendCase = {
  /**
   * Что изогнуто на листе.
   */
  name: string;

  /**
   * Описание листа.
   */
  params: typeof BASE_SHEET & SyntheticSheetParams;

  /**
   * Горизонтальная область с линиями.
   */
  region: RulingBendRegion;
};

const BEND_CASES: BendCase[] = [
  {
    name: 'перспектива',
    params: { ...BASE_SHEET, bend: PERSPECTIVE },
    region: FULL_REGION,
  },
  { name: 'прогиб по ширине', params: { ...BASE_SHEET, bend: SAG }, region: FULL_REGION },
  {
    name: 'местная волна',
    params: { ...BASE_SHEET, bend: LOCAL_WAVE },
    region: FULL_REGION,
  },
  {
    name: 'прогиб на листе с наклоном +1,5°',
    params: { ...BASE_SHEET, bend: SAG, angle: 1.5 },
    region: TILT_REGION,
  },
  {
    name: 'прогиб на листе с наклоном −1,5°',
    params: { ...BASE_SHEET, bend: SAG, angle: -1.5 },
    region: TILT_REGION,
  },
  {
    name: 'перспектива на листе с наклоном −1,5°',
    params: { ...BASE_SHEET, bend: PERSPECTIVE, angle: -1.5 },
    region: TILT_REGION,
  },
  {
    name: 'прогиб на шумном листе',
    params: { ...BASE_SHEET, bend: SAG, noise: 0.25 },
    region: FULL_REGION,
  },
  {
    name: 'прогиб с пятном на линиях центральной полосы',
    params: {
      ...BASE_SHEET,
      bend: SAG,
      lowContrastArea: { ...CENTRAL_STRIP, top: 0, bottom: HEIGHT, contrast: 0 },
    },
    region: FULL_REGION,
  },
  {
    name: 'перспектива на листе, где линии кончаются внутри кадра',
    params: {
      ...BASE_SHEET,
      bend: PERSPECTIVE,
      margins: { top: 72, right: 60, bottom: 72, left: 60 },
    },
    region: { left: 60, right: WIDTH - 60 },
  },
];

describe('detectRulingBend', () => {
  it.each(BEND_CASES)(
    '$name: линии восстанавливаются с точностью до двадцатой шага',
    ({ params, region }) => {
      const { bend } = detect(params, region);

      expect(bend).not.toBeNull();

      if (bend === null) {
        return;
      }

      expect(bend.rowCount).toBe(countDrawnLines(params));
      expect(measureRestoreError(params, region, bend)).toBeLessThanOrEqual(
        LINE_TOLERANCE
      );
    }
  );

  it.each(BEND_CASES)('$name: смещения кратны сотой пикселя', ({ params, region }) => {
    const { bend } = detect(params, region);
    const offsets = bend?.offsets || [];

    expect(offsets.length).toBeGreaterThan(0);

    const hasUnroundedOffset = offsets.some((offset) => {
      return Math.abs(offset * 100 - Math.round(offset * 100)) > 1e-9;
    });

    expect(hasUnroundedOffset).toBe(false);
  });

  it('узлы стоят в центрах равных полос области, за областью узлов нет', () => {
    const region = { left: 60, right: WIDTH - 60 };
    const { bend } = detect(
      {
        ...BASE_SHEET,
        bend: PERSPECTIVE,
        margins: { top: 72, right: 60, bottom: 72, left: 60 },
      },
      region
    );
    const width = region.right - region.left;
    const columnCount = Math.max(8, Math.round(width / (2 * STEP)));

    expect(bend?.columnCount).toBe(columnCount);
    expect(bend?.columnSpacing).toBeCloseTo(width / columnCount, 9);
    expect(bend?.columnOrigin).toBeCloseTo(
      region.left - 0.5 + width / columnCount / 2,
      9
    );
    expect(bend?.rowSpacing).toBe(STEP);
  });

  it('пятно на центральной полосе не мешает найти остальные узлы', () => {
    const { foundNodeShare } = detect(
      {
        ...BASE_SHEET,
        bend: SAG,
        lowContrastArea: { ...CENTRAL_STRIP, top: 0, bottom: HEIGHT, contrast: 0 },
      },
      FULL_REGION
    );

    expect(foundNodeShare).toBeCloseTo(14 / 15, 2);
  });
});
