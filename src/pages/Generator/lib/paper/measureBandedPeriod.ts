import { detectRowSkewAngle, MAX_SKEW_ANGLE, SKEW_ANGLE_STEP } from './detectSkewAngle';
import { ANALYSIS_IMAGE_SIZE } from './downsampleSheetImage';
import type { SheetImageData } from './paper.types';
import { measureProfilePeriod } from './profilePeriod';
import { buildShearedProfile, detrendProfile, type ShearedProfile } from './sheetProfile';

/**
 * Период разлиновки, сведённый из полос кадра.
 */
export type BandedPeriod = {
  /**
   * Шаг разлиновки в середине области с линиями, в пикселях кадра. `0` —
   * замер отказал: полосы не согласились между собой либо периода в них нет.
   */
  step: number;

  /**
   * Смещение линий по модулю шага в координате вдоль линий кадра, от нуля
   * включительно до шага. Отсчитано от линии, ближайшей к середине области с
   * линиями: на листе с дрейфом гребёнка верна только рядом со своим якорем.
   */
  phase: number;

  /**
   * Наклон разлиновки в градусах — тот, на котором измерена `phase`. Наклон и
   * фаза идут парой: координата вдоль линий зависит от наклона, и фаза с
   * чужим углом указывает мимо линий. `0` при отказе.
   */
  skewAngle: number;

  /**
   * Засев схождения `k` из `step(u) = step₀·(1 + k·u)`, 1/px. Координата `u`
   * отсчитывается вдоль линий от `origin`. `0` — шаг по кадру не меняется.
   */
  convergence: number;

  /**
   * Начало отсчёта координаты вдоль линий, от которого взяты `step` и
   * `convergence`, в пикселях кадра: середина области с линиями в столбце
   * `x = 0`.
   *
   * Уходит наружу вместе со схождением, потому что потребитель отсчитывает
   * свою координату от середины кадра: перенос `step(u)` с чужим началом
   * ошибается на `k·Δ`, а `Δ` у листа с линиями в части кадра — не ноль. `0`
   * при отказе.
   */
  origin: number;

  /**
   * Шаги согласившихся полос сверху вниз, в пикселях кадра, после сведения
   * кратных. Пусто при отказе.
   */
  bandSteps: number[];
};

/**
 * Настройки полосового замера периода.
 */
export type BandedPeriodOptions = {
  /**
   * Наименьший допустимый шаг разлиновки в пикселях.
   */
  minStep: number;

  /**
   * Наибольший допустимый шаг разлиновки в пикселях. Мера — сторона кадра, а
   * не полосы: полоса режется поперёк линий, и шаг в ней тот же, что в кадре.
   * Период длиннее половины полосы всё равно не измерить, и его отсекает сам
   * `measureProfilePeriod`.
   */
  maxStep: number;

  /**
   * Порог уверенности, начиная с которого период полосы считается найденным.
   */
  confidenceThreshold: number;

  /**
   * Половина диапазона свипа наклона в градусах.
   */
  maxAngle?: number;

  /**
   * Шаг свипа наклона в градусах.
   */
  angleStep?: number;

  /**
   * Предел длинной стороны уменьшенной копии, на которой ищется наклон полосы.
   */
  maxAnalysisSize?: number;
};

/**
 * Период одной полосы вместе с её местом в кадре.
 */
type BandMeasurement = {
  /**
   * Номер полосы сверху вниз. Нужен соседству: полосы без периода в список не
   * попадают, и по их месту в нём соседей не различить.
   */
  index: number;

  /**
   * Верх полосы в пикселях кадра.
   */
  top: number;

  /**
   * Координата середины полосы вдоль линий: у полосы во всю ширину кадра это
   * её середина по высоте, потому что координата берётся в столбце `x = 0`.
   */
  center: number;

  /**
   * Шаг полосы в пикселях кадра после сведения кратных.
   */
  step: number;

  /**
   * Смещение линий по модулю шага полосы, отсчитанное от верха полосы.
   */
  phase: number;

  /**
   * Наклон линий в полосе в градусах.
   */
  skewAngle: number;
};

/**
 * Прямая `step(u) = intercept + slope·(u − origin)`, подогнанная по шагам
 * полос.
 */
type StepLine = {
  /**
   * Шаг в начале отсчёта, в пикселях кадра.
   */
  intercept: number;

  /**
   * Прирост шага на пиксель координаты вдоль линий.
   */
  slope: number;
};

const EMPTY_BANDED_PERIOD: BandedPeriod = {
  step: 0,
  phase: 0,
  skewAngle: 0,
  convergence: 0,
  origin: 0,
  bandSteps: [],
};

/**
 * Сколько шагов разлиновки оставляет в полосе разбивка. Столько автокорреляция
 * просит, чтобы отличить период от склона профиля; больше — полоса начинает
 * захватывать дрейф шага, ради которого разбивка и делается.
 *
 * На кадре с тетрадной разлиновкой, где шаг — тридцатая доля высоты, отсюда
 * выходят четыре полосы: именно та разбивка, на которой замерены пороги
 * согласия.
 */
const TARGET_BAND_STEPS = 7;

/**
 * Число полос, когда грубой оценки шага нет: периода в кадре целиком не видно
 * совсем. Разбивка тогда произвольна, и четыре — середина диапазона, в котором
 * замер вообще работает.
 */
const DEFAULT_BAND_COUNT = 4;

/**
 * Наименьшее число полос: ниже двух сводить нечего, и замер отказывает.
 *
 * Оно же — нижняя граница разбивки у листа с крупной разлиновкой. Шаг длиннее
 * половины полосы не ищется (`measureProfilePeriod` режет сдвиги по половине
 * профиля), поэтому лист, которому мало и двух полос, отказывает сам — в
 * полосах не находится периода, — а не по отдельному правилу.
 */
const MIN_BAND_COUNT = 2;

/**
 * Наибольшая невязка подгонки `step(u)` в долях шага. Шаги полос настоящей
 * разлиновки ложатся на прямую с точностью самого измерения — доли процента;
 * три сотых оставляют запас на короткую полосу и отсекают случайную
 * периодичность, которая в монотонный ряд по высоте не выстраивается.
 */
const MAX_FIT_RESIDUAL = 0.03;

/**
 * Наибольшая кратность, которую проверяют при сведении шагов полос к одному
 * семейству. Та же, что внутри профиля: на разлиновке различимой остаётся
 * каждая вторая линия, изредка каждая третья, а дальше по снимку нечего
 * мерить.
 */
const MAX_HARMONIC_ORDER = 5;

/**
 * Границы, в которых частное шага полосы и наименьшего из найденных шагов
 * считается тем же семейством. Нижняя — запас на измерение: шаг полосы не
 * бывает меньше наименьшего больше чем на его же погрешность. Верхняя —
 * полуторный дрейф шага по кадру: лист, у которого шаг по высоте меняется
 * сильнее, модель перспективы всё равно не опишет, а кратность на такой доле
 * уже не отличить от настоящего шага.
 */
const MIN_FAMILY_RATIO = 0.95;

const MAX_FAMILY_RATIO = 1.5;

/**
 * Кратность, на которую делится шаг полосы, чтобы попасть в семейство
 * наименьшего шага. Кратности перебираются от меньшей к большей: у полосы,
 * попавшей сразу в две (частное на границе семейства), меньшая кратность —
 * осторожный выбор, она не дробит шаг сильнее необходимого.
 *
 * @param step — шаг полосы
 * @param baseStep — наименьший шаг среди полос
 * @returns кратность; `1` — шаг уже в семействе либо ни одна кратность не подходит
 */
const findHarmonicOrder = (step: number, baseStep: number): number => {
  for (let order = 2; order <= MAX_HARMONIC_ORDER; order += 1) {
    const ratio = step / (order * baseStep);

    if (ratio >= MIN_FAMILY_RATIO && ratio <= MAX_FAMILY_RATIO) {
      return order;
    }
  }

  return 1;
};

/**
 * Сводит шаги полос к одному семейству: шаг, кратный наименьшему из найденных,
 * делится на свою кратность. На клетке соседние полосы видят то шаг линий, то
 * удвоенный, и без сведения выбор между ними решала бы разбивка на полосы.
 *
 * Фаза переживает деление без пересчёта: линии, различимые через одну, — часть
 * той же гребёнки, и их смещение по модулю меньшего шага указывает на линию.
 *
 * @param bands — периоды полос по порядку сверху вниз
 * @returns полосы с шагами одного семейства
 */
const toSingleFamily = (bands: BandMeasurement[]): BandMeasurement[] => {
  const baseStep = bands.reduce((smallest, band) => {
    return Math.min(smallest, band.step);
  }, Number.POSITIVE_INFINITY);

  return bands.map((band) => {
    const order = findHarmonicOrder(band.step, baseStep);

    if (order === 1) {
      return band;
    }

    const step = band.step / order;

    return { ...band, step, phase: band.phase % step };
  });
};

/**
 * Есть ли среди полос с найденным периодом две соседние. Это и есть условие
 * «разлиновка найдена»: тетрадь на столе снята так, что крайние полосы
 * приходятся на поверхность вокруг листа и на ушедший из резкости дальний
 * край, а разлиновка живёт в середине кадра.
 *
 * Оговорка «не меньше трёх полос из четырёх» — частный случай этого же
 * условия, а не вторая проверка: три найденные полосы из четырёх всегда
 * содержат пару соседних, и так при любом числе полос, потому что три
 * четверти больше половины. Единственное, что условие отсекает, — россыпь
 * одиночных полос без соседей: случайную периодичность в разных углах кадра.
 *
 * @param bands — полосы с найденным периодом по порядку сверху вниз
 * @returns признак соседства
 */
const hasAdjacentBands = (bands: BandMeasurement[]): boolean => {
  return bands.some(({ index }, position) => {
    const previous = bands[position - 1];

    return previous !== undefined && index - previous.index === 1;
  });
};

/**
 * Подгоняет шаг как линейную функцию координаты вдоль линий методом
 * наименьших квадратов.
 *
 * @param bands — полосы с шагами одного семейства
 * @param origin — координата, в которой берётся шаг
 * @returns прямая шага; `null` — полосы стоят в одной точке, наклона из них не выйдет
 */
const fitStepLine = (bands: BandMeasurement[], origin: number): StepLine | null => {
  let sumOffset = 0;
  let sumStep = 0;

  for (const { center, step } of bands) {
    sumOffset += center - origin;
    sumStep += step;
  }

  const meanOffset = sumOffset / bands.length;
  const meanStep = sumStep / bands.length;
  let covariance = 0;
  let variance = 0;

  for (const { center, step } of bands) {
    const offset = center - origin - meanOffset;

    covariance += offset * (step - meanStep);
    variance += offset ** 2;
  }

  if (variance <= 0) {
    return null;
  }

  const slope = covariance / variance;

  return { intercept: meanStep - slope * meanOffset, slope };
};

/**
 * Ложатся ли шаги полос на одну прямую: наибольшее относительное отклонение
 * шага полосы от подгонки не больше `MAX_FIT_RESIDUAL`.
 *
 * @param bands — полосы с шагами одного семейства
 * @param line — подогнанная прямая шага
 * @param origin — координата начала отсчёта прямой
 * @returns признак согласия
 */
const isLinearFit = (
  bands: BandMeasurement[],
  { intercept, slope }: StepLine,
  origin: number
): boolean => {
  return bands.every(({ center, step }) => {
    const fitted = intercept + slope * (center - origin);

    return fitted > 0 && Math.abs(step - fitted) <= MAX_FIT_RESIDUAL * fitted;
  });
};

/**
 * Полоса, ближайшая к началу отсчёта: её фаза и наклон уходят в итог.
 *
 * @param bands — полосы по порядку сверху вниз
 * @param origin — координата начала отсчёта
 * @returns ближайшая полоса
 */
const findAnchorBand = (bands: BandMeasurement[], origin: number): BandMeasurement => {
  return bands.reduce((anchor, band) => {
    return Math.abs(band.center - origin) < Math.abs(anchor.center - origin)
      ? band
      : anchor;
  });
};

/**
 * Фаза итоговой гребёнки: линия опорной полосы, ближайшая к началу отсчёта,
 * взятая по модулю итогового шага.
 *
 * Гребёнка привязывается к линии у середины области с линиями, а не к верху
 * опорной полосы: на листе с дрейфом шаг полосы и итоговый шаг расходятся, и
 * за полполосы пути расхождение накопилось бы в заметную долю шага.
 *
 * @param anchor — опорная полоса
 * @param origin — координата начала отсчёта
 * @param step — итоговый шаг
 * @returns смещение линий по модулю шага, от нуля включительно до шага
 */
const computeAnchoredPhase = (
  anchor: BandMeasurement,
  origin: number,
  step: number
): number => {
  const first = anchor.top + anchor.phase;
  const index = Math.round((origin - first) / anchor.step);
  const line = first + index * anchor.step;

  return ((line % step) + step) % step;
};

/**
 * Наименьшая доля, которую вносит в контраст гребёнки слабейшая половина
 * полосы. Настоящая разлиновка идёт через всю полосу, и половины дают равный
 * вклад — на живых снимках предмета приёмки слабейшая половина держит от 0,41
 * до 1,0. Источник периодичности, занявший клочок полосы, во второй половине
 * не даёт ничего: там гребёнка ложится на чистую бумагу.
 *
 * Без этой проверки полоса печатного текста посреди чистого листа отдаёт
 * настоящий период: автокорреляция видит его на своих строках и не знает, что
 * остальная полоса пуста. Разбор по высоте кадра её не ловит — на крупной
 * разбивке таких полос всего две, а прямая через две точки проходит всегда.
 */
const MIN_COMB_SUPPORT_SHARE = 0.3;

/**
 * Контраст гребёнки на участке профиля: насколько её узлы темнее промежутков
 * между ними. Мера относительная, поэтому глубина линий и яркость бумаги из
 * неё уходят, а рукописный текст, который темнее любой линии, контраста не
 * задирает — он попадает и в узлы, и в промежутки.
 *
 * @param detrended — выровненный профиль полосы
 * @param profile — профиль полосы, от которого отсчитываются координаты
 * @param step — найденный шаг в отсчётах профиля
 * @param phase — найденная фаза в координатах профиля
 * @param from — первый отсчёт участка
 * @param to — последний отсчёт участка
 * @returns контраст; `0` — узлов или промежутков на участке не нашлось
 */
const measureCombContrast = (
  detrended: Float64Array,
  profile: ShearedProfile,
  step: number,
  phase: number,
  from: number,
  to: number
): number => {
  const { origin } = profile;
  const first = Math.ceil((origin + from - phase) / step);
  const last = Math.floor((origin + to - phase) / step);
  let nodeSum = 0;
  let nodeCount = 0;
  let gapSum = 0;
  let gapCount = 0;

  for (let node = first; node <= last; node += 1) {
    const nodeBin = Math.round(phase + node * step - origin);
    const gapBin = Math.round(phase + (node + 0.5) * step - origin);
    const nodeValue = detrended[nodeBin];
    const gapValue = detrended[gapBin];

    if (nodeValue !== undefined && nodeBin >= from && nodeBin <= to) {
      nodeSum += nodeValue;
      nodeCount += 1;
    }

    if (gapValue !== undefined && gapBin >= from && gapBin <= to) {
      gapSum += gapValue;
      gapCount += 1;
    }
  }

  if (nodeCount === 0 || gapCount === 0) {
    return 0;
  }

  return gapSum / gapCount - nodeSum / nodeCount;
};

/**
 * Доля контраста гребёнки, которую держит слабейшая половина полосы. Единица —
 * половины равноправны, ноль и меньше — в одной из них гребёнке не на что
 * ложиться.
 *
 * @param profile — профиль полосы
 * @param step — найденный шаг в отсчётах профиля
 * @param phase — найденная фаза в координатах профиля
 * @returns доля; `0` — контраста у гребёнки нет совсем
 */
const measureCombSupport = (
  profile: ShearedProfile,
  step: number,
  phase: number
): number => {
  const size = profile.values.length;
  const detrended = detrendProfile(profile.values, 2 * Math.round(step) + 1);
  const whole = measureCombContrast(detrended, profile, step, phase, 0, size - 1);

  if (whole <= 0) {
    return 0;
  }

  const middle = Math.round(size / 2);
  const top = measureCombContrast(detrended, profile, step, phase, 0, middle - 1);
  const bottom = measureCombContrast(detrended, profile, step, phase, middle, size - 1);

  return Math.min(top, bottom) / whole;
};

/**
 * Период одной полосы: свой свип наклона, свой профиль, свой период. Полоса
 * меряется как маленький кадр — иначе дрейф шага по высоте размыл бы профиль
 * ровно там, где его и надо измерить.
 *
 * @param image — полутоновая выжимка кадра
 * @param index — номер полосы сверху вниз
 * @param bandCount — число полос, на которые режется кадр
 * @param options — настройки замера
 * @returns период полосы; `null` — периода в полосе нет
 */
const measureBand = (
  image: SheetImageData,
  index: number,
  bandCount: number,
  options: BandedPeriodOptions
): BandMeasurement | null => {
  const top = Math.round((image.height * index) / bandCount);
  const bottom = Math.round((image.height * (index + 1)) / bandCount);
  const {
    minStep,
    maxStep,
    confidenceThreshold,
    maxAngle = MAX_SKEW_ANGLE,
    angleStep = SKEW_ANGLE_STEP,
    maxAnalysisSize = ANALYSIS_IMAGE_SIZE,
  } = options;
  const { width, luminance } = image;
  /**
   * Полоса — вид на строки кадра, а не их копия: она во всю ширину, поэтому её
   * строки лежат в `luminance` подряд.
   */
  const band: SheetImageData = {
    width,
    height: bottom - top,
    luminance: luminance.subarray(top * width, bottom * width),
  };
  const skewAngle = detectRowSkewAngle(band, { maxAngle, angleStep, maxAnalysisSize });
  const profile = buildShearedProfile(band, 'horizontal', skewAngle, Math.abs(skewAngle));
  const period = measureProfilePeriod(profile, minStep, maxStep);

  if (period.step <= 0 || period.confidence < confidenceThreshold) {
    return null;
  }

  if (measureCombSupport(profile, period.step, period.phase) < MIN_COMB_SUPPORT_SHARE) {
    return null;
  }

  return {
    index,
    top,
    center: top + band.height / 2,
    step: period.step,
    phase: period.phase,
    skewAngle,
  };
};

/**
 * Запасная оценка шага — по кадру целиком: свой свип наклона, свой профиль,
 * свой период. Уверенность не спрашивается: её у такого профиля нет по той же
 * причине, по которой заведены полосы.
 *
 * Роль у оценки одна — крупная разлиновка, которой мало четырёх полос. Там
 * профиль кадра не размыт (дрейфу негде накопиться на пяти-шести линиях), и
 * шаг в нём виден.
 *
 * @param image — полутоновая выжимка кадра
 * @param options — настройки замера
 * @returns шаг в пикселях кадра; `0` — периода в кадре не видно совсем
 */
const estimateFrameStep = (
  image: SheetImageData,
  options: BandedPeriodOptions
): number => {
  const {
    minStep,
    maxStep,
    maxAngle = MAX_SKEW_ANGLE,
    angleStep = SKEW_ANGLE_STEP,
    maxAnalysisSize = ANALYSIS_IMAGE_SIZE,
  } = options;
  const skewAngle = detectRowSkewAngle(image, { maxAngle, angleStep, maxAnalysisSize });
  const profile = buildShearedProfile(
    image,
    'horizontal',
    skewAngle,
    Math.abs(skewAngle)
  );

  return measureProfilePeriod(profile, minStep, maxStep).step;
};

/**
 * Число полос, на которое режется кадр: столько, чтобы в полосе осталось
 * `TARGET_BAND_STEPS` шагов разлиновки.
 *
 * Жёсткая разбивка не годится обоим краям. Крупной разлиновке четыре полосы
 * оставляют в полосе полтора шага, и периода в ней нет; мелкой — два десятка
 * шагов, то есть весь дрейф внутри полосы, ради дробления которого полосы и
 * нужны.
 *
 * @param height — высота кадра в пикселях
 * @param roughStep — грубая оценка шага в пикселях кадра
 * @returns число полос, не меньше `MIN_BAND_COUNT`
 */
const resolveBandCount = (height: number, roughStep: number): number => {
  return Math.max(MIN_BAND_COUNT, Math.floor(height / (TARGET_BAND_STEPS * roughStep)));
};

/**
 * Меряет период по заданной разбивке кадра на полосы.
 *
 * @param image — полутоновая выжимка фотографии листа
 * @param options — настройки замера
 * @param bandCount — число полос
 * @returns шаг в середине области с линиями вместе с фазой, наклоном и засевом
 *   схождения; нулевой шаг — полосы не согласились
 */
const measureWithBandCount = (
  image: SheetImageData,
  options: BandedPeriodOptions,
  bandCount: number
): BandedPeriod => {
  if (image.height < bandCount) {
    return EMPTY_BANDED_PERIOD;
  }

  const bands: BandMeasurement[] = [];

  for (let index = 0; index < bandCount; index += 1) {
    const band = measureBand(image, index, bandCount, options);

    if (band !== null) {
      bands.push(band);
    }
  }

  if (!hasAdjacentBands(bands)) {
    return EMPTY_BANDED_PERIOD;
  }

  const family = toSingleFamily(bands);
  const first = family[0];
  const last = family[family.length - 1];

  if (!first || !last) {
    return EMPTY_BANDED_PERIOD;
  }

  /**
   * Середина области с линиями: полосы без периода в неё не входят, поэтому у
   * листа с линиями в части кадра начало отсчёта садится в середину именно
   * этой части.
   */
  const origin = (first.center + last.center) / 2;
  const line = fitStepLine(family, origin);

  if (!line || line.intercept <= 0 || !isLinearFit(family, line, origin)) {
    return EMPTY_BANDED_PERIOD;
  }

  const anchor = findAnchorBand(family, origin);

  return {
    step: line.intercept,
    phase: computeAnchoredPhase(anchor, origin, line.intercept),
    skewAngle: anchor.skewAngle,
    convergence: line.slope / line.intercept,
    origin,
    bandSteps: family.map(({ step }) => {
      return step;
    }),
  };
};

/**
 * Меряет период разлиновки по полосам кадра, нарезанным поперёк линий, и
 * сводит их в зависимость шага от координаты вдоль линий.
 *
 * Полосы нужны там, где равномерной гребёнки на весь кадр не существует: у
 * листа, снятого лежащим на столе, шаг по кадру плывёт, общий профиль
 * размывается, и глобальный замер отдаёт низкую уверенность. Внутри полосы
 * дрейф мал, период виден, а по шагам полос видно и сам дрейф — его наклон
 * уходит засевом в поиск перспективы.
 *
 * Итог полос — не среднее: шаги подгоняются прямой по высоте, и разлиновка
 * считается найденной, только если они на неё легли. Случайная периодичность —
 * тень, текстура, полоса текста — в монотонный ряд по высоте кадра не
 * выстраивается.
 *
 * Разбивка выводится из шага, а шаг — из разбивки, поэтому замер идёт в два
 * захода: разбивка по умолчанию даёт грубую оценку, из неё выходит число полос
 * с `TARGET_BAND_STEPS` шагами в каждой, и на нём кадр меряется заново.
 * Оценка по кадру целиком стоит только запасным ходом: на листе, ради которого
 * полосы и заведены, общий профиль размыт дрейфом и отдаёт шаг втрое-впятеро
 * меньше настоящего — разбивка из него выходит на два десятка полос, и мерить
 * в них уже нечего. Верна она там, где отказывает разбивка по умолчанию, — на
 * крупной разлиновке, где в полосу не помещается и двух шагов.
 *
 * Все длины — в пикселях переданного изображения.
 *
 * @param image — полутоновая выжимка фотографии листа
 * @param options — настройки замера
 * @returns шаг в середине области с линиями вместе с фазой, наклоном и засевом
 *   схождения; нулевой шаг — полосы не согласились
 */
export const measureBandedPeriod = (
  image: SheetImageData,
  options: BandedPeriodOptions
): BandedPeriod => {
  const coarse = measureWithBandCount(image, options, DEFAULT_BAND_COUNT);
  const roughStep = coarse.step || estimateFrameStep(image, options);

  if (roughStep <= 0) {
    return EMPTY_BANDED_PERIOD;
  }

  const bandCount = resolveBandCount(image.height, roughStep);

  return bandCount === DEFAULT_BAND_COUNT
    ? coarse
    : measureWithBandCount(image, options, bandCount);
};
