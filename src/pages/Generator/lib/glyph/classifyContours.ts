import type {
  ContourClassification,
  GlyphBounds,
  GlyphPathCommand,
  GlyphPoint,
} from './glyph.types';
import { listCommandPoints, listOnCurvePoints } from './glyphCommands';

/**
 * Насколько близко обводки должны подойти друг к другу, чтобы считаться
 * сросшимися, в долях высоты самого крупного контура глифа. Зазор между буквой
 * и её надстрочным знаком в паке — от двадцатой доли em, то есть примерно
 * десятая доля высоты тела: допуск заведомо ниже.
 */
const ATTACH_DISTANCE_RATIO = 0.05;

/**
 * Пустые габариты: границы вывернуты, поэтому первая же точка их сжимает.
 */
const EMPTY_BOUNDS: GlyphBounds = {
  minX: Number.POSITIVE_INFINITY,
  maxX: Number.NEGATIVE_INFINITY,
  minY: Number.POSITIVE_INFINITY,
  maxY: Number.NEGATIVE_INFINITY,
};

/**
 * Площадь габаритов. Нужна только для сравнения контуров между собой, поэтому
 * вывернутые границы пустого контура давать осмысленное число не обязаны.
 */
const boundsArea = (box: GlyphBounds): number => {
  return (box.maxX - box.minX) * (box.maxY - box.minY);
};

/**
 * Объединение габаритов.
 */
const unionBounds = (first: GlyphBounds, second: GlyphBounds): GlyphBounds => {
  return {
    minX: Math.min(first.minX, second.minX),
    maxX: Math.max(first.maxX, second.maxX),
    minY: Math.min(first.minY, second.minY),
    maxY: Math.max(first.maxY, second.maxY),
  };
};

/**
 * Лежит ли точка внутри контура. Обход — по правилу ненулевого числа оборотов,
 * тем же, каким шрифт заливается: точка внутри петли `о` считается внутренней,
 * поэтому петля не отрывается от буквы.
 */
const isPointInside = (point: GlyphPoint, polygon: readonly GlyphPoint[]): boolean => {
  let winding = 0;

  for (const [index, from] of polygon.entries()) {
    const to = polygon[(index + 1) % polygon.length];

    if (!to || from.y === to.y) {
      continue;
    }

    const isCrossing =
      point.y >= Math.min(from.y, to.y) && point.y < Math.max(from.y, to.y);

    if (!isCrossing) {
      continue;
    }

    const crossX = from.x + ((point.y - from.y) / (to.y - from.y)) * (to.x - from.x);

    if (crossX > point.x) {
      winding += to.y > from.y ? 1 : -1;
    }
  }

  return winding !== 0;
};

/**
 * Квадрат расстояния от точки до отрезка.
 */
const squaredDistanceToSegment = (
  point: GlyphPoint,
  from: GlyphPoint,
  to: GlyphPoint
): number => {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const lengthSquared = dx * dx + dy * dy;
  const position =
    lengthSquared > 0
      ? Math.min(
          1,
          Math.max(0, ((point.x - from.x) * dx + (point.y - from.y) * dy) / lengthSquared)
        )
      : 0;
  const nearX = from.x + position * dx;
  const nearY = from.y + position * dy;

  return (point.x - nearX) ** 2 + (point.y - nearY) ** 2;
};

/**
 * Подходит ли обводка ближе указанного расстояния к точкам другой обводки.
 */
const isOutlineNear = (
  points: readonly GlyphPoint[],
  outline: readonly GlyphPoint[],
  distance: number
): boolean => {
  const limit = distance ** 2;

  return points.some((point) => {
    return outline.some((from, index) => {
      const to = outline[(index + 1) % outline.length] || from;

      return squaredDistanceToSegment(point, from, to) <= limit;
    });
  });
};

/**
 * Считаются ли чернила двух контуров сросшимися: либо один лежит внутри
 * другого — так устроены петли `о` и `а`, — либо обводки подходят друг к другу
 * ближе допуска.
 *
 * Проверять пересечение обводок точно смысла нет: приросший хвост `ц` и палочки
 * `х` перекрываются, но их точки на кривой могут отстоять далеко, а надстрочный
 * знак отделён от буквы зазором в добрую двадцатую долю em — на порядок больше
 * допуска.
 */
const isInkTouching = (
  first: readonly GlyphPoint[],
  second: readonly GlyphPoint[],
  distance: number
): boolean => {
  const isNested =
    first.some((point) => {
      return isPointInside(point, second);
    }) ||
    second.some((point) => {
      return isPointInside(point, first);
    });

  return (
    isNested ||
    isOutlineNear(first, second, distance) ||
    isOutlineNear(second, first, distance)
  );
};

/**
 * Разбивает плоский список команд на контуры: каждый контур начинается с `M`.
 * Порядок команд внутри контура и порядок контуров сохраняются, поэтому склейка
 * результата обратно даёт исходный список.
 */
export const splitContours = (
  commands: readonly GlyphPathCommand[]
): GlyphPathCommand[][] => {
  return commands.reduce<GlyphPathCommand[][]>((acc, command) => {
    const last = acc[acc.length - 1];

    if (command.type === 'M' || !last) {
      acc.push([command]);

      return acc;
    }

    last.push(command);

    return acc;
  }, []);
};

/**
 * Габариты контура по всем его точкам, включая контрольные точки кривых.
 */
export const contourBounds = (contour: readonly GlyphPathCommand[]): GlyphBounds => {
  const box = { ...EMPTY_BOUNDS };

  for (const command of contour) {
    for (const point of listCommandPoints(command)) {
      box.minX = Math.min(box.minX, point.x);
      box.maxX = Math.max(box.maxX, point.x);
      box.minY = Math.min(box.minY, point.y);
      box.maxY = Math.max(box.maxY, point.y);
    }
  }

  return box;
};

/**
 * Делит контуры глифа на тело и отдельно стоящие знаки. Тело — самый крупный
 * контур и всё, что делит с ним заметную часть своей высоты, хотя бы
 * транзитивно: так внутренние петли остаются частью буквы. Знак — контур,
 * который лежит выше или ниже основной массы и задевает её в лучшем случае
 * краем.
 *
 * Наблюдаемое поведение шире задуманного случая `й` и `ё`. Знаком признаётся
 * любой оторванный по вертикали контур: надстрочная черта `т` и `ш`,
 * подстрочная черта, точка `!`, вторая точка `:` и `;`, вторая черта `=`. Для
 * этих глифов «тело» — просто самая крупная часть, а остальные едут за ней
 * жёстко. Это уместно: оторванный элемент обязан сохранять форму и положение
 * относительно того, к чему относится, а какая из двух точек `:` названа телом
 * — не важно, обе смещаются на один вектор.
 *
 * Композитных глифов пак не содержит: `й` и `ё` — простые глифы с диакритикой
 * отдельным контуром.
 *
 * @param contours — контуры глифа в единицах шрифта
 * @returns индексы контуров тела и знаков, габариты каждого контура и габариты
 *   чернил тела
 */
export const classifyContours = (
  contours: readonly GlyphPathCommand[][]
): ContourClassification => {
  const bounds = contours.map((contour) => {
    return contourBounds(contour);
  });
  const [firstBox, ...restBoxes] = bounds;

  if (!firstBox) {
    return { bodyIndexes: [], markIndexes: [], bounds, bodyBox: { ...EMPTY_BOUNDS } };
  }

  /**
   * Затравка тела — контур с самой большой рамкой: знак мельче той части, к
   * которой относится.
   */
  const seedContour = restBoxes.reduce(
    (best, box, index) => {
      return boundsArea(box) > boundsArea(best.box) ? { index: index + 1, box } : best;
    },
    { index: 0, box: firstBox }
  );

  const outlines = contours.map((contour) => {
    return contour.reduce<GlyphPoint[]>((acc, command) => {
      acc.push(...listOnCurvePoints(command));

      return acc;
    }, []);
  });

  const attachDistance =
    ATTACH_DISTANCE_RATIO * (seedContour.box.maxY - seedContour.box.minY);
  const bodyIndexes = new Set([seedContour.index]);
  let bodyBox = seedContour.box;
  let isGrown = true;

  while (isGrown) {
    isGrown = false;

    for (const [index, box] of bounds.entries()) {
      if (bodyIndexes.has(index)) {
        continue;
      }

      const outline = outlines[index] || [];
      const isBodyPart = [...bodyIndexes].some((bodyIndex) => {
        return isInkTouching(outline, outlines[bodyIndex] || [], attachDistance);
      });

      if (isBodyPart) {
        bodyIndexes.add(index);
        bodyBox = unionBounds(bodyBox, box);
        isGrown = true;
      }
    }
  }

  const markIndexes = bounds.reduce<number[]>((acc, _box, index) => {
    if (!bodyIndexes.has(index)) {
      acc.push(index);
    }

    return acc;
  }, []);

  return { bodyIndexes: [...bodyIndexes], markIndexes, bounds, bodyBox };
};
