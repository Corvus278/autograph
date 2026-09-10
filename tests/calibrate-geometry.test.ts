import type { CalibrationRuling } from '@pages/Generator/lib/calibrate';
import { deriveGeometry, GRID_ROW_STEPS } from '@pages/Generator/lib/calibrate';
import type { FontMetrics } from '@pages/Generator/lib/measure/measure.types';
import { describe, expect, it } from 'vitest';

import { getBaselineY, getLineStep } from './helpers/baseline-model';

const LINED: CalibrationRuling = {
  kind: 'lined',
  step: 40,
  firstLineOffset: 80,
  margins: { top: 80, right: 40, bottom: 60, left: 60 },
  marginLineX: 60,
  pageWidth: 1600,
};

const GRID: CalibrationRuling = {
  kind: 'grid',
  step: 25,
  firstLineOffset: 75,
  margins: { top: 75, right: 50, bottom: 50, left: 50 },
  marginLineX: null,
  pageWidth: 1500,
};

const BLANK: CalibrationRuling = {
  kind: 'blank',
  step: 48,
  firstLineOffset: 96,
  margins: { top: 96, right: 60, bottom: 60, left: 70 },
  marginLineX: null,
  pageWidth: 1400,
};

/**
 * Метрики рукописного шрифта: подъём строчного бокса заметно выше подъёма
 * чернил и высоты строчных. Расхождение намеренное — на нём видно, если
 * верхний отступ посчитан не от бокса.
 */
const METRICS: FontMetrics = { xHeight: 0.48, fontAscent: 0.95, lineHeight: 1.25 };

/**
 * Допустимое отклонение базовой линии от линии разлиновки — десятая доля
 * шага, как в требовании.
 */
const DRIFT_SHARE = 0.1;

/**
 * Отступ линии разлиновки, на которую должна лечь строка с этим номером.
 *
 * @param ruling — разлиновка семьи
 * @param lineIndex — номер строки от нуля
 * @param rowSteps — сколько шагов разлиновки занимает строка
 * @returns отступ линии от верха листа в пикселях
 */
const getRulingLineY = (
  ruling: CalibrationRuling,
  lineIndex: number,
  rowSteps: number
): number => {
  return ruling.firstLineOffset + lineIndex * ruling.step * rowSteps;
};

/**
 * Наибольшее отклонение базовых линий от разлиновки на первых строках.
 *
 * @param ruling — разлиновка семьи
 * @param metrics — метрики шрифта
 * @param rowSteps — сколько шагов разлиновки занимает строка
 * @returns отклонение в пикселях
 */
const getMaxDrift = (
  ruling: CalibrationRuling,
  metrics: FontMetrics,
  rowSteps: number
): number => {
  const geometry = deriveGeometry(ruling, metrics);
  let maxDrift = 0;

  for (let lineIndex = 0; lineIndex < 8; lineIndex += 1) {
    const drift = Math.abs(
      getBaselineY(geometry, metrics, lineIndex) -
        getRulingLineY(ruling, lineIndex, rowSteps)
    );

    maxDrift = Math.max(maxDrift, drift);
  }

  return maxDrift;
};

describe('deriveGeometry', () => {
  it('сажает базовые линии на разлиновку', () => {
    expect(getMaxDrift(LINED, METRICS, 1)).toBeLessThanOrEqual(DRIFT_SHARE * LINED.step);
  });

  it('на других метриках шрифта меняет кегль, сохраняя попадание', () => {
    const narrow: FontMetrics = { xHeight: 0.35, fontAscent: 1.08, lineHeight: 1.45 };
    const base = deriveGeometry(LINED, METRICS);
    const other = deriveGeometry(LINED, narrow);

    expect(other.fontSizePx).not.toBeCloseTo(base.fontSizePx, 3);
    expect(getMaxDrift(LINED, narrow, 1)).toBeLessThanOrEqual(DRIFT_SHARE * LINED.step);
  });

  it('верхний отступ отсчитан от подъёма бокса, а не от чернил', () => {
    const geometry = deriveGeometry(LINED, METRICS);

    expect(geometry.topOffset).toBeCloseTo(
      LINED.firstLineOffset - METRICS.fontAscent * geometry.fontSizePx,
      10
    );
  });

  it('высота строчных занимает принятую долю шага разлиновки', () => {
    const geometry = deriveGeometry(LINED, METRICS);
    const xHeightPx = geometry.fontSizePx * METRICS.xHeight;

    expect(xHeightPx).toBeGreaterThan(0.4 * LINED.step);
    expect(xHeightPx).toBeLessThan(0.7 * LINED.step);
  });

  it('на листе в клетку строка занимает две клетки', () => {
    const geometry = deriveGeometry(GRID, METRICS);

    expect(getLineStep(geometry, METRICS)).toBeCloseTo(GRID_ROW_STEPS * GRID.step, 10);
    expect(getMaxDrift(GRID, METRICS, GRID_ROW_STEPS)).toBeLessThanOrEqual(
      DRIFT_SHARE * GRID.step
    );
  });

  it('на чистом листе строка занимает заданный пользователем шаг', () => {
    const geometry = deriveGeometry(BLANK, METRICS);

    expect(getLineStep(geometry, METRICS)).toBeCloseTo(BLANK.step, 10);
    expect(getMaxDrift(BLANK, METRICS, 1)).toBeLessThanOrEqual(DRIFT_SHARE * BLANK.step);
  });

  it('без шага разлиновки отдаёт рабочую геометрию, а не ноль', () => {
    const geometry = deriveGeometry({ ...BLANK, step: 0 }, METRICS);

    expect(geometry.fontSizePx).toBeGreaterThan(0);
    expect(Number.isFinite(getLineStep(geometry, METRICS))).toBe(true);
    expect(getLineStep(geometry, METRICS)).toBeGreaterThan(0);
  });

  it('смена семьи пересчитывает геометрию', () => {
    const lined = deriveGeometry(LINED, METRICS);
    const grid = deriveGeometry(GRID, METRICS);

    expect(grid.fontSizePx).not.toBeCloseTo(lined.fontSizePx, 3);
    expect(grid.lineSpacing).not.toBeCloseTo(lined.lineSpacing, 3);
    expect(grid.topOffset).not.toBeCloseTo(lined.topOffset, 3);
    expect(grid.leftPadding).not.toBeCloseTo(lined.leftPadding, 3);
    expect(grid.blockWidth).not.toBeCloseTo(lined.blockWidth, 3);
  });

  it('отсчитывает левый отступ от линии поля', () => {
    const geometry = deriveGeometry(LINED, METRICS);

    expect(geometry.leftPadding).toBeGreaterThanOrEqual(LINED.marginLineX || 0);
    expect(geometry.leftPadding).toBeLessThan((LINED.marginLineX || 0) + LINED.step);
  });

  it('без линии поля отсчитывает левый отступ от поля листа', () => {
    const lined = deriveGeometry({ ...LINED, marginLineX: null }, METRICS);
    const grid = deriveGeometry(GRID, METRICS);

    expect(lined.leftPadding).toBe(LINED.margins.left);
    expect(grid.leftPadding).toBe(GRID.margins.left);
  });

  it('доводит ширину блока до правого поля', () => {
    const geometry = deriveGeometry(LINED, METRICS);

    expect(geometry.leftPadding + geometry.blockWidth).toBeCloseTo(
      LINED.pageWidth - LINED.margins.right,
      10
    );
  });

  it('применяет поправку поверх вычисленного', () => {
    const base = deriveGeometry(LINED, METRICS);
    const corrected = deriveGeometry(LINED, METRICS, {
      fontSizePx: 4,
      lineSpacing: 3,
      topOffset: -7,
      leftPadding: 12,
      blockWidth: -40,
    });

    expect(corrected.fontSizePx).toBeCloseTo(base.fontSizePx + 4, 10);
    expect(corrected.lineSpacing).toBeCloseTo(base.lineSpacing + 3, 10);
    expect(corrected.topOffset).toBeCloseTo(base.topOffset - 7, 10);
    expect(corrected.leftPadding).toBeCloseTo(base.leftPadding + 12, 10);
    expect(corrected.blockWidth).toBeCloseTo(base.blockWidth - 40, 10);
  });

  it('пустая поправка ничего не меняет', () => {
    expect(deriveGeometry(LINED, METRICS, {})).toEqual(deriveGeometry(LINED, METRICS));
  });

  it('поправка переживает смену разлиновки: применяется к новому расчёту', () => {
    const grid = deriveGeometry(GRID, METRICS, { topOffset: 9 });
    const gridBase = deriveGeometry(GRID, METRICS);

    expect(grid.topOffset).toBeCloseTo(gridBase.topOffset + 9, 10);
  });

  it('поправка не уводит кегль в ноль и в минус', () => {
    const base = deriveGeometry(LINED, METRICS);
    const zeroed = deriveGeometry(LINED, METRICS, { fontSizePx: -base.fontSizePx });
    const negative = deriveGeometry(LINED, METRICS, {
      fontSizePx: -10 * base.fontSizePx,
    });

    expect(zeroed.fontSizePx).toBeGreaterThan(0);
    expect(negative.fontSizePx).toBeGreaterThan(0);
  });

  it('поправка не уводит ширину блока в минус', () => {
    const geometry = deriveGeometry(LINED, METRICS, { blockWidth: -100_000 });

    expect(geometry.blockWidth).toBe(0);
  });

  it('на нулевой высоте строчных не отдаёт мусор', () => {
    const broken: FontMetrics = { xHeight: 0, fontAscent: 0.95, lineHeight: 1.25 };
    const geometry = deriveGeometry(LINED, broken);

    expect(Number.isFinite(geometry.fontSizePx)).toBe(true);
    expect(geometry.fontSizePx).toBeGreaterThan(0);
  });
});
