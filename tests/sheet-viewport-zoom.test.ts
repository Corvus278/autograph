import {
  computeDetailRasterScale,
  computeFitZoom,
  computeMainRasterScale,
  stepZoom,
  ZOOM_LADDER,
  ZOOM_MAX,
  ZOOM_MIN,
} from '@pages/Generator/ui/Generator/SheetViewport/zoomScale';
import { describe, expect, it } from 'vitest';

describe('лестница масштаба', () => {
  it('идёт от 10 до 400 % по возрастанию', () => {
    expect(ZOOM_LADDER[0]).toBe(ZOOM_MIN);
    expect(ZOOM_LADDER.at(-1)).toBe(ZOOM_MAX);
    expect(ZOOM_MIN).toBe(0.1);
    expect(ZOOM_MAX).toBe(4);

    ZOOM_LADDER.slice(1).forEach((step, index) => {
      expect(step).toBeGreaterThan(ZOOM_LADDER[index] || 0);
    });
  });

  it('геометрическая: соседние ступени выше 100 % отличаются в √2 с точностью до процента', () => {
    expect(ZOOM_LADDER).toContain(1);
    expect(ZOOM_LADDER).toContain(2);

    const oneIndex = ZOOM_LADDER.indexOf(1);

    expect(ZOOM_LADDER[oneIndex + 1]).toBeCloseTo(Math.SQRT2, 2);
    expect(ZOOM_LADDER[oneIndex - 1]).toBeCloseTo(Math.SQRT1_2, 2);
  });

  it('шаг вверх берёт ближайшую ступень строго выше текущего масштаба', () => {
    expect(stepZoom(1, 1)).toBeCloseTo(Math.SQRT2, 2);
    expect(stepZoom(0.3, 1)).toBeCloseTo(0.35, 5);
    expect(stepZoom(0.3, -1)).toBeCloseTo(0.25, 5);
    expect(stepZoom(1, -1)).toBeCloseTo(0.71, 5);
  });

  it('на краях лестницы остаётся на краю', () => {
    expect(stepZoom(ZOOM_MAX, 1)).toBe(ZOOM_MAX);
    expect(stepZoom(ZOOM_MIN, -1)).toBe(ZOOM_MIN);
    expect(stepZoom(10, 1)).toBe(ZOOM_MAX);
    expect(stepZoom(0.01, -1)).toBe(ZOOM_MIN);
  });
});

describe('вписывание', () => {
  it('вписывает кадр в область за вычетом отступов по узкой стороне', () => {
    /**
     * Ширина даёт (1000 − 48) / 2000 = 0,476, высота — (848 − 48) / 4000 =
     * 0,2: лист упирается в высоту.
     */
    expect(
      computeFitZoom({
        viewportWidth: 1000,
        viewportHeight: 848,
        pageWidth: 2000,
        pageHeight: 4000,
        padding: 24,
      })
    ).toBeCloseTo(0.2, 10);
  });

  it('не выходит за лестницу, даже когда области нет', () => {
    expect(
      computeFitZoom({
        viewportWidth: 0,
        viewportHeight: 0,
        pageWidth: 2000,
        pageHeight: 3000,
        padding: 24,
      })
    ).toBe(ZOOM_MIN);
    expect(
      computeFitZoom({
        viewportWidth: 5000,
        viewportHeight: 5000,
        pageWidth: 100,
        pageHeight: 100,
        padding: 0,
      })
    ).toBe(ZOOM_MAX);
  });
});

describe('разрешение растров', () => {
  it('основной растр — min(zoom, fitZoom) × DPR', () => {
    expect(computeMainRasterScale(0.5, 0.2, 2)).toBeCloseTo(0.4, 10);
    expect(computeMainRasterScale(0.1, 0.2, 2)).toBeCloseTo(0.2, 10);
  });

  it('детальный растр заказывается в min(zoom × DPR, 1), только если он плотнее основного', () => {
    expect(computeDetailRasterScale(0.5, 0.2, 1)).toBeCloseTo(0.5, 10);
    expect(computeDetailRasterScale(2, 0.2, 1)).toBe(1);
    expect(computeDetailRasterScale(0.2, 0.2, 2)).toBeNull();
    expect(computeDetailRasterScale(0.1, 0.2, 1)).toBeNull();
  });

  it('детальный растр не нужен, когда основной уже в пикселях кадра', () => {
    expect(computeDetailRasterScale(4, 0.6, 2)).toBeNull();
  });
});
