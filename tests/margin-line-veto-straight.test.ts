import { detectRuling } from '@pages/Generator/lib/paper/detectRuling';
import { buildStripProfiles } from '@pages/Generator/lib/paper/sheetProfile';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { SyntheticMarginLineSheet } from './helpers/synthetic-sheet';
import {
  createSyntheticSheet,
  DRIFTING_MARGIN_LINE_SHEET,
} from './helpers/synthetic-sheet';

vi.mock('@pages/Generator/lib/paper/sheetProfile', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@pages/Generator/lib/paper/sheetProfile')>();

  return { ...actual, buildStripProfiles: vi.fn(actual.buildStripProfiles) };
});

/**
 * Клетка с прямой чертой слева: снос нулевой, и профиль во всю высоту берёт
 * черту сам — ровно тот путь, который вето обязано пропустить нетронутым.
 */
const STRAIGHT_LEFT_SHEET: SyntheticMarginLineSheet = {
  ...DRIFTING_MARGIN_LINE_SHEET,
  marginLineDrift: 0,
};

/**
 * Наклон листа с чертой справа в градусах.
 */
const STRAIGHT_RIGHT_ANGLE = 0.8;

/**
 * Та же клетка с прямой чертой справа под наклоном: вето меряет сторону
 * кандидата, и правая сторона проходит его тем же путём, что и левая.
 */
const STRAIGHT_RIGHT_TILTED_SHEET: SyntheticMarginLineSheet = {
  ...STRAIGHT_LEFT_SHEET,
  marginLineX: 490,
  angle: STRAIGHT_RIGHT_ANGLE,
};

/**
 * `marginLineX` прямой черты на базе прогона — до последнего знака, а не с
 * допуском: вето только отнимает кандидатов, и подтверждённая линия обязана
 * сохранить число первой ступени побитово. Допуск в пиксель пропустил бы
 * подмену числа второй ступенью или уточнением по другой мере.
 */
const STRAIGHT_LEFT_BASE_X = 110.00143215610929;

const STRAIGHT_RIGHT_TILTED_BASE_X = 489.958163685118;

/**
 * Сколько раз строились полосы опроса. Опознаются по числу полос на кадр: их
 * больше одной на шаг разлиновки, тогда как трассировочные идут по полтора
 * шага на полосу, а полосы области с линиями — восемь на кадр.
 *
 * @param height — высота кадра
 * @param step — шаг разлиновки
 * @returns число построений полос опроса
 */
const countPollBuilds = (height: number, step: number): number => {
  return vi.mocked(buildStripProfiles).mock.calls.filter(([, axis, , , stripCount]) => {
    return axis === 'vertical' && stripCount > height / step;
  }).length;
};

describe('вето первой ступени: ровный путь', () => {
  it('прямая черта слева сохраняет число и сторону базы до бита', () => {
    const detection = detectRuling(createSyntheticSheet(STRAIGHT_LEFT_SHEET), {
      skewAngle: 0,
    });

    expect(detection.marginLineReport.stage).toBe('profile');
    expect(detection.marginLineSide).toBe('left');
    expect(detection.marginLineX).toBe(STRAIGHT_LEFT_BASE_X);
  });

  it('прямая черта справа под наклоном сохраняет число и сторону базы до бита', () => {
    const detection = detectRuling(createSyntheticSheet(STRAIGHT_RIGHT_TILTED_SHEET), {
      skewAngle: STRAIGHT_RIGHT_ANGLE,
    });

    expect(detection.marginLineReport.stage).toBe('profile');
    expect(detection.marginLineSide).toBe('right');
    expect(detection.marginLineX).toBe(STRAIGHT_RIGHT_TILTED_BASE_X);
  });
});

/**
 * Лист и ступень, которая берёт его черту, когда сторона не снята.
 */
type GatedSheetCase = {
  /**
   * Подпись случая.
   */
  label: string;

  /**
   * Лист с чертой.
   */
  sheet: SyntheticMarginLineSheet;

  /**
   * Ступень, которая берёт черту без гейта.
   */
  stage: 'profile' | 'banded';
};

/**
 * По листу на ступень: гейт обязан держать обе разом, и лист, чью черту берёт
 * только одна из них, проверил бы только её.
 */
const GATED_SHEET_CASES: GatedSheetCase[] = [
  {
    label: 'прямая черта — первая ступень',
    sheet: STRAIGHT_LEFT_SHEET,
    stage: 'profile',
  },
  {
    label: 'снесённая черта — вторая ступень',
    sheet: DRIFTING_MARGIN_LINE_SHEET,
    stage: 'banded',
  },
];

describe('вето первой ступени: сторона снята', () => {
  beforeEach(() => {
    vi.mocked(buildStripProfiles).mockClear();
  });

  it.each(GATED_SHEET_CASES)('$label: без гейта черта находится', ({ sheet, stage }) => {
    const detection = detectRuling(createSyntheticSheet(sheet), { skewAngle: 0 });

    expect(detection.marginLineReport.stage).toBe(stage);
    expect(detection.marginLineSide).toBe('left');
  });

  /**
   * Снятая сторона не зовёт ни профиль, ни вето, ни полосовой опрос: полос
   * опроса не строится вовсе.
   */
  it.each(GATED_SHEET_CASES)(
    '$label: при marginLineSide: null линия не ищется ни одной ступенью',
    ({ sheet }) => {
      const detection = detectRuling(createSyntheticSheet(sheet), {
        skewAngle: 0,
        marginLineSide: null,
      });

      expect(detection.marginLineX).toBeNull();
      expect(detection.marginLineSide).toBeNull();
      expect(detection.marginLineReport.stage).toBe('none');
      expect(countPollBuilds(sheet.height, sheet.step)).toBe(0);
    }
  );
});
