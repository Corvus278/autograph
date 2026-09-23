import type { SheetImageData } from './paper.types';
import { computeMedian } from './quantile';
import { computeGuardBand, toTangent } from './sheetProfile';

/**
 * Наименьшая краснота кандидата в линию поля, в уровнях 8-битного канала: ниже
 * неё кандидат — нейтральная вертикаль (виток спирали, линия клетки, тень), а
 * не красная черта, как бы глубоко он ни шёл по яркости.
 *
 * На 34 живых снимках обоих проходов у годных кандидатов второй ступени
 * настоящие черты дают не меньше 26,5, ложные — не больше 6,1; у кандидатов
 * первой ступени — не меньше 33,4 против не больше 5,4. Общий для обеих ступеней
 * разрыв — 6,1…26,5, и 16 — его арифметическая середина (16,3), округлённая
 * вниз до целого: запас до ложных 9,9, до настоящих 10,5. Середина
 * арифметическая, а не геометрическая (около 12,7): шум меры аддитивный —
 * хроматический шум сенсора и JPEG в уровнях не растёт с яркостью черты.
 * Любой порог от 7 до 26 даёт на живых снимках один итог, поэтому место внутри
 * разрыва решает только запас против невиденных снимков.
 */
export const MARGIN_LINE_MIN_REDNESS = 16;

/**
 * Порог гейта серого снимка: при 99-м процентиле `|R − G|` по кадру ниже него
 * вето по цвету выключено, и линия поля ищется только по яркости.
 *
 * Цветные живые снимки дают 17…59 уровней, серый скан — 0…1: 5 лежит в разрыве
 * с запасом от цветных больше чем втрое. Без гейта на сером скане ни один
 * кандидат не набрал бы красноты, и настоящая чёрная или серая черта
 * терялась бы.
 */
export const MARGIN_LINE_COLOUR_GATE = 5;

/**
 * Доля кадра, ниже которой лежит мера цветности кадра: 99-й процентиль, а не
 * максимум — одиночные цветные пиксели шума JPEG серый скан цветным не делают.
 */
const COLOUR_GATE_QUANTILE = 0.99;

/**
 * Наибольшая разность красного и зелёного каналов по модулю, в уровнях.
 */
const MAX_CHANNEL_LEVEL = 255;

/**
 * Полуширина окна вокруг узла трассы в бинах, внутри которого берётся избыток
 * красноты. Узел стоит на дробном положении провала яркости, и округлённый бин
 * может оказаться на склоне тонкой черты, а не на её середине.
 */
const NODE_REACH_BINS = 1;

/**
 * Избыток разности красного и зелёного каналов над фоном, по горизонтальным
 * полосам кадра.
 */
export type RednessStrips = {
  /**
   * Координата нулевого бина в пикселях изображения, общая у всех полос; та
   * же, что у яркостных профилей по полосам с тем же наклоном.
   */
  origin: number;

  /**
   * Число полос.
   */
  count: number;

  /**
   * Число бинов поперёк вертикалей в каждой полосе.
   */
  size: number;

  /**
   * Избыток полосы в бине, в уровнях.
   *
   * @param strip — номер полосы сверху вниз, от 0 до `count`
   * @param bin — номер бина, от 0 до `size`
   * @returns избыток `R − G` над фоном
   */
  excessAt: (strip: number, bin: number) => number;
};

/**
 * Полосы красноты без единой полосы: у кадра не осталось бинов или нет канала.
 * Кандидат с ними набирает нулевую красноту.
 */
export const NO_REDNESS_STRIPS: RednessStrips = {
  origin: 0,
  count: 0,
  size: 0,
  excessAt: () => {
    return 0;
  },
};

/**
 * Узел трассы вертикальной линии в одной полосе.
 */
export type RednessNode = {
  /**
   * Положение линии в пикселях изображения.
   */
  position: number;
};

/**
 * Медиана скользящим окном: фон, от которого отсчитываются провалы линий.
 * Медиана, а не среднее: узкий провал её не сдвигает, поэтому глубина линии
 * достаётся целиком, а не наполовину.
 *
 * @param values — профиль
 * @param window — ширина окна в бинах
 * @returns фон каждого бина
 */
export const computeMovingMedian = (
  values: Float64Array,
  window: number
): Float64Array => {
  const size = values.length;
  const median = new Float64Array(size);
  const half = Math.max(1, Math.floor(window / 2));

  for (let index = 0; index < size; index += 1) {
    const from = Math.max(0, index - half);
    const to = Math.min(size, index + half + 1);
    const slice: number[] = [];

    for (let inner = from; inner < to; inner += 1) {
      slice.push(values[inner] || 0);
    }

    median[index] = computeMedian(slice);
  }

  return median;
};

/**
 * 99-й процентиль `|R − G|` по всем пикселям изображения — мера того, есть ли
 * на снимке цвет. Процентиль — член ряда, как у `computeQuantile`, и считается
 * гистограммой уровней, а не сортировкой: на кадре телефона это десяток
 * миллионов значений.
 *
 * @param image — изображение листа
 * @returns процентиль в уровнях; `null` — у изображения нет цветового канала
 */
export const measureRedGreenP99 = (image: SheetImageData): number | null => {
  const { redMinusGreen } = image;

  if (!redMinusGreen || redMinusGreen.length === 0) {
    return null;
  }

  const counts = new Float64Array(MAX_CHANNEL_LEVEL + 1);

  for (const value of redMinusGreen) {
    const level = Math.min(MAX_CHANNEL_LEVEL, Math.abs(value));

    counts[level] = (counts[level] || 0) + 1;
  }

  const rank = Math.min(
    redMinusGreen.length - 1,
    Math.floor(redMinusGreen.length * COLOUR_GATE_QUANTILE)
  );
  let seen = 0;

  for (let level = 0; level <= MAX_CHANNEL_LEVEL; level += 1) {
    seen += counts[level] || 0;

    if (seen > rank) {
      return level;
    }
  }

  return MAX_CHANNEL_LEVEL;
};

/**
 * Включено ли вето по цвету на снимке с такой мерой цветности.
 *
 * @param redGreenP99 — 99-й процентиль `|R − G|` по кадру; `null` — канала нет
 * @returns `true` — снимок цветной, кандидаты без красноты отвергаются
 */
export const isColourVetoEnabled = (redGreenP99: number | null): boolean => {
  return (redGreenP99 || 0) >= MARGIN_LINE_COLOUR_GATE;
};

/**
 * Избыток `R − G` над скользящей медианой по горизонтальным полосам кадра.
 * Бины и `origin` те же, что у `buildStripProfiles` по оси `vertical` с теми
 * же углами и числом полос: узел трассы, найденный по яркости, попадает в свой
 * столбец и здесь.
 *
 * Бин считается по запросу и запоминается, а не весь кадр сразу: краснота
 * нужна только у узлов трассы кандидата, взявшего яркостные меры, — по три
 * бина на полосу у крайней трети ширины. Проход по всему кадру со скользящей
 * медианой во всю ширину каждой полосы стоил на снимке телефона больше
 * секунды на проход, а число от способа подсчёта не зависит: бин собирается
 * теми же пикселями в том же порядке.
 *
 * @param image — изображение листа
 * @param angleDegrees — наклон разлиновки в градусах
 * @param guardAngleDegrees — угол, по которому считается отбрасываемая полоса у краёв
 * @param stripCount — число полос, не больше высоты изображения
 * @param window — ширина окна фона в бинах, та же, что у яркостного профиля
 * @returns избыток по полосам сверху вниз; `null` — у изображения нет цветового
 *   канала; ни одной полосы — после отбрасывания краёв бинов не осталось
 */
export const buildRednessStrips = (
  image: SheetImageData,
  angleDegrees: number,
  guardAngleDegrees: number,
  stripCount: number,
  window: number
): RednessStrips | null => {
  const { width, height, redMinusGreen } = image;

  if (!redMinusGreen) {
    return null;
  }

  const guard = computeGuardBand(guardAngleDegrees, height);
  const size = width - 2 * guard;
  const count = Math.min(height, Math.max(1, Math.floor(stripCount)));

  if (size < 2) {
    return { ...NO_REDNESS_STRIPS, origin: guard };
  }

  const tangent = toTangent(angleDegrees);
  const half = Math.max(1, Math.floor(window / 2));
  /**
   * Первая строка каждой полосы и строка за последней: полоса строки — та же
   * доля высоты, что у яркостного профиля.
   */
  const stripStarts = new Int32Array(count + 1).fill(height);

  for (let y = height - 1; y >= 0; y -= 1) {
    stripStarts[Math.floor((y * count) / height)] = y;
  }

  /**
   * Средние и избытки полос, посчитанные по запросу; `NaN` — бин ещё не
   * считался: из целых уровней `NaN` не получается.
   */
  const means = Array.from({ length: count }, () => {
    return new Float64Array(size).fill(Number.NaN);
  });
  const excesses = Array.from({ length: count }, () => {
    return new Float64Array(size).fill(Number.NaN);
  });

  /**
   * Среднее бина собирается теми же пикселями и в том же порядке — строка за
   * строкой, слева направо, — что при проходе по всему кадру: бин строки
   * получает пиксель, у которого `round(y·tgθ + x)` попал в него, а такой `x`
   * отстоит от `bin + guard − round(y·tgθ)` не больше чем на единицу.
   */
  const meanAt = (strip: number, bin: number): number => {
    const stripMeans = means[strip];
    const cached = stripMeans ? stripMeans[bin] : 0;

    if (!stripMeans || cached === undefined || !Number.isNaN(cached)) {
      return cached || 0;
    }

    let sum = 0;
    let binCount = 0;

    for (let y = stripStarts[strip] || 0; y < (stripStarts[strip + 1] || 0); y += 1) {
      const rowShift = y * tangent;
      const nearest = bin + guard - Math.round(rowShift);
      const from = Math.max(0, nearest - 1);
      const to = Math.min(width - 1, nearest + 1);

      for (let x = from; x <= to; x += 1) {
        if (Math.round(rowShift + x) - guard === bin) {
          sum += redMinusGreen[y * width + x] || 0;
          binCount += 1;
        }
      }
    }

    const mean = binCount > 0 ? sum / binCount : 0;

    stripMeans[bin] = mean;

    return mean;
  };

  /**
   * Избыток — среднее бина над медианой средних в окне вокруг него, с тем же
   * обрезанием окна у краёв, что у `computeMovingMedian`.
   */
  const excessAt = (strip: number, bin: number): number => {
    const stripExcesses = excesses[strip];
    const cached = stripExcesses ? stripExcesses[bin] : 0;

    if (!stripExcesses || cached === undefined || !Number.isNaN(cached)) {
      return cached || 0;
    }

    const slice: number[] = [];
    const to = Math.min(size, bin + half + 1);

    for (let inner = Math.max(0, bin - half); inner < to; inner += 1) {
      slice.push(meanAt(strip, inner));
    }

    const excess = meanAt(strip, bin) - (computeMedian(slice) || 0);

    stripExcesses[bin] = excess;

    return excess;
  };

  return { origin: guard, count, size, excessAt };
};

/**
 * Полосы красноты с номерами, сдвинутыми к первой из выбранных, — как
 * `Array.prototype.slice` по полосам.
 *
 * @param strips — полосы красноты
 * @param from — первая полоса
 * @param to — полоса за последней
 * @returns полосы с `from` по `to` без последней
 */
export const sliceRednessStrips = (
  strips: RednessStrips,
  from: number,
  to: number
): RednessStrips => {
  const { origin, count, size, excessAt } = strips;
  const start = Math.min(count, Math.max(0, from));
  const end = Math.min(count, Math.max(start, to));

  return {
    origin,
    count: end - start,
    size,
    excessAt: (strip, bin) => {
      return excessAt(start + strip, bin);
    },
  };
};

/**
 * Краснота кандидата в линию поля: медиана по узлам его трассы избытка `R − G`
 * в столбце узла над фоном. Медиана, а не среднее: одиночный узел на пятне её
 * не уводит.
 *
 * @param nodes — узлы трассы по полосам сверху вниз, в том же порядке и числе,
 *   что полосы `strips`; `null` — в полосе линия не нашлась
 * @param strips — избыток `R − G` по полосам
 * @returns краснота в уровнях; ноль — ни один узел не попал в полосу
 */
export const measureCandidateRedness = (
  nodes: (RednessNode | null)[],
  strips: RednessStrips
): number => {
  const { origin, count, size, excessAt } = strips;
  const levels = nodes.reduce<number[]>((acc, node, index) => {
    if (!node || index >= count) {
      return acc;
    }

    const bin = Math.round(node.position) - origin;
    const from = Math.max(0, bin - NODE_REACH_BINS);
    const to = Math.min(size - 1, bin + NODE_REACH_BINS);
    let best = Number.NEGATIVE_INFINITY;

    for (let inner = from; inner <= to; inner += 1) {
      best = Math.max(best, excessAt(index, inner) || 0);
    }

    if (Number.isFinite(best)) {
      acc.push(best);
    }

    return acc;
  }, []);

  return computeMedian(levels);
};
