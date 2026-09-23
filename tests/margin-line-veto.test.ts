import { detectRuling } from '@pages/Generator/lib/paper/detectRuling';
import { measureSheetPhoto } from '@pages/Generator/lib/paper/measureSheetPhoto';
import { describe, expect, it } from 'vitest';

import type {
  SyntheticMarginLineSheet,
  SyntheticRulingPerspective,
} from './helpers/synthetic-sheet';
import {
  computeSyntheticMarginLineX,
  createSyntheticSheet,
  DRIFTING_MARGIN_LINE_SHEET,
} from './helpers/synthetic-sheet';

/**
 * Допуск положения линии поля — пятая часть шага, как в требовании.
 */
const MARGIN_LINE_TOLERANCE_STEPS = 0.2;

const DEGREES_IN_RADIAN = 180 / Math.PI;

/**
 * Прямая вертикаль у левого края кадра — картина копии `IMG_1803`: тень у
 * угла листа ближе полуокна фона к краю профиля (там 28 бинов при полуокне
 * 62). Здесь полуокно — полшага, 20 px, а вертикаль стоит в 8 px от края.
 *
 * Черта листа со сносом профилем во всю высоту размыта, а прямая вертикаль той
 * же глубины — нет, поэтому первая ступень берёт её. Сторону же полосовая мера
 * подтверждает: у левого края есть настоящая черта. Отличить кандидата от неё
 * может только правило края полосы.
 */
const EDGE_SHADOW_SHEET: SyntheticMarginLineSheet = {
  ...DRIFTING_MARGIN_LINE_SHEET,
  strayColumn: { x: 8, darkness: 0.7 },
};

/**
 * Изменение шага по высоте, при котором шаг у нижней линии области больше,
 * чем у верхней, на долю `drift`: местный шаг меняется как `1/(1 − a·q)²`.
 *
 * @param drift — во сколько раз шаг у нижней линии больше, чем у верхней, минус 1
 * @param ruledHeight — высота области с линиями
 * @returns коэффициент `convergenceY` модели
 */
const toConvergenceY = (drift: number, ruledHeight: number): number => {
  const ratio = Math.sqrt(1 + drift);

  return (2 * (ratio - 1)) / (ruledHeight * (ratio + 1));
};

const EDGE_SHADOW_RULED_HEIGHT =
  EDGE_SHADOW_SHEET.height -
  EDGE_SHADOW_SHEET.margins.top -
  EDGE_SHADOW_SHEET.margins.bottom;

/**
 * Схождение на полградуса и дрейф шага 4 % по высоте области — перспектива,
 * которую измерение находит и ради которой идёт второй проход по выпрямленной
 * копии.
 */
const EDGE_SHADOW_PERSPECTIVE: SyntheticRulingPerspective = {
  convergenceX: 0.5 / DEGREES_IN_RADIAN / EDGE_SHADOW_RULED_HEIGHT,
  convergenceY: toConvergenceY(0.04, EDGE_SHADOW_RULED_HEIGHT),
};

/**
 * Отстояние найденной линии поля от самого внутреннего положения черты: снос
 * вправо, поэтому оно у нижней границы области с линиями.
 *
 * @param sheet — лист с чертой у левой стороны
 * @param marginLineX — найденная линия поля; `null` — не найдена
 * @returns расстояние в пикселях; бесконечность — линии нет
 */
const measureMarginLineMiss = (
  sheet: SyntheticMarginLineSheet,
  marginLineX: number | null
): number => {
  const innermost = computeSyntheticMarginLineX(
    sheet,
    sheet.height - sheet.margins.bottom
  );

  return marginLineX === null || innermost === null
    ? Number.POSITIVE_INFINITY
    : Math.abs(marginLineX - innermost);
};

describe('вето первой ступени: правило края полосы', () => {
  it('кандидат профиля ближе полуокна фона к краю не становится линией поля', () => {
    const detection = detectRuling(createSyntheticSheet(EDGE_SHADOW_SHEET), {
      skewAngle: 0,
    });

    expect(detection.marginLineSide).toBe('left');
    expect(
      measureMarginLineMiss(EDGE_SHADOW_SHEET, detection.marginLineX)
    ).toBeLessThanOrEqual(MARGIN_LINE_TOLERANCE_STEPS * EDGE_SHADOW_SHEET.step);
  });

  /**
   * Сторона, заданная снаружи, — вход прохода по копии: гейт выбирает край, но
   * вето у этого края не снимает.
   */
  it('заданная сторона вето не отменяет', () => {
    const detection = detectRuling(createSyntheticSheet(EDGE_SHADOW_SHEET), {
      skewAngle: 0,
      marginLineSide: 'left',
    });

    expect(detection.marginLineSide).toBe('left');
    expect(
      measureMarginLineMiss(EDGE_SHADOW_SHEET, detection.marginLineX)
    ).toBeLessThanOrEqual(MARGIN_LINE_TOLERANCE_STEPS * EDGE_SHADOW_SHEET.step);
  });
});

describe('вето первой ступени: проход по выпрямленной копии', () => {
  /**
   * Без вето на втором проходе копия отдала бы тень у края: сторону `left` ей
   * задаёт ровный проход, и первая ступень копии берёт тот же кандидат, что и
   * первая ступень кадра.
   */
  it('на листе с перспективой копия не отдаёт кандидата у края', () => {
    const sheet: SyntheticMarginLineSheet = {
      ...EDGE_SHADOW_SHEET,
      rulingPerspective: EDGE_SHADOW_PERSPECTIVE,
    };
    const { source, diagnostics } = measureSheetPhoto(createSyntheticSheet(sheet), {
      kind: 'grid',
    });

    expect(source.perspective).not.toBeNull();
    expect(diagnostics.perspective?.isRectifiedRulingMissing).toBe(false);
    expect(source.marginLineSide).toBe('left');
    expect(measureMarginLineMiss(sheet, source.marginLineX || null)).toBeLessThanOrEqual(
      MARGIN_LINE_TOLERANCE_STEPS * sheet.step
    );
  });
});
