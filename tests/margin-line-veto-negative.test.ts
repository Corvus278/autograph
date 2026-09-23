import { detectRuling } from '@pages/Generator/lib/paper/detectRuling';
import { describe, expect, it } from 'vitest';

import type { SyntheticSheetParams } from './helpers/synthetic-sheet';
import {
  ABSENT_MARGIN_LINE_SHEET,
  CONVERGING_GRID_SHEET,
  createSyntheticSheet,
} from './helpers/synthetic-sheet';

/**
 * Лист без черты поля, на котором ни одна ступень не вправе завести линию.
 */
type NegativeSheetCase = {
  /**
   * Подпись случая.
   */
  label: string;

  /**
   * Параметры листа.
   */
  sheet: SyntheticSheetParams;
};

/**
 * Отрицательный класс держат яркостные меры: у листов нет канала `R − G`, и
 * вето по цвету на них молчит. Каждый лист ловит свою ловушку:
 *
 * - клетка без черты — соседи барьера по той же клетке;
 * - клетка со схождением без черты — резкая вертикаль у границы трети, которую
 *   профиль во всю высоту берёт за черту, а вдоль линии она не глубже соседей.
 */
const NEGATIVE_SHEET_CASES: NegativeSheetCase[] = [
  { label: 'клетка без черты', sheet: ABSENT_MARGIN_LINE_SHEET },
  {
    label: 'клетка со схождением без черты',
    sheet: { ...CONVERGING_GRID_SHEET, marginLineX: null },
  },
];

describe('вето первой ступени: листы без черты', () => {
  it.each(NEGATIVE_SHEET_CASES)('$label — линии поля нет', ({ sheet }) => {
    const detection = detectRuling(createSyntheticSheet(sheet), { skewAngle: 0 });

    expect(detection.marginLineX).toBeNull();
    expect(detection.marginLineSide).toBeNull();
  });
});
