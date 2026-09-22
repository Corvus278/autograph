import type {
  PerspectiveBaseRuling,
  PerspectiveFrame,
  RulingPerspectiveDetection,
} from './detectRulingPerspective.types';
import type { RulingPerspective, RulingProjection, SheetImageData } from './paper.types';
import { lineCoordinateAt, lineHeightAt, lineHeightScaleAt } from './rulingPerspective';
import { buildStripProfiles, detrendProfile, toTangent } from './sheetProfile';
import { TRACE_SEARCH_SHARE, traceRulingLines } from './traceRulingLines';

/**
 * Число вертикальных полос, по которым прослеживаются линии. Пяти хватает,
 * чтобы отделить схождение линий по ширине от их изгиба: у вырезки шириной в
 * два десятка шагов полоса выходит около четырёх шагов, и внутри неё линия
 * почти прямая.
 */
const STRIP_COUNT = 5;

/**
 * Наименьшее число линий, по которым имеет смысл подгонять пять параметров
 * гребёнки: на меньшем числе кривизна шага по высоте неотличима от шума.
 */
const MIN_LINES = 6;

/**
 * Наименьшее число найденных узлов подгонки.
 */
const MIN_NODES = 12;

/**
 * Наименьшая доля найденных узлов: при меньшей линии на большой части вырезки
 * не прослежены, и перспектива там — продолжение предсказания.
 */
const MIN_FOUND_SHARE = 0.6;

/**
 * Наибольшая невязка подгонки в долях шага: дальше положения линий не
 * согласуются ни с одной перспективой. Меряется она за вычетом плавной
 * составляющей прогиба — постоянной по столбцу, — иначе изгиб бумаги в полшага
 * уносил бы с собой и перспективу, хотя меряется он отдельно и поверх неё.
 * Прогиб, меняющийся от линии к линии, в невязке остаётся: наклонную его часть
 * модель описывает и выдала бы за перспективу.
 */
const MAX_RESIDUAL_SHARE = 1 / 5;

/**
 * Наибольшая доля узлов, которую подгонка отбрасывает как выбросы сорванной
 * трассы. Сорванный узел — провал, взятый не у своей линии: пятно, текст,
 * тень у края листа. Он один уводит невязку за порог, хотя остальные линии с
 * перспективой согласны. Две сотых — единичные узлы, а не целая полоса или
 * линия: прогиб, который модель не описывает, сидит во многих узлах сразу, и
 * такая доля его невязку не снимет.
 */
const MAX_OUTLIER_SHARE = 0.02;

/**
 * Наибольшее изменение шага между крайними найденными линиями. Спека
 * гарантирует точность до двадцати пяти процентов, а порог держит запас над
 * ней: у тетради, снятой лежащей на столе, шаг по кадру меняется и на четверть.
 *
 * Сорванную трассу порог в одиночку не отделяет — это делают доля найденных
 * узлов, невязка, знаменатель `1 − a·q` в углах кадра и расхождение с прямой
 * гребёнкой. Он остаётся границей, за которой сама модель перспективы
 * перестаёт описывать лист, и калибруется на синтетике, а не на фотографиях.
 */
const MAX_STEP_DRIFT = 0.35;

/**
 * Наименьший знаменатель `1 − a·q` модели по кадру. Ближе к нулю высота линии
 * растёт неограниченно, и малая ошибка подгонки уводит строки со страницы.
 */
const MIN_LINE_WEIGHT = 0.5;

/**
 * Наименьшее расхождение перспективной и ровной гребёнки в долях шага, с
 * которого перспективу стоит хранить: меньшее не окупает ни байта хранения, ни
 * пересчёта контуров.
 */
const MIN_DEVIATION_SHARE = 1 / 20;

/**
 * Число параметров гребёнки: наклон, фаза, шаг и два коэффициента схождения.
 */
const PARAMETER_COUNT = 5;

const MAX_FIT_ITERATIONS = 60;

const INITIAL_DAMPING = 1e-3;

const MIN_DAMPING = 1e-9;

const MAX_DAMPING = 1e7;

const DAMPING_DOWN = 1 / 3;

const DAMPING_UP = 5;

const DEGREES_IN_RADIAN = 180 / Math.PI;

/**
 * Узел трассы: линия, прослеженная в полосе.
 */
type TracedNode = {
  /**
   * Столбец центра полосы в пикселях вырезки.
   */
  x: number;

  /**
   * Строка линии в пикселях вырезки.
   */
  y: number;

  /**
   * Номер линии на гребёнке ровного прохода.
   */
  line: number;

  /**
   * Номер полосы.
   */
  strip: number;
};

/**
 * Гребёнка в процессе подгонки: пять параметров, от которых зависит высота
 * линии. Начало отсчёта перспективы в них не входит — оно закреплено за
 * серединой кадра вырезки.
 */
type CombFit = {
  /**
   * Наклон разлиновки в градусах.
   */
  skewAngle: number;

  /**
   * Высота линии с нулевым номером в координате вдоль линий.
   */
  firstLinePhase: number;

  /**
   * Шаг разлиновки в начале перспективы.
   */
  step: number;

  /**
   * Схождение линий по ширине кадра, 1/px.
   */
  convergenceX: number;

  /**
   * Изменение шага по высоте кадра, 1/px.
   */
  convergenceY: number;
};

const toEmptyDetection = (ruling: PerspectiveBaseRuling): RulingPerspectiveDetection => {
  return {
    perspective: null,
    skewAngle: ruling.skewAngle,
    step: ruling.step,
    firstLinePhase: ruling.firstLinePhase,
    foundNodeShare: 0,
    topStep: 0,
    bottomStep: 0,
    deviation: 0,
  };
};

/**
 * Решает систему `matrix · solution = right` методом Гаусса с выбором главного
 * элемента.
 *
 * @param matrix — матрица системы построчно
 * @param right — правая часть
 * @param size — порядок системы
 * @returns решение; `null` — матрица вырождена, и подгонка на этих узлах не
 *   определена
 */
const solveLinearSystem = (
  matrix: Float64Array,
  right: Float64Array,
  size: number
): Float64Array | null => {
  const rows = Float64Array.from(matrix);
  const values = Float64Array.from(right);

  for (let column = 0; column < size; column += 1) {
    let pivot = column;

    for (let row = column + 1; row < size; row += 1) {
      const candidate = Math.abs(rows[row * size + column] || 0);

      if (candidate > Math.abs(rows[pivot * size + column] || 0)) {
        pivot = row;
      }
    }

    const head = rows[pivot * size + column] || 0;

    if (Math.abs(head) < Number.EPSILON) {
      return null;
    }

    if (pivot !== column) {
      for (let index = 0; index < size; index += 1) {
        const swapped = rows[pivot * size + index] || 0;

        rows[pivot * size + index] = rows[column * size + index] || 0;
        rows[column * size + index] = swapped;
      }

      const swapped = values[pivot] || 0;

      values[pivot] = values[column] || 0;
      values[column] = swapped;
    }

    for (let row = column + 1; row < size; row += 1) {
      const factor = (rows[row * size + column] || 0) / head;

      if (factor !== 0) {
        for (let index = column; index < size; index += 1) {
          rows[row * size + index] =
            (rows[row * size + index] || 0) - factor * (rows[column * size + index] || 0);
        }

        values[row] = (values[row] || 0) - factor * (values[column] || 0);
      }
    }
  }

  const solution = new Float64Array(size);

  for (let row = size - 1; row >= 0; row -= 1) {
    let sum = values[row] || 0;

    for (let column = row + 1; column < size; column += 1) {
      sum -= (rows[row * size + column] || 0) * (solution[column] || 0);
    }

    solution[row] = sum / (rows[row * size + row] || 1);
  }

  return solution;
};

/**
 * Проекция гребёнки: наклон и перспектива в форме модели. При нулевых
 * коэффициентах схождения `lineHeightAt` по ней даёт ровную наклонную гребёнку.
 *
 * @param fit — параметры гребёнки
 * @param originX — начало перспективы по ширине
 * @param originY — начало перспективы по высоте
 * @returns проекция для модели координаты вдоль линий
 */
const toProjection = (
  fit: CombFit,
  originX: number,
  originY: number
): RulingProjection => {
  return {
    skewAngle: fit.skewAngle,
    perspective: {
      originX,
      originY,
      convergenceX: fit.convergenceX,
      convergenceY: fit.convergenceY,
    },
  };
};

/**
 * Высота линии `line` гребёнки в столбце `x`.
 */
const computeLineY = (
  fit: CombFit,
  originX: number,
  originY: number,
  x: number,
  line: number
): number => {
  return lineHeightAt(
    toProjection(fit, originX, originY),
    x,
    fit.firstLinePhase + line * fit.step
  );
};

/**
 * Невязки подгонки во всех узлах.
 */
const computeResiduals = (
  nodes: TracedNode[],
  originX: number,
  originY: number,
  fit: CombFit
): number[] => {
  return nodes.map((node) => {
    return computeLineY(fit, originX, originY, node.x, node.line) - node.y;
  });
};

const computeCost = (
  nodes: TracedNode[],
  originX: number,
  originY: number,
  fit: CombFit
): number => {
  return computeResiduals(nodes, originX, originY, fit).reduce((sum, residual) => {
    return sum + residual * residual;
  }, 0);
};

/**
 * Производные высоты линии по пяти параметрам гребёнки в порядке
 * `skewAngle, firstLinePhase, step, convergenceX, convergenceY`.
 *
 * Записаны явно: численные разности на коэффициентах схождения порядка
 * стотысячной доли обратного пикселя теряют значащие цифры, а шаг разности
 * пришлось бы подбирать под каждый параметр отдельно.
 *
 * @param fit — параметры гребёнки
 * @param originX — начало перспективы по ширине
 * @param originY — начало перспективы по высоте
 * @param node — узел трассы
 * @param gradient — массив из пяти чисел, куда пишутся производные
 */
const computeLineGradient = (
  fit: CombFit,
  originX: number,
  originY: number,
  node: TracedNode,
  gradient: Float64Array
): void => {
  const tangent = toTangent(fit.skewAngle);
  const { convergenceX, convergenceY } = fit;
  const offset = fit.firstLinePhase + node.line * fit.step - originY + originX * tangent;
  const offsetX = node.x - originX;
  const scale = 1 + convergenceX * offsetX;
  const weight = 1 - offset * convergenceY;
  const numerator = offset * scale + offsetX * tangent;
  const byOffset = (scale * weight + numerator * convergenceY) / (weight * weight);

  gradient[0] =
    (byOffset * originX + offsetX / weight) *
    ((1 + tangent * tangent) / DEGREES_IN_RADIAN);
  gradient[1] = byOffset;
  gradient[2] = byOffset * node.line;
  gradient[3] = (offset * offsetX) / weight;
  gradient[4] = (numerator * offset) / (weight * weight);
};

const applyDelta = (fit: CombFit, delta: Float64Array): CombFit => {
  return {
    skewAngle: fit.skewAngle + (delta[0] || 0),
    firstLinePhase: fit.firstLinePhase + (delta[1] || 0),
    step: fit.step + (delta[2] || 0),
    convergenceX: fit.convergenceX + (delta[3] || 0),
    convergenceY: fit.convergenceY + (delta[4] || 0),
  };
};

/**
 * Ровная наклонная гребёнка, ближайшая к узлам: линейный метод наименьших
 * квадратов по `y = firstLinePhase + line·step + x·tgθ`. Она — эталон, с
 * которым сравнивается найденная перспектива: хранить перспективу стоит только
 * там, где ровная гребёнка заметно расходится с линиями.
 *
 * @param nodes — узлы трассы
 * @param fallback — гребёнка ровного прохода на случай вырожденной системы
 * @returns ближайшая ровная гребёнка
 */
const fitStraightComb = (nodes: TracedNode[], fallback: CombFit): CombFit => {
  const normal = new Float64Array(9);
  const right = new Float64Array(3);

  nodes.forEach((node) => {
    const basis = [1, node.line, node.x];

    for (let row = 0; row < 3; row += 1) {
      right[row] = (right[row] || 0) + (basis[row] || 0) * node.y;

      for (let column = 0; column < 3; column += 1) {
        normal[row * 3 + column] =
          (normal[row * 3 + column] || 0) + (basis[row] || 0) * (basis[column] || 0);
      }
    }
  });

  const solution = solveLinearSystem(normal, right, 3);

  if (solution === null) {
    return fallback;
  }

  return {
    skewAngle: Math.atan(solution[2] || 0) * DEGREES_IN_RADIAN,
    firstLinePhase: solution[0] || 0,
    step: solution[1] || 0,
    convergenceX: 0,
    convergenceY: 0,
  };
};

/**
 * Подгоняет пять параметров гребёнки по узлам трассы методом
 * Левенберга — Марквардта: Гаусс — Ньютон с демпфированием по диагонали, чтобы
 * шаг не разваливался на параметрах разного масштаба — градусах, пикселях и
 * обратных пикселях.
 *
 * @param nodes — узлы трассы
 * @param originX — начало перспективы по ширине
 * @param originY — начало перспективы по высоте
 * @param initial — начальное приближение: ровная гребёнка без схождения
 * @returns подогнанная гребёнка
 */
const fitPerspectiveComb = (
  nodes: TracedNode[],
  originX: number,
  originY: number,
  initial: CombFit
): CombFit => {
  const gradient = new Float64Array(PARAMETER_COUNT);
  let fit = initial;
  let cost = computeCost(nodes, originX, originY, fit);
  let damping = INITIAL_DAMPING;

  for (let iteration = 0; iteration < MAX_FIT_ITERATIONS; iteration += 1) {
    const normal = new Float64Array(PARAMETER_COUNT * PARAMETER_COUNT);
    const right = new Float64Array(PARAMETER_COUNT);

    nodes.forEach((node) => {
      const residual = computeLineY(fit, originX, originY, node.x, node.line) - node.y;

      computeLineGradient(fit, originX, originY, node, gradient);

      for (let row = 0; row < PARAMETER_COUNT; row += 1) {
        right[row] = (right[row] || 0) - (gradient[row] || 0) * residual;

        for (let column = 0; column < PARAMETER_COUNT; column += 1) {
          normal[row * PARAMETER_COUNT + column] =
            (normal[row * PARAMETER_COUNT + column] || 0) +
            (gradient[row] || 0) * (gradient[column] || 0);
        }
      }
    });

    const damped = Float64Array.from(normal);

    for (let row = 0; row < PARAMETER_COUNT; row += 1) {
      const index = row * PARAMETER_COUNT + row;

      damped[index] = (damped[index] || 0) * (1 + damping);
    }

    const delta = solveLinearSystem(damped, right, PARAMETER_COUNT);

    if (delta === null) {
      return fit;
    }

    const trial = applyDelta(fit, delta);
    const trialCost = computeCost(nodes, originX, originY, trial);

    if (trialCost < cost) {
      fit = trial;
      cost = trialCost;
      damping = Math.max(damping * DAMPING_DOWN, MIN_DAMPING);
    } else {
      damping *= DAMPING_UP;

      if (damping > MAX_DAMPING) {
        return fit;
      }
    }
  }

  return fit;
};

/**
 * Подгонка обеих гребёнок по одному набору узлов.
 */
type NodesFit = {
  /**
   * Узлы, по которым шла подгонка.
   */
  nodes: TracedNode[];

  /**
   * Ближайшая ровная гребёнка.
   */
  straight: CombFit;

  /**
   * Перспективная гребёнка.
   */
  fit: CombFit;

  /**
   * Модули невязок в узлах за вычетом среднего по полосе.
   */
  residuals: number[];

  /**
   * Наибольшая из них.
   */
  maxResidual: number;
};

/**
 * Подгоняет ровную и перспективную гребёнки по узлам и меряет невязку.
 *
 * Из невязок снимается постоянная по столбцу часть — ровно то, что заберёт себе
 * модель изгиба: её узлы стоят столбцами, и одинаковый для всех линий столбца
 * сдвиг она описывает целиком, какой бы он ни был. Дальше снимать нечего: всё,
 * что меняется от линии к линии, — предмет самой проверки, и вместе с ним ушёл
 * бы прогиб, наклонную часть которого подгонка выдаёт за перспективу.
 *
 * @param nodes — узлы трассы
 * @param originX — начало перспективы по ширине
 * @param originY — начало перспективы по высоте
 * @param fallback — гребёнка ровного прохода на случай вырожденной системы; её
 *   `convergenceY` — засев полосовой ступени, начальное приближение схождения
 * @returns обе гребёнки и невязки
 */
const fitNodes = (
  nodes: TracedNode[],
  originX: number,
  originY: number,
  fallback: CombFit
): NodesFit => {
  const straight = fitStraightComb(nodes, fallback);
  /**
   * Шаг, фазу и наклон подгонка стартует от ровной гребёнки по тем же узлам:
   * ближе к итогу начального приближения для них нет. Схождения по высоте ни
   * одна ровная гребёнка не даёт — его приносит засев полосовой ступени, и
   * только с ним подгонка начинает спуск с нужной стороны от седловины.
   */
  const fit = fitPerspectiveComb(nodes, originX, originY, {
    ...straight,
    convergenceY: fallback.convergenceY,
  });
  const rawResiduals = computeResiduals(nodes, originX, originY, fit);
  const stripSums = new Float64Array(STRIP_COUNT);
  const stripCounts = new Float64Array(STRIP_COUNT);

  rawResiduals.forEach((residual, index) => {
    const strip = nodes[index]?.strip || 0;

    stripSums[strip] = (stripSums[strip] || 0) + residual;
    stripCounts[strip] = (stripCounts[strip] || 0) + 1;
  });

  const residuals = rawResiduals.map((residual, index) => {
    const strip = nodes[index]?.strip || 0;

    return Math.abs(residual - (stripSums[strip] || 0) / (stripCounts[strip] || 1));
  });

  return { nodes, straight, fit, residuals, maxResidual: Math.max(0, ...residuals) };
};

/**
 * Подгоняет гребёнки, отбрасывая по одному узлу с наибольшей невязкой, пока она
 * выше порога и не исчерпан запас выбросов.
 *
 * Выброс ищется по невязке, а не обрывом трассы на скачке местного шага.
 * Сорванный узел у низа листа IMG_1596 меняет местный шаг на 0,12–0,32 шага, а
 * волна прогиба от линии к линии на том же снимке — до 0,17: порог скачка либо
 * пропустил бы срыв, либо оборвал бы здоровые трассы вместе со всеми узлами за
 * обрывом. Невязка против подгонки по всем узлам отделяет одиночный срыв от
 * волны, которая сидит во многих узлах сразу.
 *
 * @param nodes — узлы трассы
 * @param originX — начало перспективы по ширине
 * @param originY — начало перспективы по высоте
 * @param fallback — гребёнка ровного прохода на случай вырожденной системы; её
 *   `convergenceY` — засев полосовой ступени
 * @param residualLimit — порог невязки в пикселях
 * @returns подгонка по оставшимся узлам
 */
const fitNodesWithoutOutliers = (
  nodes: TracedNode[],
  originX: number,
  originY: number,
  fallback: CombFit,
  residualLimit: number
): NodesFit => {
  const outlierLimit = Math.floor(nodes.length * MAX_OUTLIER_SHARE);
  let result = fitNodes(nodes, originX, originY, fallback);

  for (
    let dropped = 0;
    dropped < outlierLimit && result.maxResidual > residualLimit;
    dropped += 1
  ) {
    const { residuals, maxResidual } = result;
    const worst = residuals.indexOf(maxResidual);
    const kept = result.nodes.filter((_node, index) => {
      return index !== worst;
    });

    result = fitNodes(kept, originX, originY, fallback);
  }

  return result;
};

/**
 * Знаменатель модели `1 − a·q` в точке кадра. Ноль — точка лежит за горизонтом
 * перспективы, где координата вдоль линий не определена.
 *
 * @param projection — наклон и перспектива
 * @param perspective — та же перспектива, отдельно от проекции
 * @param x — столбец кадра
 * @param y — строка кадра
 * @returns знаменатель модели; `0` — за горизонтом
 */
const computeLineWeight = (
  projection: RulingProjection,
  perspective: RulingPerspective,
  x: number,
  y: number
): number => {
  const offset =
    lineCoordinateAt(projection, x, y) -
    perspective.originY +
    perspective.originX * toTangent(projection.skewAngle);
  const weight = 1 - offset * perspective.convergenceY;

  return weight > 0 ? weight : 0;
};

/**
 * Наибольшее расхождение двух гребёнок по области с линиями. Линия с
 * постоянной координатой вдоль линий прямая, поэтому по ширине хватает краёв
 * вырезки.
 */
const measureCombDeviation = (
  fit: CombFit,
  straight: CombFit,
  originX: number,
  originY: number,
  width: number,
  firstLine: number,
  lastLine: number
): number => {
  let deviation = 0;

  for (let line = firstLine; line <= lastLine; line += 1) {
    for (const x of [0, width - 1]) {
      const difference =
        computeLineY(fit, originX, originY, x, line) -
        computeLineY(straight, originX, originY, x, line);

      deviation = Math.max(deviation, Math.abs(difference));
    }
  }

  return deviation;
};

/**
 * Переводит засев полосовой ступени в начальное приближение `convergenceY`.
 *
 * Засев задан относительным приростом шага на пиксель у своего начала отсчёта,
 * а модель перспективы растит шаг как `1/(1 − a·q)²` от своего — середины
 * вырезки. У нуля `a` прирост равен `2·q`, отсюда `q = k/2`; начало отсчёта
 * едет тем же выражением, что и сам шаг, потому что относительный прирост
 * `k` у точки `Δ` от начала засева равен `k/(1 + k·Δ)`.
 *
 * Знаменатель ушёл в ноль — засева нет: такой засев описывает лист, у которого
 * шаг у начала подгонки обратился в ноль, и приближением он быть не может.
 *
 * @param ruling — разлиновка ровного прохода вместе с засевом
 * @param originX — начало перспективы по ширине
 * @param originY — начало перспективы по высоте
 * @returns начальное схождение по высоте, 1/px
 */
const toSeededConvergenceY = (
  ruling: PerspectiveBaseRuling,
  originX: number,
  originY: number
): number => {
  const { convergenceSeed, convergenceOrigin, skewAngle } = ruling;

  if (!convergenceSeed) {
    return 0;
  }

  const offset =
    originY - originX * Math.tan(skewAngle / DEGREES_IN_RADIAN) - convergenceOrigin;
  const weight = 1 + convergenceSeed * offset;

  return weight > 0 ? convergenceSeed / (2 * weight) : 0;
};

/**
 * Меряет перспективу разлиновки: как меняется шаг горизонтальных линий по
 * высоте и как линии сходятся по ширине. Вход — вырезка внутри листа и
 * разлиновка ровного прохода по ней; все величины результата — в пикселях
 * вырезки.
 *
 * Линии прослеживаются по высоте в пяти вертикальных полосах, по узлам трассы
 * подгоняется гребёнка из пяти параметров, и найденная перспектива проходит
 * проверку надёжности. Не прошла — `null`: лист остаётся ровным, строки на нём
 * идут по равномерной гребёнке, отдельного сообщения пользователю нет.
 *
 * @param image — полутоновая выжимка вырезки внутри листа
 * @param ruling — разлиновка ровного прохода по той же вырезке
 * @param frame — кадр фотографии, в который попала вырезка
 * @returns перспектива и числа, по которым принято решение
 */
export const detectRulingPerspective = (
  image: SheetImageData,
  ruling: PerspectiveBaseRuling,
  frame: PerspectiveFrame
): RulingPerspectiveDetection => {
  const { step, firstLinePhase, skewAngle, margins } = ruling;
  const { width, height } = image;

  if (step <= 0 || width < STRIP_COUNT) {
    return toEmptyDetection(ruling);
  }

  const strips = buildStripProfiles(
    image,
    'horizontal',
    skewAngle,
    Math.abs(skewAngle),
    STRIP_COUNT
  );

  if (strips.length !== STRIP_COUNT) {
    return toEmptyDetection(ruling);
  }

  const origin = strips[0]?.origin || 0;
  const detrended = strips.map((strip) => {
    return detrendProfile(strip.values, 2 * Math.round(step) + 1);
  });
  const size = detrended[0]?.length || 0;
  const reach = step * TRACE_SEARCH_SHARE;
  /**
   * Координата линии `line` ровной гребёнки в бинах профиля: бины отсчитаны от
   * `origin`, а координата вдоль линий — от верха вырезки.
   */
  const lineOffset = firstLinePhase - origin;
  const firstLine = Math.max(
    Math.ceil((margins.top - firstLinePhase) / step),
    Math.ceil((1 + reach - lineOffset) / step)
  );
  const lastLine = Math.min(
    Math.floor((height - margins.bottom - firstLinePhase) / step),
    Math.floor((size - 2 - reach - lineOffset) / step)
  );
  const lineCount = lastLine - firstLine + 1;

  if (lineCount < MIN_LINES) {
    return toEmptyDetection(ruling);
  }

  const tangent = toTangent(skewAngle);
  const columns = Array.from({ length: STRIP_COUNT }, (_item, strip) => {
    return ((strip + 0.5) * width) / STRIP_COUNT;
  });

  /**
   * Строка линии в кадре вырезки: профиль полосы схлопнут вдоль наклона, и его
   * бин — координата вдоль линий, которую центр полосы возвращает в кадр.
   */
  const toLineY = (position: number, column: number): number => {
    return position + origin + column * tangent;
  };

  const traced = traceRulingLines(detrended, {
    lineOffset,
    step,
    firstLine,
    lastLine,
    middleLine: Math.round((height / 2 - firstLinePhase) / step),
  });

  if (traced === null) {
    return toEmptyDetection(ruling);
  }

  /**
   * Предсказанная линия ведёт трассу, но узлом не становится: измерения за ней
   * нет, а подгонка обязана идти по найденным линиям.
   */
  const nodes = columns.flatMap((x, strip) => {
    return traced.reduce<TracedNode[]>((stripNodes, line, index) => {
      const dip = line[strip]?.dip;

      if (dip) {
        stripNodes.push({
          x,
          y: toLineY(dip.position, x),
          line: firstLine + index,
          strip,
        });
      }

      return stripNodes;
    }, []);
  });

  const foundNodeShare = nodes.length / (lineCount * STRIP_COUNT);

  if (nodes.length < MIN_NODES) {
    return { ...toEmptyDetection(ruling), foundNodeShare };
  }

  const originX = width / 2;
  const originY = height / 2;
  const residualLimit = step * MAX_RESIDUAL_SHARE;
  const { straight, fit, maxResidual, ...fitted } = fitNodesWithoutOutliers(
    nodes,
    originX,
    originY,
    {
      skewAngle,
      firstLinePhase,
      step,
      convergenceX: 0,
      convergenceY: toSeededConvergenceY(ruling, originX, originY),
    },
    residualLimit
  );
  const projection = toProjection(fit, originX, originY);
  const perspective = projection.perspective || null;
  const foundLines = fitted.nodes.map((node) => {
    return node.line;
  });
  const topLine = Math.min(...foundLines);
  const bottomLine = Math.max(...foundLines);

  const toLocalStep = (line: number): number => {
    return (
      lineHeightScaleAt(projection, originX, fit.firstLinePhase + line * fit.step) *
      fit.step
    );
  };

  const topStep = toLocalStep(topLine);
  const bottomStep = toLocalStep(bottomLine);
  const deviation = measureCombDeviation(
    fit,
    straight,
    originX,
    originY,
    width,
    topLine,
    bottomLine
  );
  /**
   * Углы кадра фотографии в пикселях вырезки: перспектива измерена по вырезке,
   * а держаться вдали от горизонта обязана по всему кадру.
   */
  const minWeight =
    perspective === null
      ? 0
      : Math.min(
          ...[-frame.left, frame.width - frame.left - 1].flatMap((x) => {
            return [-frame.top, frame.height - frame.top - 1].map((y) => {
              return computeLineWeight(projection, perspective, x, y);
            });
          })
        );
  const isReliable =
    perspective !== null &&
    fit.step > 0 &&
    foundNodeShare >= MIN_FOUND_SHARE &&
    maxResidual <= residualLimit &&
    Math.abs(bottomStep - topStep) <= MAX_STEP_DRIFT * Math.min(topStep, bottomStep) &&
    minWeight >= MIN_LINE_WEIGHT &&
    deviation >= step * MIN_DEVIATION_SHARE;

  return {
    perspective: isReliable ? perspective : null,
    skewAngle: isReliable ? fit.skewAngle : skewAngle,
    step: isReliable ? fit.step : step,
    firstLinePhase: isReliable ? fit.firstLinePhase : firstLinePhase,
    foundNodeShare,
    topStep,
    bottomStep,
    deviation,
  };
};
