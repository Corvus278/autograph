import type { MarginLineSide, SheetImageData } from '@pages/Generator/lib/paper';
import {
  type BandedMarginLine,
  findBandedMarginLine,
  MARGIN_LINE_BAND_STEPS,
} from '@pages/Generator/lib/paper/detectRuling';
import { buildStripProfiles } from '@pages/Generator/lib/paper/sheetProfile';
import { describe, expect, it } from 'vitest';

import type { SyntheticCalibrationSheet } from './helpers/synthetic-sheet';
import {
  ABSENT_MARGIN_LINE_SHEET,
  createSyntheticSheet,
} from './helpers/synthetic-sheet';

/**
 * Лист в линейку без черты: вертикалей у него нет, и каждая вертикаль теста —
 * своя, с заданной глубиной и высотой.
 */
const LINED_SHEET: SyntheticCalibrationSheet = {
  ...ABSENT_MARGIN_LINE_SHEET,
  kind: 'lined',
};

/**
 * Вертикаль, дорисованная поверх листа.
 */
type PaintedColumn = {
  /**
   * Левый столбец вертикали; ширина — два столбца.
   */
  x: number;

  /**
   * Верх вертикали — доля высоты кадра.
   */
  top: number;

  /**
   * Низ вертикали — доля высоты кадра.
   */
  bottom: number;

  /**
   * Доля яркости бумаги, которую вертикаль отнимает.
   */
  darkness: number;
};

/**
 * Вертикали средней трети — соседи, по которым меряется барьер. Стоят только
 * в верхних 40 % кадра: у стороны, чья самая глубокая полоса наверху, соседи
 * есть, у стороны, чья самая глубокая полоса внизу, их нет вовсе.
 */
const UPPER_PEERS: PaintedColumn[] = [
  { x: 260, top: 0, bottom: 0.4, darkness: 0.4 },
  { x: 300, top: 0, bottom: 0.4, darkness: 0.4 },
];

/**
 * Те же соседи во всю высоту: барьер по ним одинаков у обеих сторон.
 */
const FULL_PEERS: PaintedColumn[] = [
  { x: 260, top: 0, bottom: 1, darkness: 0.4 },
  { x: 300, top: 0, bottom: 1, darkness: 0.4 },
];

/**
 * Кандидат слева — глубже правого, но темнее всего наверху, где рядом
 * соседи: его самая глубокая полоса попадает к ним, и барьер в полтора
 * соседа он не берёт.
 */
const DEEP_LEFT: PaintedColumn[] = [
  { x: 100, top: 0, bottom: 0.5, darkness: 0.5 },
  { x: 100, top: 0.5, bottom: 1, darkness: 0.45 },
];

/**
 * Кандидат справа — мельче левого, но темнее всего внизу, где соседей нет:
 * барьер у него — этаж, и он его берёт.
 */
const SHALLOW_RIGHT: PaintedColumn[] = [
  { x: 500, top: 0, bottom: 0.75, darkness: 0.25 },
  { x: 500, top: 0.75, bottom: 1, darkness: 0.3 },
];

/**
 * Рисует вертикали поверх листа.
 *
 * @param columns — вертикали
 * @returns растр листа с вертикалями
 */
const paintColumns = (columns: PaintedColumn[]): SheetImageData => {
  const { height, width } = LINED_SHEET;
  const image = createSyntheticSheet(LINED_SHEET);
  const luminance = Float32Array.from(image.luminance);

  for (const { x, top, bottom, darkness } of columns) {
    const to = Math.round(bottom * height);

    for (let y = Math.round(top * height); y < to; y += 1) {
      for (let column = x; column < x + 2; column += 1) {
        const index = y * width + column;

        luminance[index] = (luminance[index] || 0) * (1 - darkness);
      }
    }
  }

  return { ...image, luminance };
};

/**
 * Опрашивает лист полосовой ступенью так же, как её зовёт замер: полосы
 * строятся по всему кадру.
 *
 * @param image — растр листа
 * @param side — край, которым ограничен поиск; не задан — оба
 * @returns кандидат и числа, по которым он принят или отвергнут
 */
const pollSheet = (image: SheetImageData, side?: MarginLineSide): BandedMarginLine => {
  const { height, step, width } = LINED_SHEET;
  const strips = buildStripProfiles(
    image,
    'vertical',
    0,
    0,
    Math.round(height / (MARGIN_LINE_BAND_STEPS * step))
  );

  return findBandedMarginLine(strips, step, width, side);
};

describe('findBandedMarginLine: сторона выбирается среди взявших барьер', () => {
  it('отдаёт мелкого кандидата над барьером, а не глубокого под своим', () => {
    const image = paintColumns([...UPPER_PEERS, ...DEEP_LEFT, ...SHALLOW_RIGHT]);
    const left = pollSheet(image, 'left');
    const right = pollSheet(image, 'right');
    const chosen = pollSheet(image);

    /**
     * Предпосылки случая: левый глубже, но барьер не взял, правый — наоборот.
     */
    expect(left.depth).toBeGreaterThan(right.depth);
    expect(left.line).toBeNull();
    expect(right.line).not.toBeNull();

    expect(chosen.line).toStrictEqual(right.line);
    expect(chosen.line?.side).toBe('right');
  });

  it('не отдаёт линии, когда барьер не взял ни один', () => {
    const image = paintColumns([...FULL_PEERS, ...DEEP_LEFT, ...SHALLOW_RIGHT]);

    expect(pollSheet(image, 'left').line).toBeNull();
    expect(pollSheet(image, 'right').line).toBeNull();
    expect(pollSheet(image).line).toBeNull();
  });
});
