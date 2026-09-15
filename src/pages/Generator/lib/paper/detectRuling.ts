import { detectRulingBend, type RulingBendRegion } from './detectRulingBend';
import { detectSkewAngle, MAX_SKEW_ANGLE, SKEW_ANGLE_STEP } from './detectSkewAngle';
import { ANALYSIS_IMAGE_SIZE } from './downsampleSheetImage';
import type { PaperMargins, RulingDetection, SheetImageData } from './paper.types';
import { measureProfilePeriod, type ProfilePeriod } from './profilePeriod';
import {
  buildBandCombResponses,
  buildColumnProfiles,
  buildShearedProfile,
  buildStripProfiles,
  closeProfileGaps,
  detrendProfile,
  findSignalRegion,
  refinePeakOffset,
  type ShearedProfile,
  toTangent,
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
 * На сколько вертикальных полос режется кадр, когда ищутся верхний и нижний
 * края разлиновки. На снимке телефоном крайние линии не прямые: перспектива и
 * прогиб страницы разводят концы одной линии на полшага, и в профиле,
 * усреднённом по всей ширине, её провал выходит почти втрое мельче, чем в
 * узкой полосе. В восьмой доле ширины линия почти прямая. Глубина линии
 * берётся медианой по полосам: полоса без линий — чистое поле или спираль
 * тетради — медиану не сдвигает, пока линии есть в большинстве полос.
 */
const RULED_SPAN_STRIPS = 8;

/**
 * Доля от глубины линий, ниже которой линия у верхнего или нижнего края
 * разлиновки считается отсутствующей. Над разлиновкой пресет-пака чистое поле
 * не поднимается выше шести сотых от глубины линий, а крайние линии на снимке
 * телефоном, мягче и бледнее средних, держатся от трети с лишним. Две десятых
 * лежат в этом разрыве. Половинный порог, как у боковых границ, отрезал бы
 * бледные верх и низ, и поле выросло бы до середины листа.
 */
const RULED_SPAN_LEVEL = 0.2;

/**
 * Зазор от найденной боковой границы разлиновки до края блока в долях шага.
 * На листе без линии поля полем служит сама граница области с линиями — у
 * тетради в клетку это крайняя линия сетки, — и блок, выложенный от неё,
 * ставит первую букву на границу или за неё. Доля та же, что у зазора до линии
 * поля (`MARGIN_LINE_GAP_SHARE` в `lib/calibrate`): граница играет её роль.
 * Зазор кладётся в поле здесь, а не в раскладке: там уже не видно, найдено
 * поле или взято фолбэком в полтора шага, которому зазор не нужен.
 */
const RULED_EDGE_GAP_SHARE = 0.2;

/**
 * Доля типичной глубины горизонтальных линий, начиная с которой вертикальная
 * гребёнка с тем же шагом считается клеткой. Клетка печатается одной краской в
 * обе стороны: на снимках пресет-пака и на фотографии тетради медиана глубины
 * вертикальных линий — от трёх четвертей горизонтальных, а на линейке
 * вертикальная гребёнка — шум в сотую долю: одиночная линия поля медиану по
 * линиям не поднимает. Две десятых лежат в этом разрыве.
 */
const GRID_COLUMN_LEVEL = 0.2;

/**
 * Доля шага, на которую линия может уйти от арифметической гребёнки и всё ещё
 * считаться своей. У края кадра лист тянет объектив или изгиб страницы: на
 * снимках линейки пресет-пака нижние линии стоят на восьмую шага выше
 * предсказанного места. Шестая доля — запас сверх этого и всё ещё далеко от
 * половины шага, где окно доставало бы соседнюю линию.
 */
const LINE_SEARCH_SHARE = 1 / 6;

/**
 * Высота горизонтальной полосы, по которой прослеживается вертикальная
 * граница, в шагах разлиновки. Полоса отдаёт среднее положение границы по
 * своей высоте: у параболического изгиба с крайней точкой у края области
 * крайняя из восьми полос на кадр набирает лишь 0,77 амплитуды, а в полосе в
 * полтора шага недобор ничтожен.
 */
const TRACE_STRIP_STEPS = 1.5;

/**
 * Наименьшее число полос трассировки на кадр: при шаге, крупном для кадра,
 * полос в полтора шага вышло бы меньше, чем нужно, чтобы увидеть изгиб.
 */
const MIN_TRACE_STRIPS = 8;

/**
 * Полуширина окна, в котором ищется старт трассировки, в долях шага. Окно
 * стоит вокруг положения по профилю во всю высоту, а оно у изогнутой линии
 * отстоит от самой внутренней точки на две трети амплитуды: при изгибе в три
 * десятых шага это пятая часть шага — шире окна продолжения трассы.
 */
const TRACE_START_SHARE = 1 / 3;

/**
 * Доля глубины стартового узла, с которой принимается узел в следующей
 * полосе. На клетке в окно трассы попадают обычные вертикали, а детектор
 * гарантирует лишь, что линия поля в полтора раза глубже девятой децили
 * вертикалей (`MARGIN_LINE_DEPTH_RATIO`), и десятая часть вертикалей глубже
 * этой децили. Порог в две трети совпал бы с порогом детектора без запаса,
 * тогда как узкая полоса шумнее профиля во всю высоту.
 */
const TRACE_DEPTH_SHARE = 0.8;

/**
 * Высота полосы вдоль линий, по которой ищутся концы горизонтальных линий, в
 * шагах. Целое число шагов: на целом числе периодов `cos` и `sin` фазы
 * гребёнки гасят постоянный фон.
 */
const LINE_END_BAND_STEPS = 2;

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

  /**
   * Доля узлов области с линиями, где при измерении изгиба линия нашлась, от 0
   * до 1. Есть и при `bend: null`: по ней сборка профилей показывает, почему
   * изгиб отброшен, и сверяет пороги надёжности.
   */
  bendFoundNodeShare: number;

  /**
   * Наклон в градусах, при котором измерена разлиновка: заданный в настройках
   * или найденный свипом. Есть и у ненайденной разлиновки: импорт кладёт его в
   * лист, ждущий ручного ввода.
   */
  skewAngle: number;
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

const toMissingDetection = (confidence: number, skewAngle: number): DetectedRuling => {
  return {
    isDetected: false,
    skewAngle,
    step: 0,
    firstLinePhase: 0,
    kind: 'blank',
    margins: NO_MARGINS,
    marginLineX: null,
    marginLineSide: null,
    bend: null,
    perspective: null,
    bendFoundNodeShare: 0,
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

  /**
   * Цепочка начинается с первой линии, попавшей в профиль: выше неё профиль
   * кончается раньше, чем уместилась бы ещё одна линия.
   */
  isAtProfileStart: boolean;

  /**
   * Цепочка кончается последней линией, попавшей в профиль.
   */
  isAtProfileEnd: boolean;

  /**
   * Типичная глубина линии — девятая децила по линиям профиля: с ней
   * сравнивается гребёнка вертикальных линий клетки.
   */
  depth: number;
};

/**
 * Линии гребёнки, опрошенные на профилях полос кадра.
 */
type CombDepths = {
  /**
   * Координаты линий, попавших в профиль, в пикселях фотографии.
   */
  positions: number[];

  /**
   * Глубина каждой линии — медиана по полосам.
   */
  depths: number[];
};

/**
 * Крайние вертикальные линии клетки в пикселях фотографии.
 */
type GridColumns = {
  /**
   * Первая вертикальная линия; `null` — линии доходят до левого края профиля.
   */
  left: number | null;

  /**
   * Последняя вертикальная линия; `null` — линии доходят до правого края профиля.
   */
  right: number | null;
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
 * Глубина самого тёмного бина в окне вокруг предсказанной линии.
 *
 * @param detrended — профиль без фона: линия в нём — отрицательный провал
 * @param bin — бин предсказанной линии
 * @param reach — полуширина окна в бинах
 * @returns глубина провала; ноль — в окне нет ничего темнее фона
 */
const measureLineDepth = (
  detrended: Float64Array,
  bin: number,
  reach: number
): number => {
  let depth = 0;

  for (let offset = -reach; offset <= reach; offset += 1) {
    depth = Math.max(depth, -(detrended[bin + offset] || 0));
  }

  return depth;
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

const detrendStrips = (strips: ShearedProfile[], step: number): Float64Array[] => {
  return strips.map((strip) => {
    return detrendProfile(strip.values, 2 * Math.round(step) + 1);
  });
};

const toLineReach = (step: number): number => {
  return Math.max(1, Math.round(step * LINE_SEARCH_SHARE));
};

/**
 * Опрашивает профили полос в предсказанных положениях линий гребёнки.
 *
 * Глубина линии берётся в окне вокруг предсказанного положения, а не в самом
 * бине: линии у края кадра уходят с гребёнки, и без окна цепочка рвалась бы
 * перед ними. Окно меряется в каждой полосе отдельно, и глубиной линии служит
 * медиана по полосам.
 *
 * @param detrendedStrips — профили полос без фона с общими бинами
 * @param origin — координата нулевого бина в пикселях фотографии
 * @param step — шаг гребёнки в пикселях
 * @param phase — смещение линий по модулю шага
 * @returns координаты и глубины линий, попавших в профиль, по порядку
 */
const measureCombDepths = (
  detrendedStrips: Float64Array[],
  origin: number,
  step: number,
  phase: number
): CombDepths => {
  const size = detrendedStrips[0]?.length || 0;
  const firstLine = Math.ceil((origin - phase) / step);
  const lastLine = Math.floor((origin + size - 1 - phase) / step);
  const reach = toLineReach(step);
  const positions: number[] = [];
  const depths: number[] = [];

  for (let line = firstLine; line <= lastLine; line += 1) {
    const coordinate = phase + line * step;
    const bin = Math.round(coordinate) - origin;

    positions.push(coordinate);
    depths.push(
      computeMedian(
        detrendedStrips.map((detrended) => {
          return measureLineDepth(detrended, bin, reach);
        })
      )
    );
  }

  return { positions, depths };
};

/**
 * Глубина провала в бине профиля полосы: насколько бин темнее скользящей
 * медианы окном в шаг. Медиана, а не среднее: узкий провал линии её не
 * сдвигает, а горизонталь, пересекающая полосу, меняется по столбцам
 * медленнее окна и уходит в фон.
 */
const measureStripDepth = (values: Float64Array, bin: number, window: number): number => {
  const half = Math.max(1, Math.floor(window / 2));
  const to = Math.min(values.length, bin + half + 1);
  const slice: number[] = [];

  for (let inner = Math.max(0, bin - half); inner < to; inner += 1) {
    slice.push(values[inner] || 0);
  }

  return computeMedian(slice) - (values[bin] || 0);
};

/**
 * Положение вертикальной линии в одной полосе.
 */
type TraceNode = {
  /**
   * Положение линии в пикселях фотографии.
   */
  position: number;

  /**
   * Глубина провала линии.
   */
  depth: number;
};

/**
 * Самый глубокий провал в окне вокруг предсказанного положения линии,
 * уточнённый по соседним бинам.
 *
 * @param strip — профиль столбцов одной полосы
 * @param center — предсказанное положение линии в пикселях фотографии
 * @param reach — полуширина окна в пикселях
 * @param window — ширина окна фона в бинах
 * @returns положение и глубина провала; `null` — в окне нет ничего темнее фона
 */
const findStripDip = (
  strip: ShearedProfile,
  center: number,
  reach: number,
  window: number
): TraceNode | null => {
  const { values, origin } = strip;
  const from = Math.max(1, Math.round(center - reach) - origin);
  const to = Math.min(values.length - 2, Math.round(center + reach) - origin);
  let peak = -1;
  let depth = 0;

  for (let bin = from; bin <= to; bin += 1) {
    const binDepth = measureStripDepth(values, bin, window);

    if (binDepth > depth) {
      peak = bin;
      depth = binDepth;
    }
  }

  if (peak < 0) {
    return null;
  }

  const offset = refinePeakOffset(
    measureStripDepth(values, peak - 1, window),
    depth,
    measureStripDepth(values, peak + 1, window)
  );

  return { position: origin + peak + offset, depth };
};

/**
 * Прослеживает вертикальную линию по горизонтальным полосам кадра. Старт — в
 * полосе, где провал в окне `TRACE_START_SHARE` вокруг `center` глубже всего;
 * дальше вверх и вниз окно `LINE_SEARCH_SHARE` идёт за положением в последней
 * полосе, где линия нашлась. Полоса с провалом мельче `TRACE_DEPTH_SHARE`
 * стартового не голосует, и трасса идёт дальше от последнего узла: у спирали
 * и края листа линии может не быть, а на клетке в окно попадают обычные
 * вертикали.
 *
 * @param strips — профили столбцов по полосам, сверху вниз
 * @param center — положение линии по профилю во всю высоту
 * @param step — шаг разлиновки в пикселях
 * @param minDepth — наименьшая глубина стартового узла
 * @returns положения линии в полосах, где она нашлась, сверху вниз; пустой
 *   список — стартового узла нет
 */
const traceVerticalLine = (
  strips: ShearedProfile[],
  center: number,
  step: number,
  minDepth: number
): number[] => {
  const window = Math.max(3, Math.round(step));
  const starts = strips.map((strip) => {
    return findStripDip(strip, center, step * TRACE_START_SHARE, window);
  });
  const startIndex = starts.reduce((best, node, index) => {
    return node && node.depth > (starts[best]?.depth || 0) ? index : best;
  }, 0);
  const start = starts[startIndex];

  if (!start || start.depth < minDepth) {
    return [];
  }

  const reach = step * LINE_SEARCH_SHARE;
  const threshold = start.depth * TRACE_DEPTH_SHARE;
  const positions = strips.map((): number | null => {
    return null;
  });

  positions[startIndex] = start.position;

  for (const direction of [-1, 1]) {
    let previous = start.position;

    for (
      let index = startIndex + direction;
      index >= 0 && index < strips.length;
      index += direction
    ) {
      const strip = strips[index];
      const node = strip ? findStripDip(strip, previous, reach, window) : null;

      if (node && node.depth >= threshold) {
        positions[index] = node.position;
        previous = node.position;
      }
    }
  }

  return positions.reduce<number[]>((found, position) => {
    if (position !== null) {
      found.push(position);
    }

    return found;
  }, []);
};

/**
 * Самое внутреннее положение границы по полосам. Перед выбором положение в
 * каждой полосе заменяется медианой по ней и двум соседним: узкая полоса
 * шумнее профиля во всю высоту, и одиночный выброс внутрь сузил бы блок на
 * всей странице. У крайней полосы недостающим соседом служит она сама.
 *
 * @param positions — положения границы по порядку полос
 * @param isLeftBorder — граница слева от области письма: самое внутреннее
 *   положение — наибольшее, иначе наименьшее
 * @returns самое внутреннее положение; `null` — ни одна полоса не голосовала
 */
const pickInnermost = (positions: number[], isLeftBorder: boolean): number | null => {
  if (positions.length === 0) {
    return null;
  }

  const last = positions.length - 1;
  const smoothed = positions.map((position, index) => {
    return computeMedian([
      positions[Math.max(0, index - 1)] || 0,
      position,
      positions[Math.min(last, index + 1)] || 0,
    ]);
  });

  return isLeftBorder ? Math.max(...smoothed) : Math.min(...smoothed);
};

/**
 * Полосы трассировки, по высоте пересекающие область с линиями у столбца
 * `lineX`: строк над разлиновкой и под ней нет, и граница, изогнутая только
 * там, не должна сужать блок.
 *
 * @param strips — профили столбцов по полосам равной высоты, сверху вниз
 * @param height — высота кадра
 * @param span — область с линиями; `null` — не найдена, берутся все полосы
 * @param tangent — тангенс наклона разлиновки
 * @param lineX — столбец, у которого стоит прослеживаемая линия
 * @returns полосы, пересекающие область, сверху вниз
 */
const selectSpanStrips = (
  strips: ShearedProfile[],
  height: number,
  span: RuledSpan | null,
  tangent: number,
  lineX: number
): ShearedProfile[] => {
  if (!span || strips.length === 0) {
    return strips;
  }

  const stripHeight = height / strips.length;
  const from = Math.max(0, Math.floor((span.first + lineX * tangent) / stripHeight));
  const to = Math.min(
    strips.length,
    Math.ceil((span.last + lineX * tangent) / stripHeight)
  );

  return strips.slice(from, Math.max(from + 1, to));
};

/**
 * Уточняет линию поля трассировкой по полосам: берётся её самое внутреннее
 * положение, но не наружу от положения по профилю во всю высоту. Профиль во
 * всю высоту отдаёт среднее положение изогнутой линии, и блок, выложенный от
 * него, заходил бы за линию там, где она изогнута внутрь.
 *
 * @param marginLine — линия поля по профилю во всю высоту
 * @param strips — профили столбцов по полосам внутри области с линиями
 * @param step — шаг разлиновки в пикселях
 * @returns линия поля в самом внутреннем положении
 */
const refineMarginLine = (
  marginLine: MarginLine,
  strips: ShearedProfile[],
  step: number
): MarginLine => {
  const { x, side } = marginLine;
  const innermost = pickInnermost(
    traceVerticalLine(strips, x, step, MARGIN_LINE_MIN_DEPTH),
    side === 'left'
  );

  if (innermost === null) {
    return marginLine;
  }

  switch (side) {
    case 'left': {
      return { x: Math.max(x, innermost), side };
    }

    case 'right': {
      return { x: Math.min(x, innermost), side };
    }

    default: {
      throw new Error(`Неизвестная сторона линии поля: ${side}`);
    }
  }
};

/**
 * Боковые границы области с горизонтальными линиями в пикселях фотографии.
 */
type RowBorders = {
  /**
   * Левая граница; 0 — линии доходят до левого края.
   */
  left: number;

  /**
   * Правая граница; ширина кадра — линии доходят до правого края.
   */
  right: number;
};

const computePooledQuantile = (profiles: Float64Array[], quantile: number): number => {
  const total = profiles.reduce((sum, values) => {
    return sum + values.length;
  }, 0);
  const pooled = new Float64Array(total);
  let offset = 0;

  for (const values of profiles) {
    pooled.set(values, offset);
    offset += values.length;
  }

  pooled.sort();

  return pooled[Math.min(total - 1, Math.floor(total * quantile))] || 0;
};

/**
 * Есть ли на отрезке `[from, to)` ряда участок не короче `length` отсчётов
 * подряд с уровнем не ниже `threshold`.
 */
const hasSignalRun = (
  values: Float64Array,
  from: number,
  to: number,
  threshold: number,
  length: number
): boolean => {
  let run = 0;

  for (let index = from; index < to; index += 1) {
    run = (values[index] || 0) >= threshold ? run + 1 : 0;

    if (run >= length) {
      return true;
    }
  }

  return false;
};

/**
 * Уточняет боковые границы области с линиями по полосам вдоль линий высотой
 * `LINE_END_BAND_STEPS` (`buildBandCombResponses`): граница берётся в каждой
 * полосе, итог — самая внутренняя, но не наружу от границы по отклику во всю
 * высоту. Отклик во всю высоту усредняет концы линий, и у линий, кончающихся на
 * разном отступе, граница выходит между крайними концами.
 *
 * Обрыв в полосе голосует, только если за ним нет участка длиной в шаг с
 * откликом не ниже половины девятой децили, общей для всех полос: бледное
 * пятно на нескольких соседних полосах рвёт отклик каждой из них, и медиана по
 * трём полосам его не снимает, но за пятном линии продолжаются. Участок короче
 * шага — пятно спирали или ступень яркости у края стола — голосу не мешает.
 *
 * Полосы берутся только внутри области с линиями по высоте: над разлиновкой и
 * под ней отклика нет, и там обрыв вышел бы на всю ширину. Сторона, где отклик
 * во всю высоту дошёл до края профиля, тоже уточняется: защитная полоса
 * наклона во всю высоту кадра шире, чем у полосы, и прячет концы у края кадра.
 *
 * @param image — полутоновая выжимка
 * @param skewAngle — наклон разлиновки в градусах
 * @param period — шаг и фаза горизонтальных линий
 * @param span — область с линиями по высоте
 * @param borders — границы по отклику во всю высоту
 * @returns уточнённые границы
 */
const refineRowBorders = (
  image: SheetImageData,
  skewAngle: number,
  period: ProfilePeriod,
  span: RuledSpan | null,
  borders: RowBorders
): RowBorders => {
  const { step, phase } = period;

  if (!span) {
    return borders;
  }

  const firstLine = Math.round((span.first - phase) / step);
  const lastLine = Math.round((span.last - phase) / step);
  const bandCount = Math.floor((lastLine - firstLine + 1) / LINE_END_BAND_STEPS);

  if (bandCount < 1) {
    return borders;
  }

  /**
   * Границы полос — посередине между линиями: изгиб до трёх десятых шага их не
   * пересекает. Остаток линий, не набравший полосы, уходит в последнюю.
   */
  const alongEdges = Array.from({ length: bandCount + 1 }, (_item, band) => {
    const line =
      band === bandCount ? lastLine + 1 : firstLine + band * LINE_END_BAND_STEPS;

    return phase + (line - 0.5) * step;
  });
  const window = Math.max(1, Math.round(step));
  const bands = buildBandCombResponses(image, skewAngle, step, phase, alongEdges).map(
    ({ values, origin }) => {
      return { values: closeProfileGaps(values, window), origin };
    }
  );
  const threshold =
    RULING_REGION_LEVEL *
    computePooledQuantile(
      bands.map(({ values }) => {
        return values;
      }),
      0.9
    );
  const leftVotes: number[] = [];
  const rightVotes: number[] = [];

  for (const { values, origin } of bands) {
    const region = findSignalRegion(values, RULING_REGION_LEVEL);

    if (
      region &&
      region.start > 0 &&
      !hasSignalRun(values, 0, region.start, threshold, window)
    ) {
      leftVotes.push(origin + region.start);
    }

    if (
      region &&
      region.end < values.length - 1 &&
      !hasSignalRun(values, region.end + 1, values.length, threshold, window)
    ) {
      rightVotes.push(origin + region.end + 1);
    }
  }

  const left = pickInnermost(leftVotes, true);
  const right = pickInnermost(rightVotes, false);

  return {
    left: left === null ? borders.left : Math.max(borders.left, left),
    right: right === null ? borders.right : Math.min(borders.right, right),
  };
};

/**
 * Ищет крайние вертикальные линии клетки.
 *
 * Шаг берётся у горизонтальных линий, а фаза подбирается перебором: клетка
 * квадратная, а автокорреляцию столбцов на снимке тетради сбивают край листа и
 * спираль — периода там не находится вовсе.
 *
 * Крайняя линия прослеживается по узким полосам (`traceVerticalLine`), и
 * берётся самое внутреннее её положение, но не дальше окна `LINE_SEARCH_SHARE`
 * наружу от прямой гребёнки: на снимке телефоном вертикальная линия наклонена
 * или изогнута иначе, чем разлиновка в среднем, и граница по гребёнке у одного
 * из краёв листа легла бы за линию.
 *
 * @param strips — профили столбцов по горизонтальным полосам кадра
 * @param step — шаг горизонтальных линий в пикселях
 * @param rowDepth — типичная глубина горизонтальной линии
 * @param selectTraceStrips — полосы трассировки для линии у заданного столбца
 * @returns крайние вертикальные линии; `null` — вертикальных линий клетки нет
 */
const findGridColumns = (
  strips: ShearedProfile[],
  step: number,
  rowDepth: number,
  selectTraceStrips: (lineX: number) => ShearedProfile[]
): GridColumns | null => {
  const origin = strips[0]?.origin || 0;
  const detrendedStrips = detrendStrips(strips, step);
  let best: CombDepths = { positions: [], depths: [] };
  let bestScore = 0;

  for (let phase = 0; phase < step; phase += 1) {
    const comb = measureCombDepths(detrendedStrips, origin, step, phase);
    const score = computeMedian(comb.depths);

    if (score > bestScore) {
      best = comb;
      bestScore = score;
    }
  }

  const { positions, depths } = best;
  const region = findSignalRegion(Float64Array.from(depths), RULED_SPAN_LEVEL);

  if (bestScore <= 0 || bestScore < rowDepth * GRID_COLUMN_LEVEL || !region) {
    return null;
  }

  const threshold = computeQuantile(depths, 0.9) * RULED_SPAN_LEVEL;
  const firstLine = positions[region.start] || 0;
  const lastLine = positions[region.end] || 0;
  const hasLeft = region.start > 0;
  const hasRight = region.end < depths.length - 1;
  const innermostLeft =
    hasLeft &&
    pickInnermost(
      traceVerticalLine(selectTraceStrips(firstLine), firstLine, step, threshold),
      true
    );
  const innermostRight =
    hasRight &&
    pickInnermost(
      traceVerticalLine(selectTraceStrips(lastLine), lastLine, step, threshold),
      false
    );

  /**
   * Наружу граница уходит от прямой гребёнки не дальше, чем линия ещё считается
   * своей гребёнке: на снимках клетки пресет-пака крайняя вертикаль стоит на
   * четыре пикселя дальше гребёнки, и граница по самой гребёнке сузила бы блок.
   */
  const reach = toLineReach(step);

  return {
    left: hasLeft
      ? Math.max(firstLine - reach, innermostLeft || firstLine - reach)
      : null,
    right: hasRight
      ? Math.min(lastLine + reach, innermostRight || lastLine + reach)
      : null,
  };
};

/**
 * Границы области с линиями: профиль опрашивается в предсказанных положениях
 * линий, и берётся самая длинная непрерывная цепочка тех, что действительно
 * темнее фона. Опрос по предсказанию, а не поиск провалов подряд: шаг и фаза
 * уже известны, и по ним видно не только где линии есть, но и где их не стало.
 *
 * @param strips — профили средней яркости по полосам кадра с общими бинами
 * @param step — шаг разлиновки в пикселях
 * @param phase — смещение линий по модулю шага
 * @returns координаты первой и последней линии, упёрлась ли цепочка в край
 * профиля, и типичная глубина линии; `null` — линий меньше трёх
 */
const findRuledSpan = (
  strips: ShearedProfile[],
  step: number,
  phase: number
): RuledSpan | null => {
  const { positions, depths } = measureCombDepths(
    detrendStrips(strips, step),
    strips[0]?.origin || 0,
    step,
    phase
  );

  if (depths.length < 3) {
    return null;
  }

  const sorted = [...depths].sort((left, right) => {
    return left - right;
  });
  const reference = sorted[Math.floor(sorted.length * 0.9)] || 0;

  if (reference <= 0) {
    return null;
  }

  const threshold = reference * RULED_SPAN_LEVEL;
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

  return {
    first: positions[bestStart] || 0,
    last: positions[bestEnd] || 0,
    isAtProfileStart: bestStart === 0,
    isAtProfileEnd: bestEnd === depths.length - 1,
    depth: reference,
  };
};

const isSameStep = (first: number, second: number): boolean => {
  if (first <= 0 || second <= 0) {
    return false;
  }

  return Math.abs(first - second) / first <= GRID_STEP_TOLERANCE;
};

/**
 * Область измерения изгиба в столбцах кадра: от концов горизонтальных линий,
 * а со стороны линии поля — до неё. Концы и линия поля найдены вдоль
 * вертикалей разлиновки, а полосы изгиба режутся по столбцам кадра: на
 * наклонном листе граница проходит кадр наискосок, и область берётся по её
 * самому внутреннему положению между верхней и нижней линиями. Иначе крайняя
 * полоса на части строк легла бы за концы линий или за линию поля, где трасса
 * цепляется за пятна спирали и чужую линейку.
 *
 * @param image — полутоновая выжимка
 * @param tangent — тангенс наклона разлиновки
 * @param margins — найденные поля: по верхнему и нижнему видно высоту области
 * @param rowBorders — концы горизонтальных линий
 * @param marginLine — линия поля; `null` — её нет
 * @returns горизонтальная область с линиями
 */
const toBendRegion = (
  image: SheetImageData,
  tangent: number,
  margins: PaperMargins,
  rowBorders: RowBorders,
  marginLine: MarginLine | null
): RulingBendRegion => {
  const topShift = margins.top * tangent;
  const bottomShift = (image.height - margins.bottom) * tangent;
  const leftShift = Math.min(topShift, bottomShift);
  const rightShift = Math.max(topShift, bottomShift);
  const left = rowBorders.left > 0 ? rowBorders.left - leftShift : 0;
  const right =
    rowBorders.right < image.width ? rowBorders.right - rightShift : image.width;

  if (!marginLine) {
    return { left, right };
  }

  switch (marginLine.side) {
    case 'left': {
      return { left: Math.max(left, marginLine.x - leftShift), right };
    }

    case 'right': {
      return { left, right: Math.min(right, marginLine.x - rightShift) };
    }

    default: {
      throw new Error(`Неизвестная сторона линии поля: ${marginLine.side}`);
    }
  }
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
 * @returns измеренная разлиновка вместе с наклоном и уверенностью
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
    return toMissingDetection(period.confidence, skewAngle);
  }

  const { columns, response: columnResponse } = buildColumnProfiles(
    image,
    skewAngle,
    guardAngle,
    period.step,
    period.phase
  );
  const columnPeriod: ProfilePeriod = measureProfilePeriod(
    columns,
    minStep,
    columns.values.length * maxStepFraction
  );
  const isGrid =
    columnPeriod.confidence >= confidenceThreshold &&
    isSameStep(period.step, columnPeriod.step);
  const ruledSpan = findRuledSpan(
    buildStripProfiles(image, 'horizontal', skewAngle, guardAngle, RULED_SPAN_STRIPS),
    period.step,
    period.phase
  );
  const tangent = toTangent(skewAngle);
  /**
   * Полосы трассировки строятся лишь раз и лишь тогда, когда есть что
   * прослеживать: на линейке без линии поля проход по кадру не нужен.
   */
  let traceStrips: ShearedProfile[] | null = null;

  const selectTraceStrips = (lineX: number): ShearedProfile[] => {
    traceStrips =
      traceStrips ||
      buildStripProfiles(
        image,
        'vertical',
        skewAngle,
        guardAngle,
        Math.max(
          MIN_TRACE_STRIPS,
          Math.round(image.height / (TRACE_STRIP_STEPS * period.step))
        )
      );

    return selectSpanStrips(traceStrips, image.height, ruledSpan, tangent, lineX);
  };

  const gridColumns =
    ruledSpan &&
    findGridColumns(
      buildStripProfiles(image, 'vertical', skewAngle, guardAngle, RULED_SPAN_STRIPS),
      period.step,
      ruledSpan.depth,
      selectTraceStrips
    );
  const columnRegion = findSignalRegion(
    closeProfileGaps(columnResponse.values, Math.round(period.step)),
    RULING_REGION_LEVEL
  );
  const meanMarginLine = findMarginLine(columns, period.step, image.width);
  const marginLine =
    meanMarginLine &&
    refineMarginLine(meanMarginLine, selectTraceStrips(meanMarginLine.x), period.step);
  /**
   * Сторона, где разлиновка дошла до края профиля, — не найденное поле, а
   * ноль. Профиль начинается не с края кадра, а с защитной полосы, и край
   * области там означает только «линии идут дальше, чем видно»: поле, равное
   * полосе или первой видимой линии, выдало бы за поле обрезку кадра, и блок
   * встал бы вплотную к краю. Ноль отдаёт такую сторону фолбэку.
   *
   * Боковая граница — там, где кончаются горизонтальные линии (самый
   * внутренний конец по полосам), а у клетки, если вертикальные линии короче, —
   * крайняя вертикальная: берётся более узкая из двух. Иначе строка уходит в
   * полосу, где остались одни горизонтальные. Найденные боковые поля отступают
   * от границы внутрь на зазор: граница без линии поля сама служит полем.
   */
  const edgeGap = period.step * RULED_EDGE_GAP_SHARE;
  const rowBorders = refineRowBorders(image, skewAngle, period, ruledSpan, {
    left:
      columnRegion && columnRegion.start > 0
        ? columnResponse.origin + columnRegion.start
        : 0,
    right:
      columnRegion && columnRegion.end < columnResponse.values.length - 1
        ? columnResponse.origin + columnRegion.end + 1
        : image.width,
  });
  const leftBorder = Math.max(rowBorders.left, (gridColumns && gridColumns.left) || 0);
  const rightBorder = Math.min(
    rowBorders.right,
    (gridColumns && gridColumns.right) || image.width
  );
  const margins: PaperMargins = {
    top: ruledSpan && !ruledSpan.isAtProfileStart ? ruledSpan.first : 0,
    bottom: ruledSpan && !ruledSpan.isAtProfileEnd ? image.height - ruledSpan.last : 0,
    left: leftBorder > 0 ? leftBorder + edgeGap : 0,
    right: rightBorder < image.width ? image.width - rightBorder + edgeGap : 0,
  };
  const bendDetection = detectRulingBend(
    image,
    { step: period.step, firstLinePhase: period.phase, skewAngle, margins },
    toBendRegion(image, tangent, margins, rowBorders, marginLine)
  );

  return {
    isDetected: true,
    step: period.step,
    firstLinePhase: period.phase,
    skewAngle,
    kind: isGrid ? 'grid' : 'lined',
    margins,
    marginLineX: marginLine && marginLine.x,
    marginLineSide: marginLine && marginLine.side,
    bend: bendDetection.bend,
    perspective: null,
    bendFoundNodeShare: bendDetection.foundNodeShare,
    confidence: period.confidence,
  };
};
