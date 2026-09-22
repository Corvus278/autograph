import { deriveGeometry, MARGIN_LINE_GAP_SHARE } from '@pages/Generator/lib/calibrate';
import { FALLBACK_FONT_METRICS } from '@pages/Generator/lib/measure/measureFontMetrics';
import { buildSheetRuling } from '@pages/Generator/lib/paper';
import { detectRuling } from '@pages/Generator/lib/paper/detectRuling';
import { measureBandedPeriod } from '@pages/Generator/lib/paper/measureBandedPeriod';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createSyntheticSheet } from './helpers/synthetic-sheet';

/**
 * Полосовая ступень подменяется собой же под счётчиком: проверять «полосы не
 * вызывались» временем нельзя — оно шумит, а заглушкой нельзя, потому что тот
 * же счётчик нужен и там, где ступень обязана отработать по-настоящему.
 */
vi.mock('@pages/Generator/lib/paper/measureBandedPeriod', async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import('@pages/Generator/lib/paper/measureBandedPeriod')
    >();

  return { ...actual, measureBandedPeriod: vi.fn(actual.measureBandedPeriod) };
});

/**
 * Допуск на шаг и поля в пикселях. Шаг усредняется по всей высоте кадра,
 * поэтому от него ждут дробной точности; поля упираются в дискретность самого
 * профиля, и там пары пикселей достаточно.
 */
const STEP_TOLERANCE = 0.3;

const MARGIN_TOLERANCE = 3;

/**
 * Расстояние между фазами: фаза замкнута по модулю шага, поэтому 0 и «шаг без
 * десятой» — соседи, а не противоположности.
 */
const measurePhaseDistance = (first: number, second: number, step: number): number => {
  const distance = Math.abs(first - second) % step;

  return Math.min(distance, step - distance);
};

/**
 * Лист в линейку с дробным шагом: на целом шаге промах в дробной части был бы
 * незаметен.
 */
const LINED_SHEET = {
  width: 420,
  height: 560,
  step: 23.5,
  phase: 8,
  margins: { top: 78.5, right: 36, bottom: 82, left: 60 },
  marginLineX: 96,
};

/**
 * Первая и последняя линии листа в линейку: границы области с линиями
 * отсчитываются по ним, а не по краю кадра.
 */
const LINED_FIRST_LINE = 78.5;

const LINED_LAST_LINE = 478;

/**
 * Линия поля у правого края: лист снят как правая половина разворота. На доле
 * ширины 0.81 — там же, где она стоит на снимках пресет-пака.
 */
const RIGHT_MARGIN_LINE_X = 340;

const GRID_SHEET = {
  width: 420,
  height: 560,
  step: 28,
  phase: 0,
  kind: 'grid' as const,
  margins: { top: 56, right: 56, bottom: 56, left: 56 },
};

/**
 * Зазор между боковой границей области с линиями и полем: граница без линии
 * поля сама служит полем, и блок отступает от неё, как от линии поля.
 */
const LINED_EDGE_GAP = LINED_SHEET.step * MARGIN_LINE_GAP_SHARE;

const GRID_EDGE_GAP = GRID_SHEET.step * MARGIN_LINE_GAP_SHARE;

describe('detectRuling на листе в линейку', () => {
  it('находит шаг, фазу и вид разлиновки', () => {
    const detection = detectRuling(createSyntheticSheet(LINED_SHEET));

    expect(detection.isDetected).toBe(true);
    expect(detection.kind).toBe('lined');
    expect(Math.abs(detection.step - LINED_SHEET.step)).toBeLessThanOrEqual(
      STEP_TOLERANCE
    );
    expect(
      measurePhaseDistance(detection.firstLinePhase, LINED_SHEET.phase, LINED_SHEET.step)
    ).toBeLessThanOrEqual(1);
    expect(detection.confidence).toBeGreaterThan(0.5);
  });

  it('находит поля по границам области с линиями', () => {
    const { margins } = detectRuling(createSyntheticSheet(LINED_SHEET));

    expect(Math.abs(margins.top - LINED_FIRST_LINE)).toBeLessThanOrEqual(
      MARGIN_TOLERANCE
    );
    expect(
      Math.abs(margins.bottom - (LINED_SHEET.height - LINED_LAST_LINE))
    ).toBeLessThanOrEqual(MARGIN_TOLERANCE);
    expect(
      Math.abs(margins.left - (LINED_SHEET.margins.left + LINED_EDGE_GAP))
    ).toBeLessThanOrEqual(MARGIN_TOLERANCE);
    expect(
      Math.abs(margins.right - (LINED_SHEET.margins.right + LINED_EDGE_GAP))
    ).toBeLessThanOrEqual(MARGIN_TOLERANCE);
  });

  it('находит вертикальную линию поля слева', () => {
    const { marginLineX, marginLineSide } = detectRuling(
      createSyntheticSheet(LINED_SHEET)
    );

    expect(marginLineSide).toBe('left');
    expect(Math.abs((marginLineX || 0) - 96)).toBeLessThanOrEqual(MARGIN_TOLERANCE);
  });

  it('находит вертикальную линию поля справа', () => {
    const { marginLineX, marginLineSide } = detectRuling(
      createSyntheticSheet({ ...LINED_SHEET, marginLineX: RIGHT_MARGIN_LINE_X })
    );

    expect(marginLineSide).toBe('right');
    expect(Math.abs((marginLineX || 0) - RIGHT_MARGIN_LINE_X)).toBeLessThanOrEqual(
      MARGIN_TOLERANCE
    );
  });

  it('находит линию поля справа и на повёрнутом зернистом снимке', () => {
    const { marginLineX, marginLineSide } = detectRuling(
      createSyntheticSheet({
        ...LINED_SHEET,
        marginLineX: RIGHT_MARGIN_LINE_X,
        angle: 1.3,
        noise: 0.08,
        lighting: 0.35,
      })
    );

    expect(marginLineSide).toBe('right');
    expect(Math.abs((marginLineX || 0) - RIGHT_MARGIN_LINE_X)).toBeLessThanOrEqual(
      MARGIN_TOLERANCE
    );
  });

  it('не выдумывает линию поля там, где её нет', () => {
    const detection = detectRuling(
      createSyntheticSheet({ ...LINED_SHEET, marginLineX: null, noise: 0.05 })
    );

    expect(detection.isDetected).toBe(true);
    expect(detection.marginLineX).toBeNull();
    expect(detection.marginLineSide).toBeNull();
  });

  it('держит точность на зерне бумаги и неравномерном освещении', () => {
    const detection = detectRuling(
      createSyntheticSheet({ ...LINED_SHEET, noise: 0.08, lighting: 0.3 })
    );

    expect(detection.isDetected).toBe(true);
    expect(Math.abs(detection.step - LINED_SHEET.step)).toBeLessThanOrEqual(
      STEP_TOLERANCE
    );
  });
});

describe('detectRuling на листе в клетку', () => {
  it('отличает клетку от линейки', () => {
    const detection = detectRuling(createSyntheticSheet(GRID_SHEET));

    expect(detection.isDetected).toBe(true);
    expect(detection.kind).toBe('grid');
    expect(Math.abs(detection.step - GRID_SHEET.step)).toBeLessThanOrEqual(
      STEP_TOLERANCE
    );
  });

  it('находит поля клетки', () => {
    const { margins } = detectRuling(createSyntheticSheet(GRID_SHEET));

    expect(Math.abs(margins.top - GRID_SHEET.margins.top)).toBeLessThanOrEqual(
      MARGIN_TOLERANCE
    );
    expect(Math.abs(margins.bottom - GRID_SHEET.margins.bottom)).toBeLessThanOrEqual(
      MARGIN_TOLERANCE
    );
    expect(
      Math.abs(margins.left - (GRID_SHEET.margins.left + GRID_EDGE_GAP))
    ).toBeLessThanOrEqual(MARGIN_TOLERANCE);
    expect(
      Math.abs(margins.right - (GRID_SHEET.margins.right + GRID_EDGE_GAP))
    ).toBeLessThanOrEqual(MARGIN_TOLERANCE);
  });

  it('не принимает линию клетки за линию поля', () => {
    const { marginLineX } = detectRuling(createSyntheticSheet(GRID_SHEET));

    expect(marginLineX).toBeNull();
  });

  it('не принимает линию клетки за линию поля и на зернистом снимке', () => {
    const { marginLineX } = detectRuling(
      createSyntheticSheet({ ...GRID_SHEET, noise: 0.08, lighting: 0.35 })
    );

    expect(marginLineX).toBeNull();
  });

  it('находит на клетке линию поля, если она заметно жирнее клетки', () => {
    const { marginLineX, marginLineSide } = detectRuling(
      createSyntheticSheet({
        ...GRID_SHEET,
        marginLineX: 98,
        marginLineDarkness: 0.8,
        noise: 0.05,
      })
    );

    expect(marginLineSide).toBe('left');
    expect(Math.abs((marginLineX || 0) - 98)).toBeLessThanOrEqual(MARGIN_TOLERANCE);
  });

  /**
   * Так устроены снимки пресет-пака: клетка на всю ширину и красная линия поля
   * у правого края, на доле ширины около 0.87.
   */
  it('находит на клетке линию поля у правого края', () => {
    const { marginLineX, marginLineSide } = detectRuling(
      createSyntheticSheet({
        ...GRID_SHEET,
        marginLineX: 366,
        marginLineDarkness: 0.8,
        noise: 0.05,
        lighting: 0.3,
      })
    );

    expect(marginLineSide).toBe('right');
    expect(Math.abs((marginLineX || 0) - 366)).toBeLessThanOrEqual(MARGIN_TOLERANCE);
  });

  /**
   * Разлиновка на всю ширину, но линии клетки провалом отклика режут область
   * на куски по одному шагу. Без затягивания провалов «самый длинный кусок»
   * оказывался промежутком между двумя линиями клетки, и поля уезжали к
   * середине листа.
   */
  it('не режет область письма на клетки при поиске полей', () => {
    const { margins } = detectRuling(
      createSyntheticSheet({
        ...GRID_SHEET,
        marginLineX: 366,
        marginLineDarkness: 0.8,
        noise: 0.05,
      })
    );

    expect(margins.left).toBeLessThanOrEqual(
      GRID_SHEET.margins.left + GRID_EDGE_GAP + MARGIN_TOLERANCE
    );
    expect(margins.right).toBeLessThanOrEqual(
      GRID_SHEET.margins.right + GRID_EDGE_GAP + MARGIN_TOLERANCE
    );
  });

  /**
   * Так устроена тетрадь на спирали: слева и справа от сетки чистая полоса,
   * красной линии нет, и поле задаёт сама граница сетки. Блок, выложенный от
   * самой границы, ставит первую букву на неё или за неё.
   */
  it('выкладывает блок внутри сетки без линии поля с зазором, как от линии поля', () => {
    const { width, height, margins, step } = GRID_SHEET;
    const detection = detectRuling(createSyntheticSheet({ ...GRID_SHEET, noise: 0.05 }));
    const ruling = buildSheetRuling({ ...detection, skewAngle: 0 }, { width, height });
    const { leftPadding, blockWidth } = deriveGeometry(
      { ruling, kind: 'grid', width, height },
      FALLBACK_FONT_METRICS
    );
    const gap = step * MARGIN_LINE_GAP_SHARE;

    expect(detection.marginLineX).toBeNull();
    expect(Math.abs(leftPadding - (margins.left + gap))).toBeLessThanOrEqual(
      MARGIN_TOLERANCE
    );
    expect(
      Math.abs(leftPadding + blockWidth - (width - margins.right - gap))
    ).toBeLessThanOrEqual(MARGIN_TOLERANCE);
  });

  /**
   * Так устроена тетрадь пользователя: горизонтальные линии справа тянутся
   * почти до края листа, а вертикальные кончаются на несколько клеток раньше.
   * Граница сетки — последняя вертикальная линия: блок, выложенный по
   * горизонтальным, уводит строку в полосу, где остались одни горизонтальные.
   */
  it('берёт боковую границу клетки по вертикальным линиям, если они короче горизонтальных', () => {
    const { width, height, margins, step } = GRID_SHEET;
    const lastColumnX = 308;
    const detection = detectRuling(
      createSyntheticSheet({
        ...GRID_SHEET,
        columnMargins: { left: margins.left, right: width - lastColumnX },
        noise: 0.05,
      })
    );
    const ruling = buildSheetRuling({ ...detection, skewAngle: 0 }, { width, height });
    const { leftPadding, blockWidth } = deriveGeometry(
      { ruling, kind: 'grid', width, height },
      FALLBACK_FONT_METRICS
    );
    const gap = step * MARGIN_LINE_GAP_SHARE;

    expect(Math.abs(leftPadding - (margins.left + gap))).toBeLessThanOrEqual(
      MARGIN_TOLERANCE
    );
    expect(Math.abs(leftPadding + blockWidth - (lastColumnX - gap))).toBeLessThanOrEqual(
      MARGIN_TOLERANCE
    );
  });
});

describe('detectRuling на повёрнутом листе', () => {
  it('находит шаг с той же точностью, что и на ровном', () => {
    const straight = detectRuling(createSyntheticSheet(LINED_SHEET));
    const skewed = detectRuling(createSyntheticSheet({ ...LINED_SHEET, angle: 1.3 }));

    expect(skewed.isDetected).toBe(true);
    expect(Math.abs(skewed.step - LINED_SHEET.step)).toBeLessThanOrEqual(STEP_TOLERANCE);
    expect(Math.abs(skewed.step - straight.step)).toBeLessThanOrEqual(STEP_TOLERANCE);
  });

  it('находит фазу, поля и линию поля на повёрнутом листе в линейку', () => {
    const detection = detectRuling(createSyntheticSheet({ ...LINED_SHEET, angle: 1.3 }));

    expect(
      measurePhaseDistance(detection.firstLinePhase, LINED_SHEET.phase, LINED_SHEET.step)
    ).toBeLessThanOrEqual(1);
    expect(Math.abs(detection.margins.top - LINED_FIRST_LINE)).toBeLessThanOrEqual(
      MARGIN_TOLERANCE
    );
    expect(Math.abs((detection.marginLineX || 0) - 96)).toBeLessThanOrEqual(
      MARGIN_TOLERANCE
    );
  });

  it('находит поля и линию поля на повёрнутой клетке', () => {
    const detection = detectRuling(createSyntheticSheet({ ...GRID_SHEET, angle: -1.1 }));

    expect(detection.kind).toBe('grid');
    expect(Math.abs(detection.step - GRID_SHEET.step)).toBeLessThanOrEqual(
      STEP_TOLERANCE
    );
    expect(Math.abs(detection.margins.top - GRID_SHEET.margins.top)).toBeLessThanOrEqual(
      MARGIN_TOLERANCE
    );
  });

  it('принимает готовый угол вместо свипа', () => {
    const image = createSyntheticSheet({ ...LINED_SHEET, angle: 1.3 });
    const detection = detectRuling(image, { skewAngle: 1.3 });

    expect(Math.abs(detection.step - LINED_SHEET.step)).toBeLessThanOrEqual(
      STEP_TOLERANCE
    );
  });
});

/**
 * Лист, разлинованный до самого края кадра, как снимки пресет-пака: полей у
 * разлиновки нет ни с одной стороны. Наклон и зерно — чтобы край профиля
 * отстоял от края кадра на защитную полосу, а не совпадал с ним.
 */
const EDGE_TO_EDGE_SHEET = {
  width: 420,
  height: 560,
  step: 23.5,
  phase: 8,
  angle: 1.3,
  noise: 0.05,
};

const NO_MARGINS = { top: 0, right: 0, bottom: 0, left: 0 };

/**
 * Клетка до верхнего и нижнего края кадра, как на снимке тетради телефоном:
 * крайние линии искажены, средние чёткие.
 */
const PHONE_GRID_SHEET = {
  width: 420,
  height: 560,
  step: 28,
  phase: 10,
  kind: 'grid' as const,
  noise: 0.05,
};

describe('detectRuling на листе, разлинованном до края кадра', () => {
  it('на линейке до края возвращает нули и сохраняет линию поля', () => {
    const detection = detectRuling(
      createSyntheticSheet({ ...EDGE_TO_EDGE_SHEET, marginLineX: RIGHT_MARGIN_LINE_X })
    );

    expect(detection.isDetected).toBe(true);
    expect(detection.margins).toEqual(NO_MARGINS);
    expect(detection.marginLineSide).toBe('right');
    expect(
      Math.abs((detection.marginLineX || 0) - RIGHT_MARGIN_LINE_X)
    ).toBeLessThanOrEqual(MARGIN_TOLERANCE);
  });

  it('на клетке до края возвращает нули и сохраняет линию поля', () => {
    const detection = detectRuling(
      createSyntheticSheet({
        ...EDGE_TO_EDGE_SHEET,
        kind: 'grid',
        step: 28,
        angle: -1.1,
        marginLineX: 366,
        marginLineDarkness: 0.8,
      })
    );

    expect(detection.kind).toBe('grid');
    expect(detection.margins).toEqual(NO_MARGINS);
    expect(detection.marginLineSide).toBe('right');
    expect(Math.abs((detection.marginLineX || 0) - 366)).toBeLessThanOrEqual(
      MARGIN_TOLERANCE
    );
  });

  /**
   * Так устроены снимки линейки пресет-пака: две нижние линии у края кадра
   * ушли с арифметической гребёнки на восьмую шага. Шаг крупный, чтобы уход в
   * пикселях был тем же, что на фотографиях.
   */
  it('доводит линейку до нижнего края, даже если нижние линии ушли с гребёнки', () => {
    const { margins } = detectRuling(
      createSyntheticSheet({
        width: 420,
        height: 700,
        step: 48,
        phase: 20,
        margins: { top: 116, right: 0, bottom: 0, left: 0 },
        driftFrom: 640,
        drift: -7,
        noise: 0.05,
      })
    );

    expect(Math.abs(margins.top - 116)).toBeLessThanOrEqual(MARGIN_TOLERANCE);
    expect(margins.bottom).toBe(0);
  });

  /**
   * На снимке телефоном крайние линии повёрнуты в разные стороны, и в
   * профиле, усреднённом по всей ширине, их провал размазан на полшага: там
   * цепочка линий рвалась посреди листа, и верх с низом выглядели полями.
   */
  it('доводит клетку до верха и низа кадра, даже если крайние линии повёрнуты перспективой', () => {
    const { margins } = detectRuling(
      createSyntheticSheet({ ...PHONE_GRID_SHEET, perspective: 12 })
    );

    expect(margins.top).toBe(0);
    expect(margins.bottom).toBe(0);
  });

  /**
   * Крайние линии на снимке телефоном теряют до двух третей глубины против
   * средних — и всё равно остаются линиями, а не чистым полем.
   */
  it('доводит клетку до верха и низа кадра, даже если крайние линии бледнее', () => {
    const { margins } = detectRuling(
      createSyntheticSheet({ ...PHONE_GRID_SHEET, fade: 0.65 })
    );

    expect(margins.top).toBe(0);
    expect(margins.bottom).toBe(0);
  });

  it('обнуляет только стороны, где разлиновка дошла до края', () => {
    const { margins } = detectRuling(
      createSyntheticSheet({
        ...EDGE_TO_EDGE_SHEET,
        margins: { ...LINED_SHEET.margins, right: 0, left: 0 },
      })
    );

    expect(Math.abs(margins.top - LINED_FIRST_LINE)).toBeLessThanOrEqual(
      MARGIN_TOLERANCE
    );
    expect(
      Math.abs(margins.bottom - (LINED_SHEET.height - LINED_LAST_LINE))
    ).toBeLessThanOrEqual(MARGIN_TOLERANCE);
    expect(margins.left).toBe(0);
    expect(margins.right).toBe(0);
  });
});

describe('detectRuling на листе без разлиновки', () => {
  it('сообщает о неудаче, а не выдумывает шаг', () => {
    const detection = detectRuling(
      createSyntheticSheet({
        ...LINED_SHEET,
        kind: 'blank',
        marginLineX: null,
        noise: 0.06,
        lighting: 0.3,
      })
    );

    expect(detection.isDetected).toBe(false);
    expect(detection.step).toBe(0);
    expect(detection.kind).toBe('blank');
    expect(detection.margins).toEqual({ top: 0, right: 0, bottom: 0, left: 0 });
    expect(detection.marginLineX).toBeNull();
    expect(detection.confidence).toBeLessThan(0.35);
  });

  it('на ровной заливке тоже не находит разлиновки', () => {
    const detection = detectRuling(
      createSyntheticSheet({ ...LINED_SHEET, kind: 'blank', marginLineX: null })
    );

    expect(detection.isDetected).toBe(false);
    expect(detection.confidence).toBe(0);
  });
});

/**
 * Числа ровных листов, снятые на базе прогона `d7a3243` — до того, как в
 * детекторе появилась полосовая ступень. Литералы, а не пересчёт новым кодом:
 * эталон, посчитанный тем же кодом, который он сторожит, совпадёт с ним всегда.
 */
const LINED_BASELINE = {
  kind: 'lined',
  step: 23.491316066964366,
  firstLinePhase: 8.093027738644842,
  skewAngle: -0.000013770580182592695,
  confidence: 0.9139974135923932,
  bendFoundNodeShare: 1,
  marginLineX: 96,
  marginLineSide: 'left',
  margins: {
    top: 78.56697593953794,
    right: 39.69826321339287,
    bottom: 82.08065092206783,
    left: 64.69826321339288,
  },
};

const GRID_BASELINE = {
  kind: 'grid',
  step: 28.0362392628461,
  firstLinePhase: 27.67337387261424,
  skewAngle: 0,
  confidence: 0.9277021290843693,
  bendFoundNodeShare: 1,
  marginLineX: null,
  marginLineSide: null,
  margins: {
    top: 55.70961313546034,
    right: 61.71860616468335,
    bottom: 55.71055865900206,
    left: 61.71860616468338,
  },
};

/**
 * Числа разлиновки, которые сторожит эталон ровного листа.
 *
 * @param detection — измеренная разлиновка
 * @returns числа для сверки с эталоном
 */
const toBaselineNumbers = (detection: ReturnType<typeof detectRuling>) => {
  const { kind, step, firstLinePhase, skewAngle, confidence } = detection;

  return {
    kind,
    step,
    firstLinePhase,
    skewAngle,
    confidence,
    bendFoundNodeShare: detection.bendFoundNodeShare,
    marginLineX: detection.marginLineX,
    marginLineSide: detection.marginLineSide,
    margins: detection.margins,
  };
};

/**
 * Лист с дрейфом шага на четверть по высоте кадра — та же четверть, что
 * гарантирована спекой. Кадр вдвое выше листов остальных проверок: на
 * полутысяче пикселей полос выходит три, а тут шесть — по ним видно и сам ряд
 * шагов, и его наклон.
 */
const DRIFT_SHEET = {
  width: 420,
  height: 1120,
  step: 24,
  phase: 12,
  stepDrift: 0.25,
};

/**
 * Порог уверенности, при котором глобальный профиль этого листа считается
 * невзятым.
 *
 * Синтетика рисует линии чище фотографии: профиль по всему кадру берёт дрейф в
 * четверть с уверенностью 0,67, тогда как на живых снимках предмета приёмки он
 * даёт 0,000…0,326 при пороге 0,35. Порог поднимается настройкой, потому что
 * проверяется здесь не сила профиля, а то, что при невзятом пороге в дело
 * вступают полосы и разлиновка всё равно находится.
 */
const BANDED_STAGE_THRESHOLD = 0.8;

/**
 * Уверенность глобального профиля на листе с дрейфом: ниже поднятого порога,
 * выше штатного.
 */
const DRIFT_SHEET_CONFIDENCE = 0.6699176129653133;

/**
 * Число полос, на которые режется кадр листа с дрейфом, и середина его области
 * с линиями: линии идут во весь кадр, поэтому начало отсчёта — середина высоты.
 */
const DRIFT_SHEET_BANDS = 6;

const DRIFT_SHEET_ORIGIN = 560;

/**
 * Допустимое расхождение найденного шага с шагом в середине области с линиями,
 * в долях шага. Число из спеки: «не больше чем на два процента».
 */
const DRIFT_STEP_TOLERANCE = 0.02;

describe('detectRuling: полосовая ступень', () => {
  beforeEach(() => {
    vi.mocked(measureBandedPeriod).mockClear();
  });

  it('не зовёт полосы на листе в линейку и держит прежние числа до бита', () => {
    const detection = detectRuling(createSyntheticSheet(LINED_SHEET));

    expect(vi.mocked(measureBandedPeriod)).not.toHaveBeenCalled();
    expect(toBaselineNumbers(detection)).toStrictEqual(LINED_BASELINE);
    expect(detection.bandSteps).toStrictEqual([]);
    expect(detection.convergenceSeed).toBe(0);
    expect(detection.convergenceOrigin).toBe(0);
  });

  it('не зовёт полосы на листе в клетку и держит прежние числа до бита', () => {
    const detection = detectRuling(createSyntheticSheet(GRID_SHEET));

    expect(vi.mocked(measureBandedPeriod)).not.toHaveBeenCalled();
    expect(toBaselineNumbers(detection)).toStrictEqual(GRID_BASELINE);
    expect(detection.bandSteps).toStrictEqual([]);
    expect(detection.convergenceSeed).toBe(0);
    expect(detection.convergenceOrigin).toBe(0);
  });

  it('находит шаг листа с дрейфом, когда профиль по кадру порога не берёт', () => {
    const detection = detectRuling(createSyntheticSheet(DRIFT_SHEET), {
      confidenceThreshold: BANDED_STAGE_THRESHOLD,
    });

    expect(detection.confidence).toBe(DRIFT_SHEET_CONFIDENCE);
    expect(vi.mocked(measureBandedPeriod)).toHaveBeenCalledTimes(1);
    expect(detection.isDetected).toBe(true);
    expect(Math.abs(detection.step - DRIFT_SHEET.step)).toBeLessThanOrEqual(
      DRIFT_STEP_TOLERANCE * DRIFT_SHEET.step
    );
  });

  it('отдаёт шаги полос и засев схождения от начала отсчёта полос', () => {
    const { bandSteps, convergenceSeed, convergenceOrigin } = detectRuling(
      createSyntheticSheet(DRIFT_SHEET),
      { confidenceThreshold: BANDED_STAGE_THRESHOLD }
    );

    expect(bandSteps).toHaveLength(DRIFT_SHEET_BANDS);
    expect(convergenceOrigin).toBe(DRIFT_SHEET_ORIGIN);

    for (const [index, step] of bandSteps.entries()) {
      expect(step).toBeGreaterThan(bandSteps[index - 1] || 0);
    }

    /**
     * Засев — прирост шага на пиксель: четверть на весь кадр даёт около двух
     * десятитысячных, и знак у него тот же, что у роста шага книзу.
     */
    expect(convergenceSeed).toBeGreaterThan(0);
    expect(convergenceSeed * DRIFT_SHEET.height).toBeGreaterThan(0.15);
    expect(convergenceSeed * DRIFT_SHEET.height).toBeLessThan(0.35);
  });

  it('оставляет тот же лист глобальному профилю при штатном пороге', () => {
    const detection = detectRuling(createSyntheticSheet(DRIFT_SHEET));

    expect(vi.mocked(measureBandedPeriod)).not.toHaveBeenCalled();
    expect(detection.isDetected).toBe(true);
    expect(detection.bandSteps).toStrictEqual([]);
  });
});
