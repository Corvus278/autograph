import { measureBandedPeriod } from '@pages/Generator/lib/paper/measureBandedPeriod';
import type { SheetImageData } from '@pages/Generator/lib/paper/paper.types';
import { mulberry32 } from '@shared/lib/random';
import { describe, expect, it } from 'vitest';

import {
  createSyntheticSheet,
  type SyntheticSheetParams,
} from './helpers/synthetic-sheet';

/**
 * Настройки замера, общие для всех листов: те же границы шага и тот же порог
 * уверенности, с которыми полосовую ступень зовёт детектор разлиновки.
 */
const PROBE_OPTIONS = { minStep: 5, maxStep: 112, confidenceThreshold: 0.35 };

/**
 * Доля прироста шага, гарантированная спекой.
 */
const DRIFT_SHARE = 0.25;

/**
 * Допустимое расхождение с эталонным шагом в середине области с линиями.
 */
const STEP_TOLERANCE = 0.02;

/**
 * Допустимое расхождение засева схождения с эталонным наклоном шага.
 */
const CONVERGENCE_TOLERANCE = 0.1;

/**
 * Допустимое расхождение фазы с линией у середины области с линиями, в долях
 * шага.
 */
const PHASE_TOLERANCE = 0.1;

const DRIFT_SHEET: SyntheticSheetParams = {
  width: 420,
  height: 560,
  step: 24,
  phase: 12,
  stepDrift: DRIFT_SHARE,
};

/**
 * Число полос, которое замер выводит из шага листа с дрейфом: высота 560 при
 * шаге 24 даёт три полосы по семь шагов в каждой.
 */
const DRIFT_SHEET_BANDS = 3;

/**
 * Середина области с линиями у листа с дрейфом: линии идут во весь кадр, три
 * полосы стоят симметрично, и начало отсчёта садится в середину высоты.
 */
const DRIFT_SHEET_ORIGIN = 280;

/**
 * Лист в клетку, у которого в верхней половине кадра различима лишь каждая
 * вторая линия: граница половины совпадает с границей полос, поэтому верхние
 * полосы видят удвоенный период целиком, а нижние — шаг линий.
 */
const HALVED_TOP_SHEET: SyntheticSheetParams = {
  width: 420,
  height: 720,
  step: 24,
  phase: 12,
  kind: 'grid',
  everySecondLineArea: { left: 0, top: 0, right: 419, bottom: 359, contrast: 0 },
};

const HALVED_BOTTOM_SHEET: SyntheticSheetParams = {
  ...HALVED_TOP_SHEET,
  everySecondLineArea: { left: 0, top: 360, right: 419, bottom: 719, contrast: 0 },
};

/**
 * Высота кадра у листов с крупной разлиновкой: общая, чтобы разбивку на полосы
 * решал только шаг.
 */
const COARSE_SHEET_HEIGHT = 360;

/**
 * Допустимое расхождение с эталонным шагом на крупной разлиновке, в пикселях.
 * Два отсчёта профиля: автокорреляция даёт шаг с точностью целого сдвига, а
 * уточнение по спектру на трёх шагах в полосе выбирает своё окно целиком. Доля
 * шага тут мерой не годится — точность упирается в отсчёты профиля, а не в
 * длину периода.
 */
const COARSE_STEP_TOLERANCE = 2;

/**
 * Лист, у которого шаг — шестая доля высоты кадра. Полос выходит ровно две —
 * ниже разбивка не опускается, — и в каждой остаётся три шага: период в них
 * ещё виден.
 */
const SIXTH_STEP_SHEET: SyntheticSheetParams = {
  width: 420,
  height: COARSE_SHEET_HEIGHT,
  step: COARSE_SHEET_HEIGHT / 6,
  phase: 30,
};

/**
 * Лист, у которого шаг — треть высоты кадра. Двум полосам достаётся по полтора
 * шага, период длиннее половины полосы не ищется, и замер отказывает сам.
 */
const THIRD_STEP_SHEET: SyntheticSheetParams = {
  ...SIXTH_STEP_SHEET,
  step: COARSE_SHEET_HEIGHT / 3,
  phase: 60,
};

/**
 * Кадр ловушек: тот же, на котором они заведены в хелпере синтетики.
 */
const TRAP_SHEET_WIDTH = 480;

const TRAP_SHEET_HEIGHT = 400;

/**
 * Шаг ловушки — правдоподобная для этого кадра разлиновка: отсечь её должен
 * разбор периода по высоте, а не неправдоподобность самого шага.
 */
const TRAP_STEP = 20;

/**
 * Чистый лист с полосой печатного текста посередине кадра. Период у текста
 * настоящий и не бледнее линий, но живёт он только в своей полосе.
 */
const TEXT_TRAP_SHEET: SyntheticSheetParams = {
  width: TRAP_SHEET_WIDTH,
  height: TRAP_SHEET_HEIGHT,
  kind: 'blank',
  noise: 0.02,
  seed: 5,
  textBand: {
    top: 140,
    bottom: 260,
    left: 60,
    right: 420,
    step: TRAP_STEP,
    strokeHeight: 11,
    pitch: 9,
    strokeWidth: 3,
    darkness: 0.5,
  },
};

/**
 * Высокий кадр ловушки: на нём полоса текста в те же 30 % высоты приходится на
 * две полосы разбивки целиком. Разбор по высоте такую ловушку пропускает —
 * прямая через две точки проходит всегда, — и отсечь её может только охват
 * гребёнки по кадру.
 */
const TALL_TRAP_SHEET_HEIGHT = 1200;

const TALL_TEXT_TRAP_SHEET: SyntheticSheetParams = {
  ...TEXT_TRAP_SHEET,
  height: TALL_TRAP_SHEET_HEIGHT,
  textBand: {
    top: 420,
    bottom: 780,
    left: 60,
    right: 420,
    step: TRAP_STEP,
    strokeHeight: 11,
    pitch: 9,
    strokeWidth: 3,
    darkness: 0.5,
  },
};

/**
 * Шаги, на которых меряется лист с линиями в половине кадра. На крупном шаге
 * половине кадра не хватает полос, на мелком период в них находится, и лист
 * держит только охват гребёнки.
 */
const HALF_RULED_STEPS = [10, 12, TRAP_STEP];

/**
 * Лист, у которого линии занимают лишь верхнюю половину кадра: нижнее поле во
 * всю вторую половину оставляет там чистую бумагу.
 *
 * @param step — шаг разлиновки в пикселях кадра
 * @returns параметры листа
 */
const createHalfRuledSheet = (step: number): SyntheticSheetParams => {
  return {
    width: TRAP_SHEET_WIDTH,
    height: TRAP_SHEET_HEIGHT,
    step,
    phase: step / 2,
    margins: { top: 0, right: 0, bottom: 200, left: 0 },
    noise: 0.02,
    seed: 9,
  };
};

/**
 * Лист без разлиновки вообще: одна бумага с шумом.
 */
const BLANK_SHEET: SyntheticSheetParams = {
  width: TRAP_SHEET_WIDTH,
  height: TRAP_SHEET_HEIGHT,
  kind: 'blank',
  noise: 0.02,
  seed: 3,
};

/**
 * Прямая шага по координате вдоль линий, снятая с растра.
 */
type StepReference = {
  /**
   * Шаг в начале отсчёта.
   */
  step: number;

  /**
   * Засев схождения: прирост шага на пиксель, делённый на шаг в начале отсчёта.
   */
  convergence: number;
};

/**
 * Центры тёмных строк в кадре: центроид тёмного в столбце, а не место линии из
 * параметров хелпера. Эталон, снятый с растра, не зависит от того, верно ли
 * хелпер переводит долю дрейфа в модель перспективы, — а именно это допущение
 * и проверяет замер.
 *
 * Центроид взвешивается глубиной: у гауссианы линии дно пологое, и середина
 * участка ниже порога округляла бы центр до целого пикселя.
 *
 * @param image — кадр
 * @param top — первая строка, с которой читается кадр
 * @param bottom — строка, на которой чтение кончается, не включительно
 * @returns строки центров тёмных полос сверху вниз
 */
const readLineCenters = (
  image: SheetImageData,
  top: number,
  bottom: number
): number[] => {
  const { width, luminance } = image;
  const profile: number[] = [];

  for (let y = top; y < bottom; y += 1) {
    let sum = 0;

    for (let x = 0; x < width; x += 1) {
      sum += luminance[y * width + x] || 0;
    }

    profile.push(sum / width);
  }

  const darkest = Math.min(...profile);
  const threshold = darkest + (Math.max(...profile) - darkest) / 2;
  const centers: number[] = [];
  let weight = 0;
  let moment = 0;

  for (let index = 0; index <= profile.length; index += 1) {
    const depth = index < profile.length ? threshold - (profile[index] || 0) : 0;

    if (depth > 0) {
      weight += depth;
      moment += depth * (top + index);
    }

    if (depth <= 0 && weight > 0) {
      centers.push(moment / weight);
      weight = 0;
      moment = 0;
    }
  }

  return centers;
};

/**
 * Эталонная прямая шага: промежутки между соседними центрами линий, собранные
 * методом наименьших квадратов в линейную зависимость от координаты вдоль
 * линий. Промежуток относится к середине между своими линиями — там он и равен
 * местному шагу.
 *
 * @param image — кадр
 * @param top — первая строка, с которой читается кадр
 * @param bottom — строка, на которой чтение кончается, не включительно
 * @param origin — координата, в которой берётся шаг
 * @returns шаг в начале отсчёта и засев схождения
 */
const measureStepReference = (
  image: SheetImageData,
  top: number,
  bottom: number,
  origin: number
): StepReference => {
  const centers = readLineCenters(image, top, bottom);
  const gaps = centers.slice(1).map((center, index) => {
    const previous = centers[index] || 0;

    return { offset: (center + previous) / 2 - origin, gap: center - previous };
  });
  const meanOffset =
    gaps.reduce((sum, { offset }) => {
      return sum + offset;
    }, 0) / gaps.length;
  const meanGap =
    gaps.reduce((sum, { gap }) => {
      return sum + gap;
    }, 0) / gaps.length;
  let covariance = 0;
  let variance = 0;

  for (const { offset, gap } of gaps) {
    covariance += (offset - meanOffset) * (gap - meanGap);
    variance += (offset - meanOffset) ** 2;
  }

  const slope = covariance / variance;
  const step = meanGap - slope * meanOffset;

  return { step, convergence: slope / step };
};

/**
 * Расстояние между фазой и местом линии по модулю шага: фаза замкнута, поэтому
 * ноль и «шаг без десятой» — соседи, а не противоположности.
 *
 * @param phase — измеренная фаза
 * @param line — место линии в координате вдоль линий
 * @param step — шаг разлиновки
 * @returns расстояние в пикселях, не больше половины шага
 */
const measurePhaseDistance = (phase: number, line: number, step: number): number => {
  const offset = (((phase - line) % step) + step) % step;

  return Math.min(offset, step - offset);
};

describe('measureBandedPeriod: лист с дрейфом шага', () => {
  it('отдаёт шаг в середине области с линиями и засев схождения', () => {
    const image = createSyntheticSheet(DRIFT_SHEET);
    const result = measureBandedPeriod(image, PROBE_OPTIONS);
    /**
     * Начало отсчёта замера — середина между серединами крайних согласившихся
     * полос; на листе, где период нашёлся во всех полосах, это середина кадра.
     */
    const reference = measureStepReference(image, 0, 560, DRIFT_SHEET_ORIGIN);

    expect(result.bandSteps).toHaveLength(DRIFT_SHEET_BANDS);
    expect(result.origin).toBe(DRIFT_SHEET_ORIGIN);
    expect(Math.abs(result.step - reference.step)).toBeLessThanOrEqual(
      STEP_TOLERANCE * reference.step
    );
    expect(Math.abs(result.convergence - reference.convergence)).toBeLessThanOrEqual(
      CONVERGENCE_TOLERANCE * Math.abs(reference.convergence)
    );
  });

  it('ставит фазу на линию у середины области с линиями', () => {
    const image = createSyntheticSheet(DRIFT_SHEET);
    const { step, phase } = measureBandedPeriod(image, PROBE_OPTIONS);
    const anchor = readLineCenters(image, 0, 560).reduce((nearest, center) => {
      return Math.abs(center - 280) < Math.abs(nearest - 280) ? center : nearest;
    });

    expect(step).toBeGreaterThan(0);
    expect(measurePhaseDistance(phase, anchor, step)).toBeLessThanOrEqual(
      PHASE_TOLERANCE * step
    );
  });

  it('держит шаги полос растущим рядом, а не одним числом', () => {
    const { bandSteps } = measureBandedPeriod(
      createSyntheticSheet(DRIFT_SHEET),
      PROBE_OPTIONS
    );

    expect(bandSteps).toHaveLength(DRIFT_SHEET_BANDS);

    for (const [index, step] of bandSteps.entries()) {
      expect(step).toBeGreaterThan(bandSteps[index - 1] || 0);
    }
  });
});

describe('measureBandedPeriod: лист, различимый через одну линию', () => {
  it('сводит удвоенный период верхних полос к шагу линий', () => {
    const image = createSyntheticSheet(HALVED_TOP_SHEET);
    const reference = measureStepReference(image, 360, 720, 360);
    const { step, bandSteps } = measureBandedPeriod(image, PROBE_OPTIONS);

    expect(Math.abs(step - reference.step)).toBeLessThanOrEqual(
      STEP_TOLERANCE * reference.step
    );

    for (const bandStep of bandSteps) {
      expect(Math.abs(bandStep - reference.step)).toBeLessThanOrEqual(
        STEP_TOLERANCE * reference.step
      );
    }
  });

  it('сводит удвоенный период нижних полос к шагу линий', () => {
    const image = createSyntheticSheet(HALVED_BOTTOM_SHEET);
    const reference = measureStepReference(image, 0, 360, 360);
    const { step, bandSteps } = measureBandedPeriod(image, PROBE_OPTIONS);

    expect(Math.abs(step - reference.step)).toBeLessThanOrEqual(
      STEP_TOLERANCE * reference.step
    );

    for (const bandStep of bandSteps) {
      expect(Math.abs(bandStep - reference.step)).toBeLessThanOrEqual(
        STEP_TOLERANCE * reference.step
      );
    }
  });
});

describe('measureBandedPeriod: лист с крупной разлиновкой', () => {
  it('режет кадр с шагом в шестую долю высоты ровно на две полосы', () => {
    const image = createSyntheticSheet(SIXTH_STEP_SHEET);
    const reference = measureStepReference(
      image,
      0,
      COARSE_SHEET_HEIGHT,
      COARSE_SHEET_HEIGHT / 2
    );
    const { step, bandSteps } = measureBandedPeriod(image, PROBE_OPTIONS);

    expect(bandSteps).toHaveLength(2);
    expect(Math.abs(step - reference.step)).toBeLessThanOrEqual(COARSE_STEP_TOLERANCE);
  });

  it('отказывает на шаге в треть высоты: двух полос листу уже мало', () => {
    const { step, bandSteps } = measureBandedPeriod(
      createSyntheticSheet(THIRD_STEP_SHEET),
      PROBE_OPTIONS
    );

    expect(step).toBe(0);
    expect(bandSteps).toEqual([]);
  });
});

describe('measureBandedPeriod: ловушки без разлиновки', () => {
  it('отказывает на полосе печатного текста посреди чистого листа', () => {
    const { step, bandSteps } = measureBandedPeriod(
      createSyntheticSheet(TEXT_TRAP_SHEET),
      PROBE_OPTIONS
    );

    expect(step).toBe(0);
    expect(bandSteps).toEqual([]);
  });

  it('отказывает на полосе текста, занявшей полосы разбивки целиком', () => {
    const { step, bandSteps } = measureBandedPeriod(
      createSyntheticSheet(TALL_TEXT_TRAP_SHEET),
      PROBE_OPTIONS
    );

    expect(step).toBe(0);
    expect(bandSteps).toEqual([]);
  });

  it.each(HALF_RULED_STEPS)(
    'отказывает на листе, где линии есть лишь в половине кадра: шаг %d px',
    (step) => {
      const result = measureBandedPeriod(
        createSyntheticSheet(createHalfRuledSheet(step)),
        PROBE_OPTIONS
      );

      expect(result.step).toBe(0);
      expect(result.bandSteps).toEqual([]);
    }
  );

  it('отказывает на чистом листе', () => {
    const { step, bandSteps } = measureBandedPeriod(
      createSyntheticSheet(BLANK_SHEET),
      PROBE_OPTIONS
    );

    expect(step).toBe(0);
    expect(bandSteps).toEqual([]);
  });
});

/**
 * Лист, у которого шаг даёт пять полос разбивки: высота 560 при шаге 15
 * оставляет в полосе семь с половиной шагов.
 *
 * Пять, а не четыре: медиана контраста считается по полосам с найденным
 * периодом, и при двух вылинявших полосах из четырёх она уехала бы к ним самим
 * — вместе с порогом, который от неё отсчитывается. Из пяти двух слабых
 * медиана не замечает, и порог остаётся отсчитанным от здоровых полос.
 */
const FADED_EDGE_SHEET: SyntheticSheetParams = {
  width: 420,
  height: 560,
  step: 15,
  phase: 7.5,
};

const FADED_EDGE_BANDS = 5;

/**
 * Доля контраста, оставшаяся у линий в крайних полосах: столько держат
 * слабейшие полосы худшего снимка предмета приёмки — у листа, снятого под
 * углом, верх и низ почти без линий.
 *
 * Число выбрано у самого потолка `MIN_BAND_CONTRAST_SHARE`: при пороге 0,14 и
 * выше крайние полосы гребёнку уже не держат, охват падает до трёх пятых, и
 * замер отдаёт нулевой шаг. Так проверка сторожит порог сверху — снизу его
 * держат ловушки, у которых пустые полосы дают 0,004 от медианы.
 */
const FADED_CONTRAST_SHARE = 0.13;

/**
 * Гасит контраст линий в полосе кадра: яркости сводятся к средней по полосе, и
 * от прежнего отклонения остаётся доля `share`.
 *
 * Сжатие живёт в тесте, а не в хелпере синтетики: хелпер описывает лист, а
 * здесь нужна ровно та мера, которой меряет само правило охвата, — отношение
 * контраста полосы к контрасту здоровых полос.
 *
 * @param image — кадр, который правится на месте
 * @param top — первая строка полосы
 * @param bottom — строка, на которой полоса кончается, не включительно
 * @param share — доля контраста, которая остаётся
 */
const fadeBand = (
  image: SheetImageData,
  top: number,
  bottom: number,
  share: number
): void => {
  const { width, luminance } = image;
  const from = top * width;
  const to = bottom * width;
  let sum = 0;

  for (let index = from; index < to; index += 1) {
    sum += luminance[index] || 0;
  }

  const mean = sum / (to - from);

  for (let index = from; index < to; index += 1) {
    luminance[index] = mean + ((luminance[index] || 0) - mean) * share;
  }
};

describe('measureBandedPeriod: потолок доли контраста', () => {
  it('держит шаг листа, у которого крайние полосы вылиняли', () => {
    const image = createSyntheticSheet(FADED_EDGE_SHEET);
    const { height } = image;
    const bandHeight = height / FADED_EDGE_BANDS;
    const reference = measureStepReference(image, 0, height, height / 2);

    fadeBand(image, 0, bandHeight, FADED_CONTRAST_SHARE);
    fadeBand(image, height - bandHeight, height, FADED_CONTRAST_SHARE);

    const { step, bandSteps } = measureBandedPeriod(image, PROBE_OPTIONS);

    expect(bandSteps).toHaveLength(FADED_EDGE_BANDS);
    expect(step).toBeGreaterThan(0);
    expect(Math.abs(step - reference.step)).toBeLessThanOrEqual(
      STEP_TOLERANCE * reference.step
    );
  });
});

/**
 * Кадр листа, у которого шаг разлиновки растёт к обоим краям.
 */
const BULGED_SHEET_WIDTH = 420;

const BULGED_SHEET_HEIGHT = 560;

/**
 * Шаг такого листа в середине кадра — правдоподобная для этого кадра
 * разлиновка: отсечь лист должен разбор шагов по высоте, а не границы шага.
 */
const BULGED_BASE_STEP = 20;

/**
 * Доля, на которую шаг у краёв кадра больше, чем в середине. Тридцать пять
 * сотых держат оба края окна сразу: внутри полосы шаг меняется меньше чем на
 * четверть, и период в ней находится уверенно, а шаги полос уходят от
 * подогнанной прямой почти на десятую долю шага — втрое дальше
 * `MAX_FIT_RESIDUAL`.
 *
 * Гейт линейности проверка сторожит снизу: с порогом в три десятых лист
 * проходит замер и отдаёт шаг около 22 px, потому что остальные правила такую
 * периодичность пропускают — период есть в каждой полосе, полосы смежны, а
 * гребёнка идёт через весь кадр.
 */
const BULGED_STEP_GROWTH = 0.35;

/**
 * Глубина линии, сигма её гауссианы и размах зерна — те же, с которыми рисует
 * листы хелпер синтетики: от настоящего листа ловушка отличается только тем,
 * как расставлены линии.
 */
const BULGED_LINE_DARKNESS = 0.45;

const BULGED_LINE_SIGMA = 1.2;

const BULGED_NOISE = 0.02;

const BULGED_SEED = 7;

/**
 * Рисует кадр, у которого местный шаг разлиновки равен
 * `BULGED_BASE_STEP · (1 + growth · ((y − середина) / полувысота)²)`: линии
 * стоят чаще всего в середине кадра и расходятся к обоим его краям.
 *
 * Растр собирается прямо в тесте, а не хелпером синтетики: хелпер меняет шаг
 * по кадру только монотонно — дрейфом или перспективой, — а здесь нужна ровно
 * та зависимость, которой у перспективы быть не может.
 *
 * @param growth — доля прироста шага у краёв кадра; `0` — шаг по кадру
 *   постоянен
 * @returns полутоновая выжимка кадра
 */
const createBulgedSheet = (growth: number): SheetImageData => {
  const half = BULGED_SHEET_HEIGHT / 2;

  const computeStep = (y: number): number => {
    return BULGED_BASE_STEP * (1 + growth * ((y - half) / half) ** 2);
  };

  const centers: number[] = [];

  for (let y = computeStep(0) / 2; y < BULGED_SHEET_HEIGHT; y += computeStep(y)) {
    centers.push(y);
  }

  const luminance = new Float32Array(BULGED_SHEET_WIDTH * BULGED_SHEET_HEIGHT);
  const random = mulberry32(BULGED_SEED);

  for (let y = 0; y < BULGED_SHEET_HEIGHT; y += 1) {
    const row = y * BULGED_SHEET_WIDTH;
    const ink = centers.reduce((sum, center) => {
      return (
        sum +
        BULGED_LINE_DARKNESS * Math.exp(-0.5 * ((y - center) / BULGED_LINE_SIGMA) ** 2)
      );
    }, 0);

    for (let x = 0; x < BULGED_SHEET_WIDTH; x += 1) {
      const value = 1 - ink + (random() - 0.5) * BULGED_NOISE;

      luminance[row + x] = Math.max(0, Math.min(1, value));
    }
  }

  return { width: BULGED_SHEET_WIDTH, height: BULGED_SHEET_HEIGHT, luminance };
};

describe('measureBandedPeriod: шаги полос, не легшие на прямую', () => {
  it('меряет лист той же сборки, у которого шаг по кадру постоянен', () => {
    const { step, bandSteps } = measureBandedPeriod(createBulgedSheet(0), PROBE_OPTIONS);

    expect(bandSteps.length).toBeGreaterThan(1);
    expect(Math.abs(step - BULGED_BASE_STEP)).toBeLessThanOrEqual(
      STEP_TOLERANCE * BULGED_BASE_STEP
    );
  });

  it('отказывает на листе, где шаг растёт к обоим краям кадра', () => {
    const { step, bandSteps } = measureBandedPeriod(
      createBulgedSheet(BULGED_STEP_GROWTH),
      PROBE_OPTIONS
    );

    expect(step).toBe(0);
    expect(bandSteps).toEqual([]);
  });
});

/**
 * Лист с настоящей разлиновкой, у которого середину кадра занимает пустая
 * вставка — наклеенная фотография во всю ширину листа.
 */
const INSERT_SHEET_STEP = 20;

const INSERT_SHEET: SyntheticSheetParams = {
  width: 420,
  height: 560,
  step: INSERT_SHEET_STEP,
  phase: INSERT_SHEET_STEP / 2,
  noise: 0.02,
  seed: 9,
};

/**
 * Края вставки. Стоит она посреди кадра и заходит в обе средние полосы
 * разбивки ровно наполовину: в верхней гасит нижнюю половину, в нижней —
 * верхнюю. Полоса с гребёнкой в одной своей половине период не отдаёт
 * (`MIN_COMB_SUPPORT_SHARE`), и разлиновка остаётся найденной ровно в двух
 * крайних полосах — несмежных.
 *
 * Отказать на таком листе может только требование двух соседних полос:
 * половинный контраст средних полос охват гребёнки по кадру считает своим,
 * прямая же через две точки проходит всегда. Со снятым требованием лист
 * проходит замер и отдаёт шаг около 20 px.
 */
const INSERT_TOP = 210;

const INSERT_BOTTOM = 350;

/**
 * Доля контраста, оставшаяся во вставке: ноль — ровная бумага без линий и без
 * зерна.
 */
const INSERT_CONTRAST_SHARE = 0;

describe('measureBandedPeriod: разлиновка в несмежных полосах', () => {
  it('меряет тот же лист без вставки', () => {
    const { step } = measureBandedPeriod(
      createSyntheticSheet(INSERT_SHEET),
      PROBE_OPTIONS
    );

    expect(Math.abs(step - INSERT_SHEET_STEP)).toBeLessThanOrEqual(
      STEP_TOLERANCE * INSERT_SHEET_STEP
    );
  });

  it('отказывает на листе, у которого середину кадра занимает пустая вставка', () => {
    const image = createSyntheticSheet(INSERT_SHEET);

    fadeBand(image, INSERT_TOP, INSERT_BOTTOM, INSERT_CONTRAST_SHARE);

    const { step, bandSteps } = measureBandedPeriod(image, PROBE_OPTIONS);

    expect(step).toBe(0);
    expect(bandSteps).toEqual([]);
  });
});

describe('measureBandedPeriod: повторяемость', () => {
  it('отдаёт по одной выжимке те же числа до бита', () => {
    const image = createSyntheticSheet(DRIFT_SHEET);

    expect(measureBandedPeriod(image, PROBE_OPTIONS)).toStrictEqual(
      measureBandedPeriod(image, PROBE_OPTIONS)
    );
  });

  it('повторяется и там, где разбивку решает оценка по кадру целиком', () => {
    const image = createSyntheticSheet(SIXTH_STEP_SHEET);

    expect(measureBandedPeriod(image, PROBE_OPTIONS)).toStrictEqual(
      measureBandedPeriod(image, PROBE_OPTIONS)
    );
  });

  it('не трогает переданную выжимку', () => {
    const image = createSyntheticSheet(DRIFT_SHEET);
    const before = Float32Array.from(image.luminance);

    measureBandedPeriod(image, PROBE_OPTIONS);

    expect(image.luminance).toStrictEqual(before);
  });
});
