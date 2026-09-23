import { detectRuling } from '@pages/Generator/lib/paper/detectRuling';
import {
  detectRulingBend,
  type RulingBendRegion,
} from '@pages/Generator/lib/paper/detectRulingBend';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CONVERGING_GRID_SHEET, createSyntheticSheet } from './helpers/synthetic-sheet';

vi.mock('@pages/Generator/lib/paper/detectRulingBend', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@pages/Generator/lib/paper/detectRulingBend')>();

  return { ...actual, detectRulingBend: vi.fn(actual.detectRulingBend) };
});

/**
 * Область, в которой измерение искало изгиб при последнем вызове.
 *
 * @returns горизонтальная область сетки изгиба
 */
const readBendRegion = (): RulingBendRegion => {
  const region = vi.mocked(detectRulingBend).mock.lastCall?.[2];

  if (!region) {
    throw new Error('Изгиб не измерялся');
  }

  return region;
};

describe('вето первой ступени: сетка изгиба', () => {
  beforeEach(() => {
    vi.mocked(detectRulingBend).mockClear();
  });

  /**
   * Лист снят без наклона, поэтому граница области со стороны линии поля
   * совпадает с её `x`, а без линии — доходит до края линий, то есть не ближе
   * к середине, чем поле листа. Вертикаль клетки у правой стороны, которую
   * вето снимает, сетку больше не обрезает.
   */
  it('граница сетки идёт по записанной линии поля, а без неё — по полю листа', () => {
    const { width } = CONVERGING_GRID_SHEET;
    const detection = detectRuling(createSyntheticSheet(CONVERGING_GRID_SHEET), {
      skewAngle: 0,
    });
    const region = readBendRegion();
    const { marginLineSide, marginLineX, margins } = detection;

    expect(marginLineSide).not.toBe('right');
    expect(region.right).toBeGreaterThanOrEqual(width - margins.right);

    if (marginLineSide === 'left') {
      expect(region.left).toBeGreaterThanOrEqual(marginLineX || 0);
    } else {
      expect(region.left).toBeLessThanOrEqual(margins.left);
    }
  });
});
