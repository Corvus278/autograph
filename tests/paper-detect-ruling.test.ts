import { detectRuling } from '@pages/Generator/lib/paper/detectRuling';
import { describe, expect, it } from 'vitest';

import { createSyntheticSheet } from './helpers/synthetic-sheet';

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
    expect(Math.abs(margins.left - LINED_SHEET.margins.left)).toBeLessThanOrEqual(
      MARGIN_TOLERANCE
    );
    expect(Math.abs(margins.right - LINED_SHEET.margins.right)).toBeLessThanOrEqual(
      MARGIN_TOLERANCE
    );
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
    expect(Math.abs(margins.left - GRID_SHEET.margins.left)).toBeLessThanOrEqual(
      MARGIN_TOLERANCE
    );
    expect(Math.abs(margins.right - GRID_SHEET.margins.right)).toBeLessThanOrEqual(
      MARGIN_TOLERANCE
    );
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

    expect(margins.left).toBeLessThanOrEqual(GRID_SHEET.margins.left + MARGIN_TOLERANCE);
    expect(margins.right).toBeLessThanOrEqual(
      GRID_SHEET.margins.right + MARGIN_TOLERANCE
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
