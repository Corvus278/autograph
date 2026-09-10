import { detrendProfile, refinePeakOffset, type ShearedProfile } from './sheetProfile';

/**
 * Период, найденный в профиле яркости.
 */
export type ProfilePeriod = {
  /**
   * Расстояние между соседними линиями в отсчётах профиля. `0` — период не
   * найден.
   */
  step: number;

  /**
   * Смещение линий по модулю шага, от нуля включительно до шага. Отсчитывается
   * от начала координат профиля, а не от его нулевого бина.
   */
  phase: number;

  /**
   * Превышение пика автокорреляции над её средним уровнем, от 0 до 1.
   */
  confidence: number;
};

const EMPTY_PERIOD: ProfilePeriod = { step: 0, phase: 0, confidence: 0 };

/**
 * Доля от главного пика, начиная с которой корреляция на вдвое-впятеро меньшем
 * сдвиге считается настоящим шагом, а главный пик — его кратным. Гребёнка линий
 * даёт одинаково высокие пики на всех кратных шага, и без этой проверки на
 * дробном шаге легко принять двойной за одинарный: у двойного сдвиг попадает в
 * целое число отсчётов, у одинарного — между ними. Восемь десятых — запас на
 * затухание корреляции с ростом сдвига: у настоящей разлиновки пики кратных
 * почти равны, у случайного совпадения — нет.
 */
const HARMONIC_MATCH_RATIO = 0.8;

/**
 * Наибольшая кратность, которую проверяют при поиске настоящего шага. Пятикратный
 * промах автокорреляции на реальной разлиновке не встречается, а расширение
 * диапазона начинает ловить шум на малых сдвигах.
 */
const MAX_HARMONIC_ORDER = 5;

/**
 * Полуширина окрестности, в которой шаг уточняется по спектру, в отсчётах.
 * Автокорреляция даёт шаг с точностью до целого сдвига, поэтому уточнять
 * дальше полутора отсчётов нечего.
 */
const REFINE_RADIUS = 1.5;

/**
 * Число проб при уточнении шага по спектру. Триста проб на трёх отсчётах —
 * сотая доля отсчёта, что мельче точности самого измерения.
 */
const REFINE_SAMPLES = 300;

const TWO_PI = 2 * Math.PI;

const computeMeanEnergy = (detrended: Float64Array): number => {
  let energy = 0;

  for (let index = 0; index < detrended.length; index += 1) {
    energy += (detrended[index] || 0) ** 2;
  }

  return detrended.length > 0 ? energy / detrended.length : 0;
};

/**
 * Автокорреляция на дробном сдвиге: сдвинутый ряд берётся линейной
 * интерполяцией. Дробный сдвиг нужен именно здесь: шаг разлиновки на
 * фотографии почти никогда не целый, и на целых сдвигах пик одинарного шага
 * проседает сильнее, чем пик двойного, — двойной случайно попадает ближе к
 * целому.
 */
const computeCorrelationAt = (
  detrended: Float64Array,
  meanEnergy: number,
  lag: number
): number => {
  const size = detrended.length;
  const base = Math.floor(lag);
  const fraction = lag - base;
  let sum = 0;
  let count = 0;

  for (let index = 0; index + base + 1 < size; index += 1) {
    const shifted =
      (detrended[index + base] || 0) * (1 - fraction) +
      (detrended[index + base + 1] || 0) * fraction;

    sum += (detrended[index] || 0) * shifted;
    count += 1;
  }

  if (count === 0 || meanEnergy <= 0) {
    return 0;
  }

  return sum / count / meanEnergy;
};

const computeAutocorrelation = (
  detrended: Float64Array,
  meanEnergy: number,
  maxLag: number
): Float64Array => {
  const size = detrended.length;
  const correlation = new Float64Array(maxLag + 1);

  if (meanEnergy <= 0) {
    return correlation;
  }

  correlation[0] = 1;

  for (let lag = 1; lag <= maxLag; lag += 1) {
    let sum = 0;

    for (let index = 0; index + lag < size; index += 1) {
      sum += (detrended[index] || 0) * (detrended[index + lag] || 0);
    }

    correlation[lag] = sum / (size - lag) / meanEnergy;
  }

  return correlation;
};

const isLocalPeak = (correlation: Float64Array, lag: number): boolean => {
  return (
    (correlation[lag] || 0) > (correlation[lag - 1] || 0) &&
    (correlation[lag] || 0) >= (correlation[lag + 1] || 0)
  );
};

/**
 * Ищет сдвиг, на котором профиль повторяет сам себя. Сначала берётся самый
 * высокий настоящий пик на целых сдвигах, потом проверяется, не кратен ли он
 * настоящему шагу: корреляция на дробных долях этого сдвига считается заново с
 * интерполяцией.
 *
 * @param correlation — автокорреляция на целых сдвигах
 * @param detrended — профиль без низких частот
 * @param meanEnergy — средний квадрат отсчёта профиля
 * @param minLag — наименьший допустимый сдвиг
 * @param maxLag — наибольший допустимый сдвиг
 * @returns сдвиг, возможно дробный; `-1` — настоящего пика нет
 */
const findFundamentalLag = (
  correlation: Float64Array,
  detrended: Float64Array,
  meanEnergy: number,
  minLag: number,
  maxLag: number
): number => {
  let bestLag = -1;
  let bestValue = Number.NEGATIVE_INFINITY;

  for (let lag = minLag; lag < maxLag; lag += 1) {
    const value = correlation[lag] || 0;

    if (value > bestValue && isLocalPeak(correlation, lag)) {
      bestValue = value;
      bestLag = lag;
    }
  }

  if (bestLag < 0) {
    return -1;
  }

  const bestCorrelation = computeCorrelationAt(detrended, meanEnergy, bestLag);

  for (let order = MAX_HARMONIC_ORDER; order >= 2; order -= 1) {
    const candidate = bestLag / order;
    const isHarmonic =
      candidate >= minLag &&
      computeCorrelationAt(detrended, meanEnergy, candidate) >=
        HARMONIC_MATCH_RATIO * bestCorrelation;

    if (isHarmonic) {
      return candidate;
    }
  }

  return bestLag;
};

const computeSpectrumMagnitude = (detrended: Float64Array, step: number): number => {
  const frequency = TWO_PI / step;
  let cosine = 0;
  let sine = 0;

  for (let index = 0; index < detrended.length; index += 1) {
    const angle = index * frequency;
    const value = detrended[index] || 0;

    cosine += value * Math.cos(angle);
    sine += value * Math.sin(angle);
  }

  return Math.hypot(cosine, sine);
};

/**
 * Уточняет шаг по спектру: целый сдвиг автокорреляции заменяется положением
 * вершины спектральной амплитуды рядом с ним. Гармоника усредняет фазу по всей
 * длине профиля, поэтому дробную часть шага видно даже там, где отдельные
 * линии размыты.
 */
const refineStep = (detrended: Float64Array, peakLag: number): number => {
  const from = Math.max(1, peakLag - REFINE_RADIUS);
  const to = peakLag + REFINE_RADIUS;
  const magnitudes = new Float64Array(REFINE_SAMPLES + 1);
  let bestIndex = 0;

  for (let index = 0; index <= REFINE_SAMPLES; index += 1) {
    const step = from + ((to - from) * index) / REFINE_SAMPLES;

    magnitudes[index] = computeSpectrumMagnitude(detrended, step);

    if ((magnitudes[index] || 0) > (magnitudes[bestIndex] || 0)) {
      bestIndex = index;
    }
  }

  const spacing = (to - from) / REFINE_SAMPLES;
  const isInside = bestIndex > 0 && bestIndex < REFINE_SAMPLES;
  const offset = isInside
    ? refinePeakOffset(
        magnitudes[bestIndex - 1] || 0,
        magnitudes[bestIndex] || 0,
        magnitudes[bestIndex + 1] || 0
      )
    : 0;

  return from + (bestIndex + offset) * spacing;
};

const computePhase = (detrended: Float64Array, origin: number, step: number): number => {
  const frequency = TWO_PI / step;
  let cosine = 0;
  let sine = 0;

  for (let index = 0; index < detrended.length; index += 1) {
    const angle = (index + origin) * frequency;
    const value = detrended[index] || 0;

    cosine += value * Math.cos(angle);
    sine += value * Math.sin(angle);
  }

  const phase = (Math.atan2(-sine, -cosine) / TWO_PI) * step;

  return ((phase % step) + step) % step;
};

/**
 * Фон вокруг пика: среднее автокорреляции по одному периоду с центром на пике.
 *
 * Местный фон, а не средний уровень по всему диапазону: у профиля без
 * разлиновки автокорреляция спадает от единицы монотонно, и её значение на
 * любом сдвиге сильно выше среднего по диапазону — такой «пик» не отличить от
 * настоящего. Среднее же по окрестности повторяет спад, и настоящим остаётся
 * только тот пик, который поднимается над своими соседями.
 */
const computeLocalBackground = (
  correlation: Float64Array,
  peakLag: number,
  maxLag: number
): number => {
  const from = Math.max(1, Math.round(peakLag * 0.5));
  const to = Math.min(maxLag, Math.round(peakLag * 1.5));
  let sum = 0;

  for (let index = from; index <= to; index += 1) {
    sum += correlation[index] || 0;
  }

  return to >= from ? sum / (to - from + 1) : 0;
};

/**
 * Ищет в профиле яркости правильную последовательность провалов: шаг —
 * автокорреляцией с уточнением по спектру, фазу — гармоникой на найденном
 * шаге, уверенность — превышением пика автокорреляции над её средним уровнем.
 *
 * Пик берётся только настоящий, с провалами по обе стороны: у профиля без
 * разлиновки автокорреляция монотонно спадает, и без этой проверки её склон на
 * малых сдвигах выдавался бы за шаг.
 *
 * @param profile — профиль средней яркости
 * @param minStep — наименьший допустимый шаг в отсчётах
 * @param maxStep — наибольший допустимый шаг в отсчётах
 * @returns найденный период; нулевой шаг и нулевая уверенность, если периода нет
 */
export const measureProfilePeriod = (
  profile: ShearedProfile,
  minStep: number,
  maxStep: number
): ProfilePeriod => {
  const { values, origin } = profile;
  const size = values.length;
  const maxLag = Math.min(Math.floor(maxStep), Math.floor(size / 2) - 1);
  const minLag = Math.max(2, Math.floor(minStep));

  if (size < 8 || maxLag <= minLag) {
    return EMPTY_PERIOD;
  }

  const detrended = detrendProfile(values, 2 * maxLag + 1);
  const meanEnergy = computeMeanEnergy(detrended);
  const correlation = computeAutocorrelation(detrended, meanEnergy, maxLag);
  const peakLag = findFundamentalLag(correlation, detrended, meanEnergy, minLag, maxLag);

  if (peakLag < 0) {
    return EMPTY_PERIOD;
  }

  const background = computeLocalBackground(correlation, peakLag, maxLag);
  const peak = computeCorrelationAt(detrended, meanEnergy, peakLag);
  const confidence = Math.max(0, Math.min(1, peak - background));
  const step = refineStep(detrended, peakLag);

  return { step, phase: computePhase(detrended, origin, step), confidence };
};
