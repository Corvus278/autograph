import { detectSkewAngle, MAX_SKEW_ANGLE, SKEW_ANGLE_STEP } from './detectSkewAngle';
import { ANALYSIS_IMAGE_SIZE } from './downsampleSheetImage';
import type { PaperMargins, RulingDetection, SheetImageData } from './paper.types';
import { measureProfilePeriod, type ProfilePeriod } from './profilePeriod';
import {
  buildCombResponse,
  buildShearedProfile,
  closeProfileGaps,
  detrendProfile,
  findSignalRegion,
  refinePeakOffset,
  type ShearedProfile,
} from './sheetProfile';

/**
 * Порог уверенности, начиная с которого разлиновка считается найденной.
 *
 * Уверенность — это превышение пика автокорреляции над её средним уровнем. На
 * профиле без разлиновки остаётся шум: пики случайных совпадений на профиле в
 * несколько сотен отсчётов не поднимаются выше полутора десятых. Настоящая
 * разлиновка, даже слабая и снятая под наклоном, даёт от шести десятых.
 * Тридцать пять сотых лежат в этом разрыве: ложных срабатываний не даёт, а
 * настоящую разлиновку не отбрасывает. Ошибка в сторону «не найдено» дешевле:
 * фотография не отбрасывается, а уходит в ручной ввод.
 */
export const RULING_CONFIDENCE_THRESHOLD = 0.35;

/**
 * Наименьший шаг разлиновки в пикселях. Ниже пяти точек линии сливаются с
 * зерном бумаги, и по такому снимку всё равно ничего не выложить.
 */
const MIN_RULING_STEP = 5;

/**
 * Наибольший шаг разлиновки как доля высоты кадра. Лист с разлиновкой крупнее
 * пятой части кадра — это не тетрадь, а обрезок: правильную последовательность
 * из четырёх-пяти провалов от случайного совпадения уже не отличить.
 */
const MAX_RULING_STEP_FRACTION = 0.2;

/**
 * Допустимое расхождение шагов по вертикали и горизонтали, при котором лист
 * считается клетчатым. Клетка печатается одним шаблоном, поэтому её шаги
 * совпадают с точностью до измерения; десятая доля — запас на наклон и на
 * разную резкость линий вдоль осей.
 */
const GRID_STEP_TOLERANCE = 0.1;

/**
 * Доля от глубины линии, ниже которой линия считается отсутствующей. Печать
 * разлиновки ровная, и разброс глубины линий на одном листе куда меньше
 * половины: половинный порог отделяет линию от чистого поля и не режет
 * область письма по бледной линии.
 */
const RULING_REGION_LEVEL = 0.5;

/**
 * Доля ширины кадра, в которой ищется вертикальная линия поля. Поле печатается
 * слева и занимает от силы четверть листа; поиск по всей ширине начал бы
 * принимать за линию поля правый край области письма.
 */
const MARGIN_LINE_SEARCH_FRACTION = 1 / 3;

/**
 * Во сколько раз линия поля должна быть темнее обычной вертикальной линии
 * листа. На клетчатом листе вертикальных линий полно, и линию поля выдаёт
 * только то, что она заметно жирнее и темнее остальных: полуторный запас
 * отделяет её от разброса печати самой клетки.
 */
const MARGIN_LINE_DEPTH_RATIO = 1.5;

/**
 * Квантиль глубины вертикальных линий вне зоны поиска, с которой сравнивается
 * кандидат. Не медиана: на зерне бумаги между линиями клетки набирается куда
 * больше мелких провалов, чем самих линий, и медиана съезжает к шуму — тогда
 * за линию поля сошла бы любая линия клетки. Девятая децила описывает именно
 * настоящие линии.
 */
const MARGIN_LINE_PEER_QUANTILE = 0.9;

/**
 * Во сколько раз провал линии поля должен превышать разброс профиля. Профиль
 * столбцов усреднён по всей высоте кадра, поэтому его шум мал, и шестикратный
 * запас отсекает случайный выброс, не трогая настоящую линию.
 */
const MARGIN_LINE_SIGMA_FACTOR = 6;

/**
 * Наименьший провал средней яркости столбца, который ещё считается линией
 * поля. Ниже трёх сотых провал неотличим от ступеньки на краю области письма:
 * там средняя яркость столбца тоже меняется, но никакой линии нет.
 */
const MARGIN_LINE_MIN_DEPTH = 0.03;

/**
 * Край кадра, у которого стоит вертикальная линия поля.
 */
export type MarginLineSide = 'left' | 'right';

/**
 * Разлиновка вместе со стороной, у которой нашлась линия поля.
 *
 * Сторона нужна отдельно от `marginLineX`: одного смещения мало, чтобы понять,
 * левая это половина разворота или правая, а от этого зависит, куда класть
 * блок текста на чётной странице. Поле объявлено здесь, а не в
 * `paper.types.ts`: `RulingDetection` ведёт владелец public API, к нему заявка
 * на `marginLineSide`.
 */
export type DetectedRuling = RulingDetection & {
  /**
   * Край, у которого стоит линия поля. `null` — линии поля нет.
   */
  marginLineSide: MarginLineSide | null;
};

const NO_MARGINS: PaperMargins = { top: 0, right: 0, bottom: 0, left: 0 };

/**
 * Настройки поиска разлиновки.
 */
export type RulingDetectionOptions = {
  /**
   * Готовый наклон разлиновки в градусах. Не задан — ищется свипом.
   */
  skewAngle?: number;

  /**
   * Половина диапазона свипа наклона в градусах.
   */
  maxAngle?: number;

  /**
   * Шаг свипа наклона в градусах.
   */
  angleStep?: number;

  /**
   * Наименьший допустимый шаг разлиновки в пикселях.
   */
  minStep?: number;

  /**
   * Наибольший допустимый шаг разлиновки как доля стороны кадра.
   */
  maxStepFraction?: number;

  /**
   * Порог уверенности, начиная с которого разлиновка считается найденной.
   */
  confidenceThreshold?: number;

  /**
   * Предел длинной стороны уменьшенной копии, на которой ищется наклон.
   */
  maxAnalysisSize?: number;
};

const toMissingDetection = (confidence: number): DetectedRuling => {
  return {
    isDetected: false,
    step: 0,
    firstLinePhase: 0,
    kind: 'blank',
    margins: NO_MARGINS,
    marginLineX: null,
    marginLineSide: null,
    confidence,
  };
};

/**
 * Крайние линии разлиновки на профиле в пикселях фотографии.
 */
type RuledSpan = {
  /**
   * Координата первой линии.
   */
  first: number;

  /**
   * Координата последней линии.
   */
  last: number;
};

const computeQuantile = (values: number[], quantile: number): number => {
  if (values.length === 0) {
    return 0;
  }

  const sorted = [...values].sort((first, second) => {
    return first - second;
  });

  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * quantile))] || 0;
};

const computeMedian = (values: number[]): number => {
  return computeQuantile(values, 0.5);
};

/**
 * Медиана скользящим окном: фон, от которого отсчитываются провалы линий.
 * Медиана, а не среднее: узкий провал её не сдвигает, поэтому глубина линии
 * достаётся целиком, а не наполовину.
 */
const computeMovingMedian = (values: Float64Array, window: number): Float64Array => {
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

const isDepthPeak = (depth: Float64Array, index: number): boolean => {
  return (
    (depth[index] || 0) > 0 &&
    (depth[index] || 0) >= (depth[index - 1] || 0) &&
    (depth[index] || 0) > (depth[index + 1] || 0)
  );
};

/**
 * Найденная вертикальная линия поля.
 */
type MarginLine = {
  /**
   * Смещение линии от левого края кадра в пикселях.
   */
  x: number;

  /**
   * Край, у которого линия стоит.
   */
  side: MarginLineSide;
};

/**
 * Ищет одиночную вертикальную линию поля у левого и у правого края кадра.
 *
 * С обеих сторон, а не только слева: лист может быть снят как правая половина
 * разворота, и тогда поле оказывается справа. На восьми снимках пресет-пака
 * линия стоит именно справа, на доле ширины от 0.85 до 0.91.
 *
 * Линия видна как провал средней яркости столбца, который глубже и обычного
 * шума, и обычных вертикальных линий листа: на клетчатом листе иначе за линию
 * поля сошла бы любая линия клетки. Поэтому глубина кандидата сравнивается с
 * глубиной линий из средней трети — там линия поля не встречается, а клетка
 * есть.
 *
 * Линия поля цветная, обычно красная, а на вход приходит яркость. Красное на
 * белом даёт провал мельче, чем то же самое в зелёном канале: на снимках
 * пресет-пака яркостный провал держится на уровне 0.20…0.28, зелёный — на
 * 0.22…0.35, то есть яркость теряет около четверти глубины. Запаса до порога
 * это не съедает, но если однажды понадобится ловить бледную линию, цветной
 * канал — готовый источник: `SheetImageData` придётся расширить до цвета.
 *
 * @param columns — профиль средней яркости по столбцам
 * @param step — шаг разлиновки в пикселях
 * @param width — ширина кадра в пикселях
 * @returns линия и сторона, у которой она стоит; `null` — линии поля нет
 */
const findMarginLine = (
  columns: ShearedProfile,
  step: number,
  width: number
): MarginLine | null => {
  const { values, origin } = columns;
  const size = values.length;
  const leftEnd = Math.ceil(width * MARGIN_LINE_SEARCH_FRACTION) - origin;
  const rightStart = Math.floor(width * (1 - MARGIN_LINE_SEARCH_FRACTION)) - origin;

  if (size < 8 || leftEnd < 2 || rightStart > size - 2) {
    return null;
  }

  const background = computeMovingMedian(values, Math.max(3, Math.round(step)));
  const depth = new Float64Array(size);

  for (let index = 0; index < size; index += 1) {
    depth[index] = (background[index] || 0) - (values[index] || 0);
  }

  const deviations: number[] = [];
  const middlePeaks: number[] = [];
  let leftIndex = -1;
  let rightIndex = -1;

  for (let index = 1; index < size - 1; index += 1) {
    deviations.push(Math.abs(depth[index] || 0));

    if (!isDepthPeak(depth, index)) {
      continue;
    }

    if (index < leftEnd) {
      if (leftIndex < 0 || (depth[index] || 0) > (depth[leftIndex] || 0)) {
        leftIndex = index;
      }

      continue;
    }

    if (index > rightStart) {
      if (rightIndex < 0 || (depth[index] || 0) > (depth[rightIndex] || 0)) {
        rightIndex = index;
      }

      continue;
    }

    middlePeaks.push(depth[index] || 0);
  }

  const sigma = 1.4826 * computeMedian(deviations);
  const threshold = Math.max(
    MARGIN_LINE_DEPTH_RATIO * computeQuantile(middlePeaks, MARGIN_LINE_PEER_QUANTILE),
    MARGIN_LINE_SIGMA_FACTOR * sigma,
    MARGIN_LINE_MIN_DEPTH
  );
  const leftDepth = leftIndex < 0 ? 0 : depth[leftIndex] || 0;
  const rightDepth = rightIndex < 0 ? 0 : depth[rightIndex] || 0;
  const isLeft = leftDepth >= rightDepth;
  const bestIndex = isLeft ? leftIndex : rightIndex;

  if (bestIndex < 0 || Math.max(leftDepth, rightDepth) < threshold) {
    return null;
  }

  const offset = refinePeakOffset(
    depth[bestIndex - 1] || 0,
    depth[bestIndex] || 0,
    depth[bestIndex + 1] || 0
  );

  return { x: origin + bestIndex + offset, side: isLeft ? 'left' : 'right' };
};

/**
 * Границы области с линиями: профиль опрашивается в предсказанных положениях
 * линий, и берётся самая длинная непрерывная цепочка тех, что действительно
 * темнее фона. Опрос по предсказанию, а не поиск провалов подряд: шаг и фаза
 * уже известны, и по ним видно не только где линии есть, но и где их не стало.
 *
 * @param profile — профиль средней яркости
 * @param step — шаг разлиновки в пикселях
 * @param phase — смещение линий по модулю шага
 * @returns координаты первой и последней линии; `null` — линий меньше трёх
 */
const findRuledSpan = (
  profile: ShearedProfile,
  step: number,
  phase: number
): RuledSpan | null => {
  const { values, origin } = profile;
  const size = values.length;
  const detrended = detrendProfile(values, 2 * Math.round(step) + 1);
  const firstLine = Math.ceil((origin - phase) / step);
  const lastLine = Math.floor((origin + size - 1 - phase) / step);

  if (lastLine - firstLine < 2) {
    return null;
  }

  const positions: number[] = [];
  const depths: number[] = [];

  for (let line = firstLine; line <= lastLine; line += 1) {
    const coordinate = phase + line * step;
    const bin = Math.round(coordinate) - origin;

    positions.push(coordinate);
    depths.push(
      Math.max(
        -(detrended[bin] || 0),
        -(detrended[bin - 1] || 0),
        -(detrended[bin + 1] || 0)
      )
    );
  }

  const sorted = [...depths].sort((left, right) => {
    return left - right;
  });
  const reference = sorted[Math.floor(sorted.length * 0.9)] || 0;

  if (reference <= 0) {
    return null;
  }

  const threshold = reference * RULING_REGION_LEVEL;
  let bestStart = -1;
  let bestEnd = -1;
  let runStart = -1;

  for (let index = 0; index <= depths.length; index += 1) {
    const isInside = index < depths.length && (depths[index] || 0) >= threshold;

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

  return { first: positions[bestStart] || 0, last: positions[bestEnd] || 0 };
};

const isSameStep = (first: number, second: number): boolean => {
  if (first <= 0 || second <= 0) {
    return false;
  }

  return Math.abs(first - second) / first <= GRID_STEP_TOLERANCE;
};

/**
 * Измеряет разлиновку на фотографии листа: шаг — автокорреляцией профиля
 * яркости, снятого вдоль наклонных линий, фазу и поля — по тому же профилю,
 * вид разлиновки — повторным измерением поперёк.
 *
 * Все длины — в пикселях переданного изображения: анализ идёт по нему, а не по
 * уменьшенной копии, поэтому шаг не нужно домножать на масштаб. Уменьшенная
 * копия используется только для свипа наклона, где масштаб роли не играет.
 *
 * Неудача не означает брак фотографии: `isDetected: false` включает ручной
 * ввод разлиновки, сама фотография остаётся годной.
 *
 * @param image — полутоновая выжимка фотографии листа
 * @param options — настройки поиска
 * @returns измеренная разлиновка вместе с уверенностью
 */
export const detectRuling = (
  image: SheetImageData,
  options: RulingDetectionOptions = {}
): DetectedRuling => {
  const {
    maxAngle = MAX_SKEW_ANGLE,
    angleStep = SKEW_ANGLE_STEP,
    minStep = MIN_RULING_STEP,
    maxStepFraction = MAX_RULING_STEP_FRACTION,
    confidenceThreshold = RULING_CONFIDENCE_THRESHOLD,
    maxAnalysisSize = ANALYSIS_IMAGE_SIZE,
  } = options;
  /**
   * Нулевой наклон — валидное измерение, а не «значения нет»: `||` погнал бы
   * ровный лист на повторный свип.
   */
  const skewAngle =
    options.skewAngle ?? detectSkewAngle(image, { maxAngle, angleStep, maxAnalysisSize });
  const guardAngle = Math.abs(skewAngle);
  const rows = buildShearedProfile(image, 'horizontal', skewAngle, guardAngle);
  const period = measureProfilePeriod(
    rows,
    minStep,
    rows.values.length * maxStepFraction
  );

  if (period.step <= 0 || period.confidence < confidenceThreshold) {
    return toMissingDetection(period.confidence);
  }

  const columns = buildShearedProfile(image, 'vertical', skewAngle, guardAngle);
  const columnPeriod: ProfilePeriod = measureProfilePeriod(
    columns,
    minStep,
    columns.values.length * maxStepFraction
  );
  const isGrid =
    columnPeriod.confidence >= confidenceThreshold &&
    isSameStep(period.step, columnPeriod.step);
  const ruledSpan = findRuledSpan(rows, period.step, period.phase);
  const columnResponse = buildCombResponse(
    image,
    skewAngle,
    guardAngle,
    period.step,
    period.phase
  );
  const columnRegion = findSignalRegion(
    closeProfileGaps(columnResponse.values, Math.round(period.step)),
    RULING_REGION_LEVEL
  );
  const marginLine = findMarginLine(columns, period.step, image.width);
  const margins: PaperMargins = {
    top: ruledSpan ? ruledSpan.first : 0,
    bottom: ruledSpan ? image.height - ruledSpan.last : 0,
    left: columnRegion ? columnResponse.origin + columnRegion.start : 0,
    right: columnRegion
      ? image.width - (columnResponse.origin + columnRegion.end + 1)
      : 0,
  };

  return {
    isDetected: true,
    step: period.step,
    firstLinePhase: period.phase,
    kind: isGrid ? 'grid' : 'lined',
    margins,
    marginLineX: marginLine && marginLine.x,
    marginLineSide: marginLine && marginLine.side,
    confidence: period.confidence,
  };
};
