import { classifyContours, splitContours } from './classifyContours';
import type {
  DeformGlyphOptions,
  GlyphBounds,
  GlyphPathCommand,
  GlyphPoint,
} from './glyph.types';
import { listOnCurvePoints, mapCommandPoints } from './glyphCommands';

/**
 * Амплитуда смещения точки в долях em. Подобрана по спайку: меньше — разницу
 * между вхождениями буквы не видно, больше — буква теряет узнаваемость.
 */
export const DEFAULT_DEFORM_AMPLITUDE = 0.014;

/**
 * Размер ячейки решётки шума в долях em. Ячейка заметно крупнее детали буквы,
 * поэтому соседние точки контура едут в одну сторону, а не по отдельности.
 */
export const DEFAULT_DEFORM_CELL = 0.3;

/**
 * Ширина рампы гашения у границ стыка в долях em.
 *
 * Значение — компромисс, снятый с пака: у́же — деформация успевает растащить
 * тонкие соединения, шире — узкие буквы (`ь`, `с`, `е`) гасятся с обеих сторон
 * сразу и перестают отличаться сами от себя. При этом значении из 738 стыков с
 * заметным перекрытием чернил не рвётся ни один.
 */
export const DEFAULT_SEAM_RAMP = 0.18;

/**
 * Смещение по вертикали берётся из того же шума, что и по горизонтали, но со
 * сдвинутым seed: иначе точка ездит строго по диагонали.
 */
const VERTICAL_SEED_SALT = 0x9e37_79b9;

/**
 * Множители целочисленного хеша. Значения — из семейства xxHash: важно только
 * то, что соседние узлы решётки дают некоррелированные числа.
 */
const HASH_X_FACTOR = 374_761_393;
const HASH_Y_FACTOR = 668_265_263;
const HASH_MIX_FACTOR = 1_274_126_177;
const UINT32_RANGE = 4_294_967_296;

/**
 * Разбор глифа под деформацию: от seed он не зависит, поэтому считается один
 * раз на глиф. Ключ — массив команд: источник контуров отдаёт для символа один
 * и тот же массив, а страница на две тысячи глифов перебирает полсотни разных.
 */
type GlyphDeformPlan = {
  /**
   * Контуры глифа в исходном порядке.
   */
  contours: GlyphPathCommand[][];

  /**
   * Габариты чернил тела: по ним и по продвижению находятся места стыков.
   */
  bodyBox: GlyphBounds;

  /**
   * Смещение-якорь по индексу контура: `null` — контур тела, деформируется
   * поточечно; точка — контур знака, едет жёстко за телом в этой точке.
   */
  anchors: (GlyphPoint | null)[];
};

/**
 * Вертикали, на которых буква смыкается с соседями.
 */
type SeamPlanes = {
  /**
   * Левая граница стыка.
   */
  left: number;

  /**
   * Правая граница стыка.
   */
  right: number;
};

/**
 * Знаки глифа, разложенные по стороне тела, к которой они относятся.
 */
type MarkGroups = {
  /**
   * Индексы контуров над телом.
   */
  above: number[];

  /**
   * Индексы контуров под телом.
   */
  below: number[];
};

const planCache = new WeakMap<readonly GlyphPathCommand[], GlyphDeformPlan>();

/**
 * Значение шума в узле решётки: число от нуля до единицы, детерминированное по
 * seed и координатам узла.
 */
const hashNode = (seed: number, nodeX: number, nodeY: number): number => {
  const raw =
    (seed ^ Math.imul(nodeX, HASH_X_FACTOR) ^ Math.imul(nodeY, HASH_Y_FACTOR)) | 0;
  const mixed = Math.imul(raw ^ (raw >>> 13), HASH_MIX_FACTOR);

  return ((mixed ^ (mixed >>> 16)) >>> 0) / UINT32_RANGE;
};

/**
 * Сглаживание перехода: производная на концах отрезка нулевая, поэтому стык
 * ячеек решётки не читается изломом.
 */
const smoothstep = (t: number): number => {
  return t * t * (3 - 2 * t);
};

/**
 * Гладкий шум на решётке: соседние точки контура получают близкие смещения,
 * иначе контур становится зубчатым вместо неровного.
 */
const valueNoise = (seed: number, x: number, y: number, cell: number): number => {
  const gridX = x / cell;
  const gridY = y / cell;
  const nodeX = Math.floor(gridX);
  const nodeY = Math.floor(gridY);
  const weightX = smoothstep(gridX - nodeX);
  const weightY = smoothstep(gridY - nodeY);

  const leftTop = hashNode(seed, nodeX, nodeY);
  const rightTop = hashNode(seed, nodeX + 1, nodeY);
  const leftBottom = hashNode(seed, nodeX, nodeY + 1);
  const rightBottom = hashNode(seed, nodeX + 1, nodeY + 1);

  const top = leftTop + (rightTop - leftTop) * weightX;
  const bottom = leftBottom + (rightBottom - leftBottom) * weightX;

  return top + (bottom - top) * weightY;
};

/**
 * Точки контуров, лежащие на кривой.
 */
const listOnCurveOfContours = (contours: readonly GlyphPathCommand[][]): GlyphPoint[] => {
  return contours.reduce<GlyphPoint[]>((acc, contour) => {
    for (const command of contour) {
      acc.push(...listOnCurvePoints(command));
    }

    return acc;
  }, []);
};

/**
 * Ближайшая к цели точка тела на кривой. За неё цепляется знак: смещение знака
 * обязано совпасть со смещением того куска буквы, к которому он относится, а не
 * просто быть постоянным внутри своего контура.
 */
const findNearestPoint = (
  points: readonly GlyphPoint[],
  target: GlyphPoint
): GlyphPoint => {
  const [first, ...rest] = points;

  if (!first) {
    return target;
  }

  return rest.reduce((best, point) => {
    return Math.hypot(point.x - target.x, point.y - target.y) <
      Math.hypot(best.x - target.x, best.y - target.y)
      ? point
      : best;
  }, first);
};

/**
 * Якоря знаков: все знаки над телом получают один якорь, все знаки под телом —
 * другой. Общий якорь на группу обязателен: две точки `ё`, взятые каждая в
 * своей середине, разъезжаются на величину порядка самой амплитуды.
 */
const buildMarkAnchors = (
  markIndexes: readonly number[],
  bounds: readonly GlyphBounds[],
  bodyBox: GlyphBounds,
  bodyPoints: readonly GlyphPoint[]
): Map<number, GlyphPoint> => {
  const groups = markIndexes.reduce<MarkGroups>(
    (acc, index) => {
      const box = bounds[index];

      if (!box) {
        return acc;
      }

      const middleY = (box.minY + box.maxY) / 2;
      const isAbove =
        Math.abs(bodyBox.maxY - middleY) <= Math.abs(middleY - bodyBox.minY);

      acc[isAbove ? 'above' : 'below'].push(index);

      return acc;
    },
    { above: [], below: [] }
  );

  const anchors = new Map<number, GlyphPoint>();

  for (const [side, indexes] of Object.entries(groups)) {
    if (indexes.length === 0) {
      continue;
    }

    const groupBox = indexes.reduce<GlyphBounds>(
      (acc, index) => {
        const box = bounds[index];

        if (!box) {
          return acc;
        }

        return {
          ...acc,
          minX: Math.min(acc.minX, box.minX),
          maxX: Math.max(acc.maxX, box.maxX),
        };
      },
      { ...bodyBox }
    );

    const target = {
      x: (groupBox.minX + groupBox.maxX) / 2,
      y: side === 'above' ? bodyBox.maxY : bodyBox.minY,
    };
    const anchor = findNearestPoint(bodyPoints, target);

    for (const index of indexes) {
      anchors.set(index, anchor);
    }
  }

  return anchors;
};

/**
 * Готовит разбор глифа: контуры, точки стыка и якоря знаков.
 */
const buildPlan = (commands: readonly GlyphPathCommand[]): GlyphDeformPlan => {
  const contours = splitContours(commands);
  const { bodyIndexes, markIndexes, bounds, bodyBox } = classifyContours(contours);
  const bodyPoints = listOnCurveOfContours(
    bodyIndexes.reduce<GlyphPathCommand[][]>((acc, index) => {
      const contour = contours[index];

      if (contour) {
        acc.push(contour);
      }

      return acc;
    }, [])
  );
  const markAnchors = buildMarkAnchors(markIndexes, bounds, bodyBox, bodyPoints);

  return {
    contours,
    bodyBox,
    anchors: contours.map((_contour, index) => {
      return markAnchors.get(index) || null;
    }),
  };
};

/**
 * Разбор глифа из кэша либо свежий. Кэш держится на массиве команд, поэтому
 * глиф, выданный источником контуров, разбирается один раз на все свои
 * вхождения на странице.
 */
const takePlan = (commands: readonly GlyphPathCommand[]): GlyphDeformPlan => {
  const cached = planCache.get(commands);

  if (cached) {
    return cached;
  }

  const plan = buildPlan(commands);

  planCache.set(commands, plan);

  return plan;
};

/**
 * Вес смещения по горизонтали: ноль на границах стыка и за ними, единица в
 * середине буквы. Чернила, которыми буква смыкается с соседями, обязаны
 * остаться на месте — иначе соединение разрывается.
 *
 * Глиф с нулевым продвижением не деформируется вовсе: собственной ширины у
 * него нет, он целиком лежит на чужих чернилах.
 */
const joinWeight = (x: number, seam: SeamPlanes, ramp: number): number => {
  const fromLeft = Math.min(1, Math.max(0, (x - seam.left) / ramp));
  const fromRight = Math.min(1, Math.max(0, (seam.right - x) / ramp));

  return smoothstep(fromLeft * fromRight);
};

/**
 * Границы стыка: вертикали, на которых буква смыкается с соседями.
 *
 * Слева это край собственных чернил, если он правее нуля, иначе — ноль: всё,
 * что буква выносит левее начала, лежит уже на чернилах предыдущей буквы.
 * Справа — зеркально: край чернил, если он левее продвижения, иначе само
 * продвижение.
 *
 * Ни одной из двух половин правила по отдельности не хватает. Привязка к одной
 * рамке чернил промахивается у букв с выносным элементом: у `Capuletty` «б»
 * росчерк уходит на три четверти em правее места, где буква смыкается со
 * следующей. Привязка к одному продвижению промахивается у букв, чернила
 * которых начинаются заметно правее нуля: у `Lexa` «о» — на тридцать семь
 * тысячных em, и предыдущая буква дотягивается ровно туда.
 */
const findSeamPlanes = (bodyBox: GlyphBounds, advanceWidth: number): SeamPlanes => {
  return {
    left: Math.max(0, bodyBox.minX),
    right: Math.min(advanceWidth, bodyBox.maxX),
  };
};

/**
 * Смещает точки контуров глифа гладким шумом, оставляя окрестности точек стыка
 * на месте. Отдельно стоящие знаки — диакритика, точка `!`, надстрочная черта —
 * переносятся жёстко на смещение той точки тела, к которой относятся:
 * деформировать их своим шумом значит оторвать от буквы.
 *
 * Функция чистая и детерминированная: одинаковые команды и одинаковый seed
 * дают одинаковый результат, исходные команды не меняются. Выключенная
 * вариативность — это не нулевая амплитуда, а отказ от вызова: путь всё равно
 * пересобирается, поэтому исходные контуры дешевле взять у источника.
 *
 * @param commands — команды пути глифа в единицах шрифта
 * @param options — единиц на em, продвижение глифа, seed экземпляра буквы,
 *   амплитуда, размер ячейки шума и ширина рампы у стыка в долях em
 * @returns новые команды пути в том же порядке. Пустой список — на пустом входе
 */
export const deformGlyphPath = (
  commands: readonly GlyphPathCommand[],
  options: DeformGlyphOptions
): GlyphPathCommand[] => {
  const {
    unitsPerEm,
    advanceWidth,
    seed,
    amplitude = DEFAULT_DEFORM_AMPLITUDE,
    cell = DEFAULT_DEFORM_CELL,
    seamRamp = DEFAULT_SEAM_RAMP,
  } = options;

  if (commands.length === 0) {
    return [];
  }

  const { contours, bodyBox, anchors } = takePlan(commands);
  const seam = findSeamPlanes(bodyBox, advanceWidth);
  const amplitudeUnits = amplitude * unitsPerEm;
  const cellUnits = cell * unitsPerEm;
  const rampUnits = Math.max(1, seamRamp * unitsPerEm);

  const displace = (x: number, y: number): GlyphPoint => {
    const scale = 2 * amplitudeUnits * joinWeight(x, seam, rampUnits);

    return {
      x: (valueNoise(seed, x, y, cellUnits) - 0.5) * scale,
      y: (valueNoise(seed ^ VERTICAL_SEED_SALT, x, y, cellUnits) - 0.5) * scale,
    };
  };

  return contours.reduce<GlyphPathCommand[]>((acc, contour, contourIndex) => {
    const anchor = anchors[contourIndex];
    const markShift = anchor ? displace(anchor.x, anchor.y) : null;

    for (const command of contour) {
      acc.push(
        mapCommandPoints(command, (x, y) => {
          const shift = markShift || displace(x, y);

          return { x: x + shift.x, y: y + shift.y };
        })
      );
    }

    return acc;
  }, []);
};
