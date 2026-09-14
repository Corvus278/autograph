import { detectRuling } from '@pages/Generator/lib/paper/detectRuling';
import { describe, expect, it } from 'vitest';

import {
  computeSyntheticColumnX,
  createSyntheticSheet,
  type SyntheticField,
  type SyntheticSheetParams,
} from './helpers/synthetic-sheet';

/**
 * Допуск на положение границы в пикселях.
 */
const PIXEL_TOLERANCE = 1;

const STEP = 28;

const WIDTH = 420;

const HEIGHT = 1200;

const REGION_TOP = 56;

const REGION_BOTTOM = HEIGHT - 56;

/**
 * Номера крайних вертикалей на гребёнке: столбцы 56 и 364.
 */
const FIRST_COLUMN = 2;

const LAST_COLUMN = 13;

/**
 * Амплитуда изгиба крайних вертикалей: три десятых шага — больше шестой доли
 * шага, на которую линия может уйти от прямой гребёнки в окне поиска.
 */
const BEND_AMPLITUDE = 0.3 * STEP;

/**
 * Изгиб только крайних вертикалей, внутрь сетки, сильнее всего в середине
 * высоты области: остальные вертикали прямые.
 */
const bendOuterColumns: SyntheticField = (x, y) => {
  const share = (2 * (y - REGION_TOP)) / (REGION_BOTTOM - REGION_TOP) - 1;
  const bulge = BEND_AMPLITUDE * (1 - share ** 2);

  if (Math.abs(x - FIRST_COLUMN * STEP) < 0.5) {
    return bulge;
  }

  return Math.abs(x - LAST_COLUMN * STEP) < 0.5 ? -bulge : 0;
};

/**
 * Клетка без линии поля: горизонтальные линии тянутся на шаг дальше крайних
 * вертикалей, поэтому боковую границу задают вертикали.
 */
const GRID_SHEET = {
  width: WIDTH,
  height: HEIGHT,
  step: STEP,
  phase: 0,
  kind: 'grid',
  margins: { top: REGION_TOP, right: STEP, bottom: HEIGHT - REGION_BOTTOM, left: STEP },
  columnMargins: { left: FIRST_COLUMN * STEP, right: WIDTH - LAST_COLUMN * STEP },
  columnBend: bendOuterColumns,
  noise: 0.04,
} satisfies SyntheticSheetParams;

describe('detectRuling: изогнутая граница сетки', () => {
  it('ставит боковые поля не ближе к краю кадра, чем самая внутренняя точка крайней вертикали плюс пятая часть шага', () => {
    const detection = detectRuling(createSyntheticSheet(GRID_SHEET), { skewAngle: 0 });
    const gap = STEP / 5;
    let innermostLeft = Number.NEGATIVE_INFINITY;
    let innermostRight = Number.POSITIVE_INFINITY;

    for (let y = REGION_TOP; y <= REGION_BOTTOM; y += 1) {
      innermostLeft = Math.max(
        innermostLeft,
        computeSyntheticColumnX(GRID_SHEET, FIRST_COLUMN, y)
      );
      innermostRight = Math.min(
        innermostRight,
        computeSyntheticColumnX(GRID_SHEET, LAST_COLUMN, y)
      );
    }

    const { left, right } = detection.margins;

    expect(detection.kind).toBe('grid');
    expect(left).toBeGreaterThanOrEqual(innermostLeft + gap - PIXEL_TOLERANCE);
    expect(left).toBeLessThanOrEqual(innermostLeft + gap + STEP / 6);
    expect(right).toBeGreaterThanOrEqual(WIDTH - innermostRight + gap - PIXEL_TOLERANCE);
    expect(right).toBeLessThanOrEqual(WIDTH - innermostRight + gap + STEP / 6);
  });
});
