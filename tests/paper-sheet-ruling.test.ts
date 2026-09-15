import type { RulingDetection } from '@pages/Generator/lib/paper';
import {
  buildSheetRuling,
  MARGIN_FALLBACK_STEPS,
  resolveFirstLine,
} from '@pages/Generator/lib/paper';
import { describe, expect, it } from 'vitest';

/**
 * Шаг и фаза не кратны друг другу и полуторам шагам: иначе фолбэк верхнего поля
 * совпал бы с линией и без округления.
 */
const STEP = 40;
const PHASE = 13;
const SKEW_ANGLE = -0.9;

/**
 * Допуск попадания базовой линии на линию разлиновки в долях шага — из
 * требования «Фолбэк не сбивает строки с линий».
 */
const DRIFT_TOLERANCE = 0.1;

const NO_MARGINS = { top: 0, right: 0, bottom: 0, left: 0 };

const buildDetection = (patch: Partial<RulingDetection> = {}): RulingDetection => {
  return {
    isDetected: true,
    step: STEP,
    firstLinePhase: PHASE,
    kind: 'lined',
    margins: NO_MARGINS,
    marginLineX: null,
    marginLineSide: null,
    bend: null,
    perspective: null,
    confidence: 0.9,
    ...patch,
  };
};

/**
 * Расстояние от точки до ближайшей линии разлиновки `PHASE + k * STEP` в долях
 * шага. Считается перебором линий, а не формулой первой линии, чтобы тест не
 * подтверждал формулу ею же.
 */
const measureLineDrift = (y: number): number => {
  let drift = Number.POSITIVE_INFINITY;

  for (let index = -2; index < 100; index += 1) {
    drift = Math.min(drift, Math.abs(y - (PHASE + index * STEP)));
  }

  return drift / STEP;
};

describe('сборка разлиновки экземпляра из результата детектора', () => {
  it('без найденных полей отступает полтора шага от каждого края', () => {
    const detection = buildDetection();
    const ruling = buildSheetRuling({ ...detection, skewAngle: SKEW_ANGLE });
    const fallback = STEP * MARGIN_FALLBACK_STEPS;

    expect(MARGIN_FALLBACK_STEPS).toBe(1.5);
    expect(ruling.margins.right).toBe(fallback);
    expect(ruling.margins.bottom).toBe(fallback);
    expect(ruling.margins.left).toBe(fallback);
    expect(ruling.marginLineX).toBeNull();
    expect(ruling.marginLineSide).toBeNull();
    expect(ruling.step).toBe(STEP);
    expect(ruling.firstLinePhase).toBe(PHASE);
    expect(ruling.skewAngle).toBe(SKEW_ANGLE);
  });

  it('верхнее поле фолбэка округляет вверх до ближайшей линии не выше полутора шагов', () => {
    const ruling = buildSheetRuling({ ...buildDetection(), skewAngle: 0 });
    const fallback = STEP * MARGIN_FALLBACK_STEPS;

    /**
     * Верхнее поле — первая линия, лежащая не выше полутора шагов от края: она
     * не выше фолбэка, а предыдущая линия — уже выше него.
     */
    expect(measureLineDrift(ruling.margins.top)).toBeLessThan(1e-9);
    expect(ruling.margins.top).toBeGreaterThanOrEqual(fallback);
    expect(ruling.margins.top - STEP).toBeLessThan(fallback);
  });

  it('найденные поля и линию поля со стороной берёт как есть', () => {
    const margins = { top: 133, right: 90, bottom: 150, left: 70 };
    const ruling = buildSheetRuling({
      ...buildDetection({ margins, marginLineX: 1400, marginLineSide: 'right' }),
      skewAngle: SKEW_ANGLE,
    });

    expect(ruling).toEqual({
      step: STEP,
      firstLinePhase: PHASE,
      skewAngle: SKEW_ANGLE,
      margins,
      marginLineX: 1400,
      marginLineSide: 'right',
      bend: null,
      perspective: null,
      outline: null,
    });
  });

  it('фолбэк применяет к каждой стороне отдельно: одна сторона найдена, остальные нули', () => {
    const ruling = buildSheetRuling({
      ...buildDetection({ margins: { ...NO_MARGINS, left: 210 } }),
      skewAngle: 0,
    });
    const fallback = STEP * MARGIN_FALLBACK_STEPS;

    expect(ruling.margins.left).toBe(210);
    expect(ruling.margins.right).toBe(fallback);
    expect(ruling.margins.bottom).toBe(fallback);
    expect(ruling.margins.top).toBeGreaterThanOrEqual(fallback);
    expect(measureLineDrift(ruling.margins.top)).toBeLessThan(1e-9);
  });

  it('при фолбэке первая строка садится на линию разлиновки', () => {
    const ruling = buildSheetRuling({ ...buildDetection(), skewAngle: 0 });
    const firstLine = resolveFirstLine(ruling);

    expect(measureLineDrift(firstLine)).toBeLessThanOrEqual(DRIFT_TOLERANCE);
    expect(firstLine).toBeGreaterThanOrEqual(ruling.margins.top);
  });

  it('линию поля без стороны считает отсутствующей', () => {
    const ruling = buildSheetRuling({
      ...buildDetection({ marginLineX: 300 }),
      skewAngle: 0,
    });

    expect(ruling.marginLineX).toBeNull();
    expect(ruling.marginLineSide).toBeNull();
  });

  it('собирает разлиновку из записи прежней формы: поля фолбэком', () => {
    const ruling = buildSheetRuling({
      step: 64,
      firstLinePhase: 73.5,
      skewAngle: -1.4,
    });

    expect(ruling.step).toBe(64);
    expect(ruling.firstLinePhase).toBe(73.5);
    expect(ruling.skewAngle).toBe(-1.4);
    expect(ruling.margins.left).toBe(96);
    expect(ruling.margins.top).toBe(137.5);
    expect(ruling.marginLineX).toBeNull();
  });

  it('повторная сборка готовой разлиновки её не меняет', () => {
    const ruling = buildSheetRuling({ ...buildDetection(), skewAngle: SKEW_ANGLE });

    expect(buildSheetRuling(ruling)).toEqual(ruling);
  });

  it('без найденного шага оставляет поля нулевыми и не даёт NaN', () => {
    const ruling = buildSheetRuling({
      ...buildDetection({ isDetected: false, step: 0, firstLinePhase: 0 }),
      skewAngle: 0,
    });

    expect(ruling.margins).toEqual(NO_MARGINS);
    expect(Number.isFinite(resolveFirstLine(ruling))).toBe(true);
  });
});

describe('первая линия разлиновки', () => {
  it('лежит не выше верхнего поля, даже если поле между линиями', () => {
    const ruling = buildSheetRuling({
      ...buildDetection({ margins: { top: 100, right: 60, bottom: 60, left: 60 } }),
      skewAngle: 0,
    });

    expect(resolveFirstLine(ruling)).toBe(133);
  });

  it('совпадает с полем, которое уже стоит на линии', () => {
    const ruling = buildSheetRuling({
      ...buildDetection({ margins: { top: 133, right: 60, bottom: 60, left: 60 } }),
      skewAngle: 0,
    });

    expect(resolveFirstLine(ruling)).toBe(133);
  });

  it('не перепрыгивает на следующую линию из-за погрешности вычислений', () => {
    const step = 53.7;
    const phase = 0.3;
    const ruling = buildSheetRuling({
      step,
      firstLinePhase: phase,
      skewAngle: 0,
      margins: { top: phase + 7 * step, right: 60, bottom: 60, left: 60 },
    });

    expect(resolveFirstLine(ruling)).toBeCloseTo(phase + 7 * step, 9);
  });
});
