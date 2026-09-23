import type { SheetImageData } from '@pages/Generator/lib/paper';
import { detectRuling } from '@pages/Generator/lib/paper/detectRuling';
import {
  MARGIN_LINE_COLOUR_GATE,
  MARGIN_LINE_MIN_REDNESS,
} from '@pages/Generator/lib/paper/marginLineRedness';
import { measureSheetPhoto } from '@pages/Generator/lib/paper/measureSheetPhoto';
import { describe, expect, it } from 'vitest';

import type {
  SyntheticMarginLineSheet,
  SyntheticRulingPerspective,
} from './helpers/synthetic-sheet';
import {
  ABSENT_MARGIN_LINE_SHEET,
  COLOUR_DEEP_COLUMN_SHEET,
  COLOUR_STRAIGHT_MARGIN_LINE_SHEET,
  CONVERGING_GRID_SHEET,
  createSyntheticSheet,
  DRIFTING_MARGIN_LINE_SHEET,
  GRAY_COLOUR,
} from './helpers/synthetic-sheet';

/**
 * Множитель барьера по соседям — тот же, что у полосовой меры детектора:
 * вето по стороне пропускает кандидата, только если он глубже соседей во
 * столько раз.
 */
const PEERS_BARRIER_RATIO = 1.5;

/**
 * Клетка с прямой чертой слева: профиль во всю высоту берёт черту сам, и вето
 * её подтверждает.
 */
const STRAIGHT_LEFT_SHEET: SyntheticMarginLineSheet = {
  ...DRIFTING_MARGIN_LINE_SHEET,
  marginLineDrift: 0,
};

const STRAIGHT_RULED_HEIGHT =
  STRAIGHT_LEFT_SHEET.height -
  STRAIGHT_LEFT_SHEET.margins.top -
  STRAIGHT_LEFT_SHEET.margins.bottom;

/**
 * Во сколько раз шаг у нижней линии области больше, чем у верхней.
 */
const STEP_DRIFT_RATIO = Math.sqrt(1.04);

/**
 * Схождение на полградуса и дрейф шага 4 % по высоте области — перспектива,
 * ради которой идёт второй проход по выпрямленной копии.
 */
const STRAIGHT_PERSPECTIVE: SyntheticRulingPerspective = {
  convergenceX: (0.5 * Math.PI) / 180 / STRAIGHT_RULED_HEIGHT,
  convergenceY:
    (2 * (STEP_DRIFT_RATIO - 1)) / (STRAIGHT_RULED_HEIGHT * (STEP_DRIFT_RATIO + 1)),
};

/**
 * Тот же растр без канала `R − G` — яркостный путь.
 *
 * @param image — растр с каналом
 * @returns растр только с яркостью
 */
const toLuminanceOnly = ({
  width,
  height,
  luminance,
}: SheetImageData): SheetImageData => {
  return { width, height, luminance };
};

describe('отчёт первой ступени: вердикт вето', () => {
  /**
   * Лист «причина `IMG_1813`»: резкую вертикаль у границы правой трети
   * профиль берёт за черту, а вдоль линии она не глубже соседей. Отчёт
   * обязан назвать и отказ, и числа, по которым он принят.
   */
  it('фантом у границы трети — «отвергнут стороной» с отношением и порогом', () => {
    const { marginLineX, marginLineReport } = detectRuling(
      createSyntheticSheet(CONVERGING_GRID_SHEET),
      { skewAngle: 0 }
    );
    const { profileVeto } = marginLineReport;

    expect(marginLineX).toBeNull();
    expect(profileVeto.isCalled).toBe(true);
    expect(profileVeto).toMatchObject({
      verdict: 'side',
      side: 'right',
      threshold: 'peers',
      redness: null,
    });
    expect(profileVeto.isCalled && profileVeto.ratio).toBeGreaterThan(0);
    expect(profileVeto.isCalled && profileVeto.ratio).toBeLessThan(PEERS_BARRIER_RATIO);
    expect(profileVeto.isCalled && profileVeto.coverage).toBeGreaterThan(0);
  });

  it('прямая черта — «принят» с отношением выше барьера', () => {
    const { marginLineReport } = detectRuling(createSyntheticSheet(STRAIGHT_LEFT_SHEET), {
      skewAngle: 0,
    });
    const { profileVeto } = marginLineReport;

    expect(marginLineReport.stage).toBe('profile');
    expect(profileVeto).toMatchObject({
      isCalled: true,
      verdict: 'accepted',
      side: 'left',
      threshold: 'peers',
    });
    expect(profileVeto.isCalled && profileVeto.ratio).toBeGreaterThan(
      PEERS_BARRIER_RATIO
    );
  });

  /**
   * Снесённую черту профиль во всю высоту размывает, и кандидата у него нет:
   * линию отдают полосы, а вето не звалось. Нули охвата и отношения тут не
   * читаются как «отвергнут» — вызов несётся отдельным полем.
   */
  it('без кандидата профиля — «не звалось», хотя линию нашли полосы', () => {
    const { marginLineX, marginLineReport } = detectRuling(
      createSyntheticSheet(DRIFTING_MARGIN_LINE_SHEET),
      { skewAngle: 0 }
    );

    expect(marginLineX).not.toBeNull();
    expect(marginLineReport.stage).toBe('banded');
    expect(marginLineReport.profileVeto).toStrictEqual({ isCalled: false });
  });

  it('со снятой стороной — «не звалось», и гейт не понадобился', () => {
    const { marginLineReport } = detectRuling(createSyntheticSheet(STRAIGHT_LEFT_SHEET), {
      skewAngle: 0,
      marginLineSide: null,
    });

    expect(marginLineReport.profileVeto).toStrictEqual({ isCalled: false });
    expect(marginLineReport.colourGate).toBeNull();
  });

  /**
   * Нейтральная глубокая вертикаль на фазе: сторону полосовая мера
   * подтверждает, отвергает её краснота — и отчёт называет именно её.
   */
  it('нейтральная вертикаль на цветном снимке — «отвергнут цветом» с краснотой', () => {
    const { marginLineX, marginLineReport } = detectRuling(
      createSyntheticSheet(COLOUR_DEEP_COLUMN_SHEET)
    );
    const { profileVeto, colourGate } = marginLineReport;

    expect(marginLineX).toBeNull();
    expect(profileVeto).toMatchObject({ isCalled: true, verdict: 'colour' });
    expect(profileVeto.isCalled && profileVeto.ratio).toBeGreaterThan(
      PEERS_BARRIER_RATIO
    );
    expect(profileVeto.isCalled && profileVeto.redness).toBeLessThan(
      MARGIN_LINE_MIN_REDNESS
    );
    expect(colourGate?.isEnabled).toBe(true);
    expect(colourGate?.redGreenP99).toBeGreaterThanOrEqual(MARGIN_LINE_COLOUR_GATE);
  });

  it('красная прямая черта — «принят» с краснотой не ниже порога', () => {
    const { marginLineReport } = detectRuling(
      createSyntheticSheet(COLOUR_STRAIGHT_MARGIN_LINE_SHEET)
    );
    const { profileVeto } = marginLineReport;

    expect(profileVeto).toMatchObject({ isCalled: true, verdict: 'accepted' });
    expect(profileVeto.isCalled && profileVeto.redness).toBeGreaterThanOrEqual(
      MARGIN_LINE_MIN_REDNESS
    );
  });
});

describe('отчёт первой ступени: гейт серого снимка', () => {
  it('серый снимок — вето по цвету выключено, P99 кадра ниже гейта', () => {
    const { marginLineReport } = detectRuling(
      createSyntheticSheet({ ...COLOUR_DEEP_COLUMN_SHEET, colour: GRAY_COLOUR })
    );
    const { colourGate, profileVeto } = marginLineReport;

    expect(colourGate?.isEnabled).toBe(false);
    expect(colourGate?.redGreenP99).toBeLessThan(MARGIN_LINE_COLOUR_GATE);
    expect(profileVeto).toMatchObject({ verdict: 'accepted', redness: null });
  });

  it('без канала — вето по цвету выключено, P99 нет', () => {
    const { marginLineReport } = detectRuling(
      toLuminanceOnly(createSyntheticSheet(COLOUR_DEEP_COLUMN_SHEET))
    );

    expect(marginLineReport.colourGate).toStrictEqual({
      isEnabled: false,
      redGreenP99: null,
    });
  });

  /**
   * Кандидат полос на клетке без черты барьер не берёт, профиль кандидата не
   * дал: до цвета не дошёл никто, и мерить кадр было незачем.
   */
  it('до вето по цвету не дошёл ни один кандидат — гейта нет', () => {
    const { marginLineReport } = detectRuling(
      createSyntheticSheet(ABSENT_MARGIN_LINE_SHEET),
      { skewAngle: 0 }
    );

    expect(marginLineReport.profileVeto.isCalled).toBe(false);
    expect(marginLineReport.colourGate).toBeNull();
  });
});

/**
 * Первая ступень решает на каждом проходе по-своему: ровный проход ищет у
 * обоих краёв, копия — только у выбранного. Диагностика несёт оба вердикта,
 * иначе фантом, отвергнутый на кадре, пропал бы из отчёта листа с
 * перспективой.
 */
describe('measureSheetPhoto: вердикт первой ступени обоих проходов', () => {
  it('лист с перспективой — вердикты кадра и копии', () => {
    const { source, diagnostics } = measureSheetPhoto(
      createSyntheticSheet({
        ...STRAIGHT_LEFT_SHEET,
        rulingPerspective: STRAIGHT_PERSPECTIVE,
      }),
      { kind: 'grid' }
    );
    const { flat, rectified, colourGate } = diagnostics.marginLineProfile;

    expect(source.perspective).not.toBeNull();
    expect(flat).toMatchObject({ isCalled: true, verdict: 'accepted', side: 'left' });
    expect(rectified).toMatchObject({
      isCalled: true,
      verdict: 'accepted',
      side: 'left',
    });
    expect(colourGate).toStrictEqual({ isEnabled: false, redGreenP99: null });
  });

  it('без перспективы второго прохода нет — вердикт копии пуст', () => {
    const { source, diagnostics } = measureSheetPhoto(
      createSyntheticSheet(CONVERGING_GRID_SHEET),
      { kind: 'grid' }
    );
    const { flat, rectified } = diagnostics.marginLineProfile;

    expect(source.perspective).toBeNull();
    expect(flat).toMatchObject({ isCalled: true, verdict: 'side', side: 'right' });
    expect(rectified).toBeNull();
  });

  it('у чистого листа ни одна ступень не звалась', () => {
    const { diagnostics } = measureSheetPhoto(createSyntheticSheet(STRAIGHT_LEFT_SHEET), {
      kind: 'blank',
    });

    expect(diagnostics.marginLineProfile).toStrictEqual({
      flat: { isCalled: false },
      rectified: null,
      colourGate: null,
    });
  });
});
