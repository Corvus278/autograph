import type { SheetImageData } from './paper.types';

/**
 * Ось, вдоль которой тянутся линии разлиновки: `horizontal` — линии идут слева
 * направо, бины профиля нумеруются сверху вниз; `vertical` — наоборот.
 */
export type ProfileAxis = 'horizontal' | 'vertical';

/**
 * Профиль средней яркости вдоль наклонных линий: изображение схлопнуто в один
 * ряд чисел, в котором разлиновка видна как правильная последовательность
 * провалов.
 */
export type ShearedProfile = {
  /**
   * Средняя яркость бина от 0 до 1. Каждый бин собран из одинакового числа
   * точек, поэтому бины сравнимы между собой.
   */
  values: Float64Array;

  /**
   * Координата нулевого бина в пикселях фотографии: у горизонтальной оси —
   * смещение сверху, у вертикальной — слева. Пропущенная полоса у краёв
   * нужна, чтобы каждый бин собирался со всей ширины кадра.
   */
  origin: number;
};

/**
 * Границы непрерывного участка ряда по индексам его отсчётов.
 */
export type ProfileRegion = {
  /**
   * Индекс первого отсчёта участка.
   */
  start: number;

  /**
   * Индекс последнего отсчёта участка включительно.
   */
  end: number;
};

const DEGREES_TO_RADIANS = Math.PI / 180;

const EMPTY_PROFILE: ShearedProfile = { values: new Float64Array(0), origin: 0 };

/**
 * Тангенс угла наклона, заданного в градусах.
 */
export const toTangent = (angleDegrees: number): number => {
  return Math.tan(angleDegrees * DEGREES_TO_RADIANS);
};

/**
 * Ширина полосы у краёв, которую нельзя брать в профиль: на ней бин собрался
 * бы не со всей ширины кадра, и профили разных углов стали бы несравнимы.
 *
 * @param angleDegrees — угол, на который рассчитан запас
 * @param span — длина стороны, вдоль которой идут линии
 * @returns число пикселей, отбрасываемых с каждого края
 */
export const computeGuardBand = (angleDegrees: number, span: number): number => {
  return Math.ceil(Math.abs(toTangent(angleDegrees)) * Math.max(0, span - 1));
};

const buildHorizontalProfile = (
  image: SheetImageData,
  tangent: number,
  guard: number
): ShearedProfile => {
  const { width, height, luminance } = image;
  const size = height - 2 * guard;

  if (size < 2) {
    return EMPTY_PROFILE;
  }

  const sums = new Float64Array(size);
  const counts = new Float64Array(size);
  const offsets = new Float64Array(width);

  for (let x = 0; x < width; x += 1) {
    offsets[x] = x * tangent;
  }

  for (let y = 0; y < height; y += 1) {
    const row = y * width;

    for (let x = 0; x < width; x += 1) {
      const bin = Math.round(y - (offsets[x] || 0)) - guard;

      if (bin >= 0 && bin < size) {
        sums[bin] = (sums[bin] || 0) + (luminance[row + x] || 0);
        counts[bin] = (counts[bin] || 0) + 1;
      }
    }
  }

  return { values: toMeans(sums, counts), origin: guard };
};

const buildVerticalProfile = (
  image: SheetImageData,
  tangent: number,
  guard: number
): ShearedProfile => {
  const { width, height, luminance } = image;
  const size = width - 2 * guard;

  if (size < 2) {
    return EMPTY_PROFILE;
  }

  const sums = new Float64Array(size);
  const counts = new Float64Array(size);

  for (let y = 0; y < height; y += 1) {
    const row = y * width;
    const offset = y * tangent;

    for (let x = 0; x < width; x += 1) {
      const bin = Math.round(x + offset) - guard;

      if (bin >= 0 && bin < size) {
        sums[bin] = (sums[bin] || 0) + (luminance[row + x] || 0);
        counts[bin] = (counts[bin] || 0) + 1;
      }
    }
  }

  return { values: toMeans(sums, counts), origin: guard };
};

const toMeans = (sums: Float64Array, counts: Float64Array): Float64Array => {
  const values = new Float64Array(sums.length);

  for (let index = 0; index < values.length; index += 1) {
    const count = counts[index] || 0;

    values[index] = count > 0 ? (sums[index] || 0) / count : 0;
  }

  return values;
};

/**
 * Схлопывает изображение в профиль средней яркости вдоль линий, наклонённых на
 * `angleDegrees`. Наклон учитывается сдвигом, а не поворотом изображения:
 * фотография не пересемплируется, поэтому текстура и резкость линий целы.
 *
 * @param image — полутоновая выжимка
 * @param axis — вдоль какой оси идут линии
 * @param angleDegrees — наклон линий в градусах, положительный — вниз слева направо
 * @param guardAngleDegrees — угол, по которому считается отбрасываемая полоса у краёв
 * @returns профиль; пустой, если после отбрасывания полосы бинов не осталось
 */
export const buildShearedProfile = (
  image: SheetImageData,
  axis: ProfileAxis,
  angleDegrees: number,
  guardAngleDegrees: number
): ShearedProfile => {
  const tangent = toTangent(angleDegrees);

  switch (axis) {
    case 'horizontal': {
      return buildHorizontalProfile(
        image,
        tangent,
        computeGuardBand(guardAngleDegrees, image.width)
      );
    }

    case 'vertical': {
      return buildVerticalProfile(
        image,
        tangent,
        computeGuardBand(guardAngleDegrees, image.height)
      );
    }

    default: {
      throw new Error(`Неизвестная ось профиля: ${axis}`);
    }
  }
};

/**
 * Раскладка полос по кадру. Бин точки `(x, y)` — `round(rowShifts[y] +
 * columnShifts[x]) − guard`, отсчёт её полосы в общем массиве начинается с
 * `rowStrips[y] + columnStrips[x]`: так внутренний цикл одинаков для обеих осей
 * и не ветвится.
 */
type StripLayout = {
  /**
   * Полоса у краёв, отбрасываемая из профиля.
   */
  guard: number;

  /**
   * Число бинов в профиле одной полосы.
   */
  size: number;

  /**
   * Число полос.
   */
  count: number;

  /**
   * Вклад строки кадра в координату бина.
   */
  rowShifts: Float64Array;

  /**
   * Вклад столбца кадра в координату бина.
   */
  columnShifts: Float64Array;

  /**
   * Вклад строки кадра в начало полосы в общем массиве.
   */
  rowStrips: Float64Array;

  /**
   * Вклад столбца кадра в начало полосы в общем массиве.
   */
  columnStrips: Float64Array;
};

const buildStripLayout = (
  image: SheetImageData,
  axis: ProfileAxis,
  tangent: number,
  guardAngleDegrees: number,
  stripCount: number
): StripLayout => {
  const { width, height } = image;

  switch (axis) {
    case 'horizontal': {
      const guard = computeGuardBand(guardAngleDegrees, width);
      const size = Math.max(0, height - 2 * guard);
      const count = Math.min(width, Math.max(1, Math.floor(stripCount)));

      return {
        guard,
        size,
        count,
        rowShifts: Float64Array.from({ length: height }, (_item, y) => {
          return y;
        }),
        columnShifts: Float64Array.from({ length: width }, (_item, x) => {
          return -x * tangent;
        }),
        rowStrips: new Float64Array(height),
        columnStrips: Float64Array.from({ length: width }, (_item, x) => {
          return Math.floor((x * count) / width) * size;
        }),
      };
    }

    case 'vertical': {
      const guard = computeGuardBand(guardAngleDegrees, height);
      const size = Math.max(0, width - 2 * guard);
      const count = Math.min(height, Math.max(1, Math.floor(stripCount)));

      return {
        guard,
        size,
        count,
        rowShifts: Float64Array.from({ length: height }, (_item, y) => {
          return y * tangent;
        }),
        columnShifts: Float64Array.from({ length: width }, (_item, x) => {
          return x;
        }),
        rowStrips: Float64Array.from({ length: height }, (_item, y) => {
          return Math.floor((y * count) / height) * size;
        }),
        columnStrips: new Float64Array(width),
      };
    }

    default: {
      throw new Error(`Неизвестная ось профиля: ${axis}`);
    }
  }
};

/**
 * Профили средней яркости вдоль наклонных линий, собранные отдельно по полосам
 * кадра равной ширины, нарезанным поперёк линий: у горизонтальных линий полосы
 * вертикальные, у вертикальных — горизонтальные.
 *
 * Отдельная функция, а не полоса как частный случай общего профиля: общий
 * профиль строится и на каждом угле свипа наклона, и лишняя косвенность в его
 * внутреннем цикле обошлась бы дороже, чем повтор нескольких строк.
 *
 * @param image — полутоновая выжимка
 * @param axis — вдоль какой оси идут линии
 * @param angleDegrees — наклон линий в градусах, положительный — вниз слева направо
 * @param guardAngleDegrees — угол, по которому считается отбрасываемая полоса у краёв
 * @param stripCount — число полос, не больше длины нарезаемой стороны кадра
 * @returns профиль каждой полосы по порядку слева направо или сверху вниз; бины
 * и `origin` у всех полос те же, что у общего профиля по той же оси и тому же
 * углу; пустой список, если после отбрасывания полосы у краёв бинов не осталось
 */
export const buildStripProfiles = (
  image: SheetImageData,
  axis: ProfileAxis,
  angleDegrees: number,
  guardAngleDegrees: number,
  stripCount: number
): ShearedProfile[] => {
  const { width, height, luminance } = image;
  const { guard, size, count, rowShifts, columnShifts, rowStrips, columnStrips } =
    buildStripLayout(image, axis, toTangent(angleDegrees), guardAngleDegrees, stripCount);

  if (size < 2) {
    return [];
  }

  const sums = new Float64Array(count * size);
  const counts = new Float64Array(count * size);

  for (let y = 0; y < height; y += 1) {
    const row = y * width;
    const rowShift = rowShifts[y] || 0;
    const rowStrip = rowStrips[y] || 0;

    for (let x = 0; x < width; x += 1) {
      const bin = Math.round(rowShift + (columnShifts[x] || 0)) - guard;

      if (bin >= 0 && bin < size) {
        const index = rowStrip + (columnStrips[x] || 0) + bin;

        sums[index] = (sums[index] || 0) + (luminance[row + x] || 0);
        counts[index] = (counts[index] || 0) + 1;
      }
    }
  }

  return Array.from({ length: count }, (_item, strip) => {
    const from = strip * size;

    return {
      values: toMeans(
        sums.subarray(from, from + size),
        counts.subarray(from, from + size)
      ),
      origin: guard,
    };
  });
};

/**
 * Отклик поперёк горизонтальной разлиновки: для каждого столбца считается,
 * насколько его тёмные точки попадают в найденную гребёнку линий. Там, где
 * линии кончаются, отклик падает до нуля — по этому обрыву находятся левое и
 * правое поля.
 *
 * @param image — полутоновая выжимка
 * @param angleDegrees — наклон разлиновки в градусах
 * @param guardAngleDegrees — угол, по которому считается отбрасываемая полоса у краёв
 * @param step — шаг разлиновки в пикселях
 * @param phase — смещение линий по модулю шага
 * @returns профиль отклика, пронумерованный поперёк линий
 */
export const buildCombResponse = (
  image: SheetImageData,
  angleDegrees: number,
  guardAngleDegrees: number,
  step: number,
  phase: number
): ShearedProfile => {
  const { width, height, luminance } = image;
  const guard = computeGuardBand(guardAngleDegrees, height);
  const size = width - 2 * guard;

  if (size < 2 || step <= 0) {
    return EMPTY_PROFILE;
  }

  const tangent = toTangent(angleDegrees);
  const mean = computeMean(luminance);
  const frequency = (2 * Math.PI) / step;
  const sums = new Float64Array(size);
  const counts = new Float64Array(size);

  for (let y = 0; y < height; y += 1) {
    const row = y * width;
    const offset = y * tangent;

    for (let x = 0; x < width; x += 1) {
      const bin = Math.round(x + offset) - guard;

      if (bin >= 0 && bin < size) {
        const alongLines = y - x * tangent;
        const weight = Math.cos((alongLines - phase) * frequency);

        sums[bin] = (sums[bin] || 0) + (mean - (luminance[row + x] || 0)) * weight;
        counts[bin] = (counts[bin] || 0) + 1;
      }
    }
  }

  return { values: toMeans(sums, counts), origin: guard };
};

/**
 * Число отсчётов в таблицах косинуса и синуса фазы гребёнки на один шаг.
 * Ошибка фазы при такой таблице — сотые доли радиана, и отклик от неё почти не
 * меняется, а выборка из таблицы дешевле двух тригонометрических вызовов на
 * каждую точку кадра.
 */
const PHASE_TABLE_SIZE = 1024;

const COS_TABLE = Float64Array.from({ length: PHASE_TABLE_SIZE }, (_item, index) => {
  return Math.cos((2 * Math.PI * index) / PHASE_TABLE_SIZE);
});

const SIN_TABLE = Float64Array.from({ length: PHASE_TABLE_SIZE }, (_item, index) => {
  return Math.sin((2 * Math.PI * index) / PHASE_TABLE_SIZE);
});

/**
 * Раскладка бинов одной полосы в общих массивах сумм.
 */
type BandLayout = {
  /**
   * Координата нулевого бина поперёк линий.
   */
  origin: number;

  /**
   * Число бинов полосы.
   */
  size: number;

  /**
   * Начало бинов полосы в общих массивах.
   */
  offset: number;
};

/**
 * Бины полосы — только те координаты поперёк линий, на которых полоса целиком
 * лежит в кадре: у частично срезанного бина суммы `cos` и `sin` набраны не по
 * всей высоте полосы, и его отклик несравним с соседями. Срез зависит от
 * высоты полосы и её места вдоль линий, а не от высоты кадра.
 */
const buildBandLayouts = (
  width: number,
  tangent: number,
  alongEdges: number[]
): BandLayout[] => {
  const stretch = (width - 1) * (1 + tangent * tangent);
  let offset = 0;

  return alongEdges.slice(1).map((to, band) => {
    const from = alongEdges[band] || 0;
    const origin = Math.ceil(Math.max(from * tangent, to * tangent));
    const end = Math.floor(stretch + Math.min(from * tangent, to * tangent));
    const size = Math.max(0, end - origin + 1);
    const layout = { origin, size, offset };

    offset += size;

    return layout;
  });
};

/**
 * Отклик горизонтальной гребёнки по полосам, нарезанным вдоль линий: для
 * каждой полосы и каждого столбца поперёк линий — насколько яркость полосы
 * повторяет гребёнку с шагом `step`.
 *
 * Полосы режутся по координате вдоль линий `u = y − x·tgθ`, а не по строкам
 * кадра: полоса по строкам на наклонном листе ловит то одну, то две линии, и
 * её отклик падает вдвое там, где линии никуда не делись.
 *
 * Отклик — модуль квадратур `√(C² + S²)`, а не одна косинусная сумма: изогнутая
 * линия уходит с прямой гребёнки, и косинус с её фазой падает ниже порога
 * области раньше, чем линия кончается. Модуль от сдвига фазы не зависит.
 *
 * Из яркости вычитается среднее бина по полосе, а не по кадру: на отрезке в
 * несколько периодов `cos` и `sin` постоянный фон не гасят, и чистое поле,
 * спираль или стол за концами линий дали бы отклик.
 *
 * @param image — полутоновая выжимка
 * @param angleDegrees — наклон разлиновки в градусах
 * @param step — шаг разлиновки в пикселях
 * @param phase — смещение линий по модулю шага
 * @param alongEdges — границы полос по координате вдоль линий, по возрастанию:
 *   полоса `i` занимает `[alongEdges[i], alongEdges[i + 1])`
 * @returns профиль отклика каждой полосы, пронумерованный поперёк линий;
 *   `origin` — координата `x + y·tgθ` нулевого бина, у каждой полосы своя
 */
export const buildBandCombResponses = (
  image: SheetImageData,
  angleDegrees: number,
  step: number,
  phase: number,
  alongEdges: number[]
): ShearedProfile[] => {
  const { width, height, luminance } = image;
  const bandCount = alongEdges.length - 1;

  if (bandCount < 1 || step <= 0) {
    return [];
  }

  const tangent = toTangent(angleDegrees);
  const layouts = buildBandLayouts(width, tangent, alongEdges);
  const total = layouts.reduce((sum, { size }) => {
    return sum + size;
  }, 0);
  const sums = new Float64Array(total);
  const cosSums = new Float64Array(total);
  const sinSums = new Float64Array(total);
  const cosWeights = new Float64Array(total);
  const sinWeights = new Float64Array(total);
  const counts = new Float64Array(total);
  const alongFrom = alongEdges[0] || 0;
  const alongTo = alongEdges[bandCount] || 0;
  let band = 0;

  for (let y = 0; y < height; y += 1) {
    const row = y * width;
    const across = y * tangent;

    for (let x = 0; x < width; x += 1) {
      const along = y - x * tangent;

      if (along < alongFrom || along >= alongTo) {
        continue;
      }

      while (band > 0 && along < (alongEdges[band] || 0)) {
        band -= 1;
      }

      while (band < bandCount - 1 && along >= (alongEdges[band + 1] || 0)) {
        band += 1;
      }

      const layout = layouts[band];
      const bin = layout ? Math.round(x + across) - layout.origin : -1;

      if (!layout || bin < 0 || bin >= layout.size) {
        continue;
      }

      const cycles = (along - phase) / step;
      const tableIndex = Math.floor((cycles - Math.floor(cycles)) * PHASE_TABLE_SIZE);
      const cosine = COS_TABLE[tableIndex] || 0;
      const sine = SIN_TABLE[tableIndex] || 0;
      const value = luminance[row + x] || 0;
      const index = layout.offset + bin;

      sums[index] = (sums[index] || 0) + value;
      cosSums[index] = (cosSums[index] || 0) + value * cosine;
      sinSums[index] = (sinSums[index] || 0) + value * sine;
      cosWeights[index] = (cosWeights[index] || 0) + cosine;
      sinWeights[index] = (sinWeights[index] || 0) + sine;
      counts[index] = (counts[index] || 0) + 1;
    }
  }

  return layouts.map(({ origin, size, offset }) => {
    const values = new Float64Array(size);

    for (let bin = 0; bin < size; bin += 1) {
      const index = offset + bin;
      const count = counts[index] || 0;

      if (count > 0) {
        const mean = (sums[index] || 0) / count;
        const cosPart = (cosSums[index] || 0) - mean * (cosWeights[index] || 0);
        const sinPart = (sinSums[index] || 0) - mean * (sinWeights[index] || 0);

        values[bin] = Math.hypot(cosPart, sinPart) / count;
      }
    }

    return { values, origin };
  });
};

const computeMean = (values: Float32Array): number => {
  let sum = 0;

  for (let index = 0; index < values.length; index += 1) {
    sum += values[index] || 0;
  }

  return values.length > 0 ? sum / values.length : 0;
};

/**
 * Скользящее среднее с окном `window`: у краёв окно обрезается по имеющимся
 * отсчётам, поэтому длина результата совпадает с длиной входа.
 *
 * @param values — исходный ряд
 * @param window — полная ширина окна в отсчётах
 * @returns сглаженный ряд
 */
export const smoothProfile = (values: Float64Array, window: number): Float64Array => {
  const size = values.length;
  const smoothed = new Float64Array(size);

  if (size === 0) {
    return smoothed;
  }

  const half = Math.max(1, Math.floor(window / 2));
  const prefix = new Float64Array(size + 1);

  for (let index = 0; index < size; index += 1) {
    prefix[index + 1] = (prefix[index] || 0) + (values[index] || 0);
  }

  for (let index = 0; index < size; index += 1) {
    const from = Math.max(0, index - half);
    const to = Math.min(size, index + half + 1);

    smoothed[index] = ((prefix[to] || 0) - (prefix[from] || 0)) / (to - from);
  }

  return smoothed;
};

/**
 * Вычитает из ряда прямую наименьших квадратов.
 *
 * Отдельным шагом перед скользящим средним: у края окно среднего обрезано, и
 * на наклонном ряде оно отстаёт от него тем сильнее, чем ближе к краю. Такой
 * горб у каждого края шире любого шага разлиновки и сам по себе даёт высокую
 * автокорреляцию на малых сдвигах. Общий наклон освещения снимается прямой
 * ровно затем, чтобы горбам неоткуда было взяться.
 */
const removeLinearTrend = (values: Float64Array): Float64Array => {
  const size = values.length;
  const flattened = new Float64Array(size);

  if (size < 2) {
    return flattened;
  }

  let sumIndex = 0;
  let sumValue = 0;
  let sumIndexValue = 0;
  let sumIndexSquared = 0;

  for (let index = 0; index < size; index += 1) {
    const value = values[index] || 0;

    sumIndex += index;
    sumValue += value;
    sumIndexValue += index * value;
    sumIndexSquared += index * index;
  }

  const variance = size * sumIndexSquared - sumIndex * sumIndex;
  const slope =
    variance === 0 ? 0 : (size * sumIndexValue - sumIndex * sumValue) / variance;
  const intercept = (sumValue - slope * sumIndex) / size;

  for (let index = 0; index < size; index += 1) {
    flattened[index] = (values[index] || 0) - (slope * index + intercept);
  }

  return flattened;
};

/**
 * Убирает из профиля низкие частоты: возвращает отклонение яркости от местного
 * фона. Так из профиля уходит неравномерность освещения, а провалы линий
 * остаются.
 *
 * @param values — профиль средней яркости
 * @param window — ширина окна фона в отсчётах
 * @returns ряд отклонений, отрицательных на линиях
 */
export const detrendProfile = (values: Float64Array, window: number): Float64Array => {
  const flattened = removeLinearTrend(values);
  const background = smoothProfile(flattened, window);
  const detrended = new Float64Array(values.length);

  for (let index = 0; index < values.length; index += 1) {
    detrended[index] = (flattened[index] || 0) - (background[index] || 0);
  }

  return detrended;
};

/**
 * Уточняет положение вершины по трём соседним отсчётам, приближая её
 * параболой: целочисленный максимум сдвигается в пределах половины шага.
 *
 * @param previous — отсчёт слева от вершины
 * @param peak — отсчёт в вершине
 * @param next — отсчёт справа от вершины
 * @returns поправка к положению вершины в отсчётах, от -0.5 до 0.5
 */
export const refinePeakOffset = (
  previous: number,
  peak: number,
  next: number
): number => {
  const denominator = previous - 2 * peak + next;

  if (denominator === 0) {
    return 0;
  }

  const offset = (0.5 * (previous - next)) / denominator;

  if (!Number.isFinite(offset)) {
    return 0;
  }

  return Math.max(-0.5, Math.min(0.5, offset));
};

/**
 * Затягивает узкие провалы ряда: сначала по окну берётся максимум, потом по
 * тому же окну — минимум. Провалы уже окна исчезают, границы широких участков
 * остаются на месте.
 *
 * Нужно перед поиском границ области с линиями: на клетчатом листе отклик
 * горизонтальных линий проваливается на каждой вертикальной линии клетки, а на
 * листе в линейку — на линии поля. Без затягивания «самый длинный непрерывный
 * участок» вырождается в один промежуток между двумя вертикальными линиями.
 *
 * @param values — ряд откликов
 * @param window — ширина окна в отсчётах: провалы уже него затягиваются
 * @returns ряд без узких провалов
 */
export const closeProfileGaps = (values: Float64Array, window: number): Float64Array => {
  const size = values.length;
  const half = Math.max(1, Math.floor(window / 2));
  const dilated = new Float64Array(size);
  const closed = new Float64Array(size);

  for (let index = 0; index < size; index += 1) {
    let peak = Number.NEGATIVE_INFINITY;

    for (
      let inner = Math.max(0, index - half);
      inner < Math.min(size, index + half + 1);
      inner += 1
    ) {
      peak = Math.max(peak, values[inner] || 0);
    }

    dilated[index] = peak;
  }

  for (let index = 0; index < size; index += 1) {
    let valley = Number.POSITIVE_INFINITY;

    for (
      let inner = Math.max(0, index - half);
      inner < Math.min(size, index + half + 1);
      inner += 1
    ) {
      valley = Math.min(valley, dilated[inner] || 0);
    }

    closed[index] = valley;
  }

  return closed;
};

/**
 * Границы участка, на котором ряд держится выше доли `level` от своего уровня:
 * уровень берётся как девятая децила, чтобы одиночный выброс не поднял порог.
 * Возвращается самый длинный непрерывный участок — разлиновка не бывает
 * разорванной, а вот отдельные бины проседают.
 *
 * @param values — ряд откликов
 * @param level — доля от уровня ряда, ниже которой участок считается пустым
 * @returns индексы первого и последнего отсчёта участка; `null` — участка нет
 */
export const findSignalRegion = (
  values: Float64Array,
  level: number
): ProfileRegion | null => {
  const size = values.length;

  if (size === 0) {
    return null;
  }

  const sorted = Float64Array.from(values).sort();
  const decile = sorted[Math.min(size - 1, Math.floor(size * 0.9))] || 0;

  if (decile <= 0) {
    return null;
  }

  const threshold = decile * level;
  let bestStart = -1;
  let bestEnd = -1;
  let runStart = -1;

  for (let index = 0; index <= size; index += 1) {
    const isInside = index < size && (values[index] || 0) >= threshold;

    if (isInside && runStart < 0) {
      runStart = index;
    }

    if (!isInside && runStart >= 0) {
      if (index - runStart > bestEnd - bestStart) {
        bestStart = runStart;
        bestEnd = index - 1;
      }

      runStart = -1;
    }
  }

  if (bestStart < 0) {
    return null;
  }

  return { start: bestStart, end: bestEnd };
};
