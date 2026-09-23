import { detectRuling } from '@pages/Generator/lib/paper/detectRuling';
import { measureSheetPhoto } from '@pages/Generator/lib/paper/measureSheetPhoto';
import { describe, expect, it } from 'vitest';

import { CONVERGING_GRID_SHEET, createSyntheticSheet } from './helpers/synthetic-sheet';

describe('вето первой ступени: повторяемость', () => {
  /**
   * Полосы опроса строятся один раз на вето и вторую ступень и живут внутри
   * замера: утечка их между замерами отдала бы второму замеру чужие глубины.
   */
  it('два замера листа со схождением клетки совпадают до числа', () => {
    const first = detectRuling(createSyntheticSheet(CONVERGING_GRID_SHEET), {
      skewAngle: 0,
    });
    const second = detectRuling(createSyntheticSheet(CONVERGING_GRID_SHEET), {
      skewAngle: 0,
    });

    expect(second).toStrictEqual(first);
  });

  it('два полных измерения фотографии совпадают до числа', () => {
    const first = measureSheetPhoto(createSyntheticSheet(CONVERGING_GRID_SHEET), {
      kind: 'grid',
    });
    const second = measureSheetPhoto(createSyntheticSheet(CONVERGING_GRID_SHEET), {
      kind: 'grid',
    });

    expect(second).toStrictEqual(first);
  });
});
