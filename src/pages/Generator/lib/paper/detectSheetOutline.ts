import { ANALYSIS_IMAGE_SIZE, downsampleSheetImage } from './downsampleSheetImage';
import { percentileOf } from './extractLighting';
import type { SheetImageData, SheetOutline, SheetPoint } from './paper.types';

/**
 * Сторона кадра, вдоль которой ищется край листа.
 */
type SheetSide = 'top' | 'right' | 'bottom' | 'left';

/**
 * Прямая в координатах стороны: `along` идёт вдоль стороны, `depth` — вглубь
 * кадра от неё. В координатах кадра та же запись означает строку у верхней и
 * нижней стороны и столбец у боковых.
 */
type SheetLine = {
  /**
   * Наклон прямой: насколько глубина растёт на единицу длины вдоль стороны.
   */
  slope: number;

  /**
   * Глубина прямой в начале стороны.
   */
  intercept: number;
};

/**
 * Голос полосы: глубина края листа, найденная в ней.
 */
type SheetSideVote = {
  /**
   * Середина полосы вдоль стороны.
   */
  along: number;

  /**
   * Глубина края от стороны кадра.
   */
  depth: number;
};

/**
 * Число полос, на которые режется сторона. Тридцать две — компромисс: полоса
 * шириной в тридцатую часть стороны шире и линии разлиновки, и пятна спирали,
 * поэтому они усредняются, а скруглённый угол и наклон стороны внутри полосы
 * размывают край меньше чем на пиксель уменьшенной копии.
 */
const STRIP_COUNT = 32;

/**
 * Доля длины стороны с каждого конца, которая не голосует: там скруглённые
 * углы листа и уголок обложки, и край в этих полосах лежит внутри листа.
 */
const SILENT_END_SHARE = 0.08;

/**
 * Участок профиля, по которому берётся уровень бумаги, — от пятой до половины
 * стороны кадра внутрь. Ближе к краю в него попал бы сам стол, дальше —
 * середина листа, а уровень нужен местный: свет садится от края к краю, и один
 * общий уровень на весь кадр увёл бы порог у тёмной стороны.
 */
const PAPER_LEVEL_FROM_SHARE = 0.2;

const PAPER_LEVEL_TO_SHARE = 0.5;

/**
 * Перцентиль уровня бумаги. Не максимум: блик на пару точек профиля поднял бы
 * уровень, и порог перестал бы отличать стол от бумаги.
 */
const PAPER_LEVEL_PERCENTILE = 0.9;

/**
 * Доля уровня бумаги, ниже которой яркость считается поверхностью. Порог и
 * гарантия «поверхность не светлее шести десятых яркости бумаги» разнесены с
 * запасом: на фотографиях отношение за краем листа выходит 0,39–0,58.
 */
const EDGE_LEVEL_SHARE = 0.7;

/**
 * Какую долю стороны кадра яркость обязана держаться ниже порога, чтобы
 * провал считался краем листа. Линия разлиновки и пятно спирали уже одного
 * процента, поэтому за край не проходят.
 */
const MIN_DARK_RUN_SHARE = 0.01;

/**
 * Допуск подгонки прямой: доля стороны кадра и не меньше двух точек
 * уменьшенной копии — ниже этого лежит сама дискретность профиля.
 */
const FIT_TOLERANCE_SHARE = 0.006;

const MIN_FIT_TOLERANCE = 2;

/**
 * Какая доля всех полос стороны обязана лечь на прямую. Считается от всех, а
 * не от голосовавших: сторона, где край нашёлся в трёх полосах из тридцати
 * двух, — это не сторона, а тень или пятно.
 */
const MIN_INLIER_SHARE = 0.5;

/**
 * Наибольший наклон стороны листа к краю кадра.
 */
const MAX_SIDE_ANGLE = 5;

const MAX_SIDE_SLOPE = Math.tan((MAX_SIDE_ANGLE * Math.PI) / 180);

/**
 * Насколько хотя бы один конец стороны обязан отстоять от края кадра. Прямая,
 * прижатая к краю обоими концами, — это и есть край кадра, и хранить её как
 * найденную сторону незачем.
 */
const MIN_EDGE_DEPTH_SHARE = 0.005;

/**
 * Наименьшее число точек профиля, на котором поиск края имеет смысл.
 */
const MIN_DEPTH_COUNT = 8;

/**
 * Сторона идёт вдоль ширины кадра.
 *
 * @param side — сторона кадра
 * @returns `true` у верхней и нижней стороны
 */
const isHorizontalSide = (side: SheetSide): boolean => {
  return side === 'top' || side === 'bottom';
};

/**
 * Яркость точки в координатах стороны: `along` вдоль стороны, `depth` вглубь
 * кадра от неё.
 *
 * @param image — изображение
 * @param side — сторона кадра
 * @param along — координата вдоль стороны
 * @param depth — глубина от стороны
 * @returns яркость от 0 до 1
 */
const readSideLuminance = (
  image: SheetImageData,
  side: SheetSide,
  along: number,
  depth: number
): number => {
  const { width, height, luminance } = image;

  switch (side) {
    case 'top': {
      return luminance[depth * width + along] || 0;
    }

    case 'bottom': {
      return luminance[(height - 1 - depth) * width + along] || 0;
    }

    case 'left': {
      return luminance[along * width + depth] || 0;
    }

    case 'right': {
      return luminance[along * width + (width - 1 - depth)] || 0;
    }

    default: {
      throw new Error(`Unknown side: ${side}`);
    }
  }
};

/**
 * Профиль полосы: средняя яркость поперёк её толщины по оси от середины кадра
 * к стороне. Усреднение поперёк и делает профиль слепым к разлиновке: линия
 * идёт вдоль стороны лишь у двух сторон из четырёх, а у остальных размазывается
 * по толщине полосы.
 *
 * @param image — изображение
 * @param side — сторона кадра
 * @param from — начало полосы вдоль стороны
 * @param to — конец полосы вдоль стороны, не включая
 * @param depthCount — число точек профиля вглубь кадра
 * @returns профиль от стороны внутрь
 */
const measureStripProfile = (
  image: SheetImageData,
  side: SheetSide,
  from: number,
  to: number,
  depthCount: number
): Float32Array => {
  const profile = new Float32Array(depthCount);
  const count = to - from;

  for (let depth = 0; depth < depthCount; depth += 1) {
    let sum = 0;

    for (let along = from; along < to; along += 1) {
      sum += readSideLuminance(image, side, along, depth);
    }

    profile[depth] = sum / count;
  }

  return profile;
};

/**
 * Уровень бумаги в полосе — перцентиль профиля на участке вдали и от края
 * кадра, и от середины листа.
 *
 * @param profile — профиль полосы
 * @param depthSpan — сторона кадра поперёк стороны листа
 * @returns яркость бумаги; ноль, если участок пуст
 */
const measurePaperLevel = (profile: Float32Array, depthSpan: number): number => {
  const from = Math.floor(depthSpan * PAPER_LEVEL_FROM_SHARE);
  const to = Math.min(profile.length, Math.floor(depthSpan * PAPER_LEVEL_TO_SHARE));

  if (to <= from) {
    return 0;
  }

  return percentileOf(profile.slice(from, to).sort(), PAPER_LEVEL_PERCENTILE);
};

/**
 * Глубина края листа в полосе: первая точка от середины кадра наружу, где
 * яркость ушла ниже порога и держится ниже до конца участка или до края кадра.
 * Возвращается внутренняя граница такого участка — сам край листа.
 *
 * @param profile — профиль полосы
 * @param threshold — порог яркости поверхности
 * @param runLength — сколько точек яркость обязана держаться ниже порога
 * @returns глубина края; `-1`, если края в полосе нет
 */
const findEdgeDepth = (
  profile: Float32Array,
  threshold: number,
  runLength: number
): number => {
  for (let depth = profile.length - 1; depth >= 0; depth -= 1) {
    if ((profile[depth] || 0) < threshold) {
      const last = Math.max(0, depth - runLength + 1);
      let isRunDark = true;

      for (let inner = depth - 1; inner >= last; inner -= 1) {
        isRunDark = isRunDark && (profile[inner] || 0) < threshold;
      }

      if (isRunDark) {
        return depth;
      }
    }
  }

  return -1;
};

/**
 * Медиана ряда. Ряд сортируется копией: порядок голосов важен вызывающей
 * стороне.
 *
 * @param values — ряд чисел
 * @returns медиана; ноль на пустом ряду
 */
const medianOf = (values: number[]): number => {
  if (values.length === 0) {
    return 0;
  }

  const sorted = [...values].sort((first, second) => {
    return first - second;
  });
  const middle = sorted.length >> 1;
  const upper = sorted[middle] || 0;

  if (sorted.length % 2 === 1) {
    return upper;
  }

  return (upper + (sorted[middle - 1] || 0)) / 2;
};

/**
 * Прямая по голосам методом Тейла — Сена: медиана наклонов по парам и медиана
 * сдвигов. Метод устойчив к выбросам — полоса, где край нашёлся на тени или на
 * пятне, не тянет прямую за собой, как тянула бы у наименьших квадратов.
 *
 * @param votes — голоса полос
 * @returns прямая; `null`, если голосов меньше двух
 */
const fitSideLine = (votes: SheetSideVote[]): SheetLine | null => {
  if (votes.length < 2) {
    return null;
  }

  const slopes: number[] = [];

  votes.forEach((vote, index) => {
    votes.slice(index + 1).forEach((other) => {
      if (other.along !== vote.along) {
        slopes.push((other.depth - vote.depth) / (other.along - vote.along));
      }
    });
  });

  const slope = medianOf(slopes);

  return {
    slope,
    intercept: medianOf(
      votes.map((vote) => {
        return vote.depth - slope * vote.along;
      })
    ),
  };
};

/**
 * Прямая стороны листа в координатах полос или `null`, если стороны на
 * фотографии нет и лист уходит за край кадра.
 *
 * @param image — уменьшенная копия фотографии
 * @param side — сторона кадра
 * @returns прямая стороны в координатах полос
 */
const detectSide = (image: SheetImageData, side: SheetSide): SheetLine | null => {
  const alongSpan = isHorizontalSide(side) ? image.width : image.height;
  const depthSpan = isHorizontalSide(side) ? image.height : image.width;
  const depthCount = Math.floor(depthSpan / 2);

  if (depthCount < MIN_DEPTH_COUNT || alongSpan < STRIP_COUNT) {
    return null;
  }

  const runLength = Math.max(1, Math.round(depthSpan * MIN_DARK_RUN_SHARE));
  const silentEnd = alongSpan * SILENT_END_SHARE;
  const votes: SheetSideVote[] = [];

  for (let strip = 0; strip < STRIP_COUNT; strip += 1) {
    const from = Math.floor((strip * alongSpan) / STRIP_COUNT);
    const to = Math.floor(((strip + 1) * alongSpan) / STRIP_COUNT);
    const along = (from + to) / 2;

    if (along >= silentEnd && along <= alongSpan - silentEnd) {
      const profile = measureStripProfile(image, side, from, to, depthCount);
      const threshold = measurePaperLevel(profile, depthSpan) * EDGE_LEVEL_SHARE;
      const depth = findEdgeDepth(profile, threshold, runLength);

      if (depth >= 0) {
        votes.push({ along, depth });
      }
    }
  }

  const line = fitSideLine(votes);

  if (line === null || Math.abs(line.slope) > MAX_SIDE_SLOPE) {
    return null;
  }

  const tolerance = Math.max(MIN_FIT_TOLERANCE, depthSpan * FIT_TOLERANCE_SHARE);
  const inliers = votes.filter((vote) => {
    return Math.abs(vote.depth - (line.slope * vote.along + line.intercept)) <= tolerance;
  });
  const farthestEnd = Math.max(line.intercept, line.intercept + line.slope * alongSpan);

  if (
    inliers.length < STRIP_COUNT * MIN_INLIER_SHARE ||
    farthestEnd <= depthSpan * MIN_EDGE_DEPTH_SHARE
  ) {
    return null;
  }

  return line;
};

/**
 * Переводит прямую стороны из координат полос уменьшенной копии в координаты
 * кадра. Ненайденная сторона становится прямой края кадра.
 *
 * @param line — прямая в координатах полос; `null` — сторона не найдена
 * @param side — сторона кадра
 * @param scaleAlong — множитель длины вдоль стороны
 * @param scaleDepth — множитель длины вглубь кадра
 * @param depthSpan — сторона кадра поперёк стороны листа, px кадра
 * @returns прямая в координатах кадра
 */
const toFrameLine = (
  line: SheetLine | null,
  side: SheetSide,
  scaleAlong: number,
  scaleDepth: number,
  depthSpan: number
): SheetLine => {
  const isOutward = side === 'bottom' || side === 'right';

  if (line === null) {
    return { slope: 0, intercept: isOutward ? depthSpan : 0 };
  }

  const slope = (line.slope * scaleDepth) / scaleAlong;
  const intercept = line.intercept * scaleDepth;

  if (isOutward) {
    return { slope: -slope, intercept: depthSpan - intercept };
  }

  return { slope, intercept };
};

/**
 * Пересечение прямой верхней или нижней стороны (`y = a·x + b`) с прямой
 * боковой (`x = c·y + d`). Знаменатель к нулю не подходит: наклон сторон
 * ограничен пятью градусами, поэтому `c·a` не больше сотой.
 *
 * @param horizontal — прямая верхней или нижней стороны
 * @param vertical — прямая боковой стороны
 * @returns угол листа в пикселях кадра
 */
const intersectSides = (horizontal: SheetLine, vertical: SheetLine): SheetPoint => {
  const x =
    (vertical.slope * horizontal.intercept + vertical.intercept) /
    (1 - vertical.slope * horizontal.slope);

  return { x, y: horizontal.slope * x + horizontal.intercept };
};

/**
 * Ищет на фотографии контур листа: четыре стороны по полосам кадра.
 *
 * Сторона, у которой лист уходит за край кадра или бумага не отличается по
 * яркости от того, что лежит за ней, совпадает с краем кадра. Ни одной
 * найденной стороны — `null`: лист занимает весь кадр, и мерить его нужно так
 * же, как обрезанную по краям фотографию.
 *
 * Работа идёт по уменьшенной копии: край листа — ступень в десятки пикселей, и
 * масштаб на неё не влияет, зато полный кадр телефона стоил бы секунд.
 *
 * @param image — полутоновая выжимка фотографии
 * @returns контур листа; `null` — лист во весь кадр
 */
export const detectSheetOutline = (image: SheetImageData): SheetOutline | null => {
  const analysis = downsampleSheetImage(image, ANALYSIS_IMAGE_SIZE);

  if (analysis.width < 2 || analysis.height < 2) {
    return null;
  }

  const scaleX = image.width / analysis.width;
  const scaleY = image.height / analysis.height;
  const sides = {
    top: detectSide(analysis, 'top'),
    right: detectSide(analysis, 'right'),
    bottom: detectSide(analysis, 'bottom'),
    left: detectSide(analysis, 'left'),
  };

  if (
    Object.values(sides).every((side) => {
      return side === null;
    })
  ) {
    return null;
  }

  const top = toFrameLine(sides.top, 'top', scaleX, scaleY, image.height);
  const bottom = toFrameLine(sides.bottom, 'bottom', scaleX, scaleY, image.height);
  const left = toFrameLine(sides.left, 'left', scaleY, scaleX, image.width);
  const right = toFrameLine(sides.right, 'right', scaleY, scaleX, image.width);

  return {
    topLeft: intersectSides(top, left),
    topRight: intersectSides(top, right),
    bottomRight: intersectSides(bottom, right),
    bottomLeft: intersectSides(bottom, left),
  };
};
