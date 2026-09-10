import { detectSkewAngle } from '@pages/Generator/lib/paper/detectSkewAngle';
import { describe, expect, it } from 'vitest';

import { createSyntheticSheet } from './helpers/synthetic-sheet';

/**
 * Требование к точности из спецификации: наклон найден не хуже пятой доли
 * градуса — при таком промахе линия по всей ширине кадра уезжает меньше чем на
 * толщину самой линии.
 */
const ANGLE_TOLERANCE = 0.2;

const LINED_SHEET = {
  width: 420,
  height: 560,
  step: 23.5,
  phase: 0,
  margins: { top: 70.5, right: 36, bottom: 90, left: 60 },
};

describe('detectSkewAngle', () => {
  it('на ровном листе в линейку не находит наклона', () => {
    const angle = detectSkewAngle(createSyntheticSheet(LINED_SHEET));

    expect(Math.abs(angle)).toBeLessThanOrEqual(ANGLE_TOLERANCE);
  });

  it('находит известный наклон в линейку', () => {
    const angle = detectSkewAngle(createSyntheticSheet({ ...LINED_SHEET, angle: 1.3 }));

    expect(angle).toBeCloseTo(1.3, 1);
    expect(Math.abs(angle - 1.3)).toBeLessThanOrEqual(ANGLE_TOLERANCE);
  });

  it('находит наклон в другую сторону', () => {
    const angle = detectSkewAngle(createSyntheticSheet({ ...LINED_SHEET, angle: -0.8 }));

    expect(Math.abs(angle + 0.8)).toBeLessThanOrEqual(ANGLE_TOLERANCE);
  });

  it('находит наклон на клетке', () => {
    const angle = detectSkewAngle(
      createSyntheticSheet({
        width: 420,
        height: 560,
        step: 28,
        kind: 'grid',
        angle: 1.3,
        margins: { top: 56, right: 56, bottom: 56, left: 56 },
      })
    );

    expect(Math.abs(angle - 1.3)).toBeLessThanOrEqual(ANGLE_TOLERANCE);
  });

  it('не сбивается на зерне бумаги и неравномерном освещении', () => {
    const angle = detectSkewAngle(
      createSyntheticSheet({ ...LINED_SHEET, angle: 1.3, noise: 0.08, lighting: 0.3 })
    );

    expect(Math.abs(angle - 1.3)).toBeLessThanOrEqual(ANGLE_TOLERANCE);
  });

  it('находит тот же наклон на уменьшенной копии', () => {
    const image = createSyntheticSheet({
      width: 900,
      height: 1200,
      step: 48,
      phase: 0,
      angle: 1.3,
      margins: { top: 144, right: 72, bottom: 144, left: 96 },
      noise: 0.05,
    });
    const full = detectSkewAngle(image, { maxAnalysisSize: 0 });
    const reduced = detectSkewAngle(image, { maxAnalysisSize: 400 });

    expect(Math.abs(full - 1.3)).toBeLessThanOrEqual(ANGLE_TOLERANCE);
    expect(Math.abs(reduced - 1.3)).toBeLessThanOrEqual(ANGLE_TOLERANCE);
  });

  it('на листе без разлиновки остаётся внутри диапазона свипа', () => {
    const angle = detectSkewAngle(
      createSyntheticSheet({ ...LINED_SHEET, kind: 'blank', noise: 0.06, lighting: 0.3 })
    );

    expect(Math.abs(angle)).toBeLessThanOrEqual(2);
  });
});
