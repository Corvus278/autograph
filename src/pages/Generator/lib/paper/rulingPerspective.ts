import type { RulingPerspective, RulingProjection } from './paper.types';

const DEGREES_IN_RADIAN = 180 / Math.PI;

/**
 * Тангенс наклона тем же выражением, что и выборка изгиба: без перспективы
 * координата вдоль линий должна совпадать с её `u` до бита.
 *
 * @param skewAngle — наклон разлиновки в градусах
 * @returns тангенс наклона
 */
const toTangent = (skewAngle: number): number => {
  return Math.tan(skewAngle / DEGREES_IN_RADIAN);
};

/**
 * Координата вдоль линий, отсчитанная от наклонной прямой через начало
 * перспективы: `a = U − y₀ + x₀·tgθ`.
 *
 * @param perspective — перспектива разлиновки
 * @param tangent — тангенс наклона
 * @param u — координата вдоль линий
 * @returns сдвинутая координата
 */
const toOriginOffset = (
  perspective: RulingPerspective,
  tangent: number,
  u: number
): number => {
  return u - perspective.originY + perspective.originX * tangent;
};

/**
 * Координата вдоль линий `U` точки кадра: у всех точек одной линии
 * разлиновки она одна, у линии `k` равна `firstLinePhase + k·step`.
 *
 * Без перспективы — `y − x·tgθ` без единой лишней операции: ровный лист не
 * меняется ни в одном числе. С перспективой шаг в начале перспективы равен
 * `step`, а по кадру меняется дробно-линейно.
 *
 * @param projection — наклон и перспектива разлиновки
 * @param x — отступ точки от левого края кадра, px
 * @param y — отступ точки от верхнего края кадра, px
 * @returns координата вдоль линий, px
 */
export const lineCoordinateAt = (
  { skewAngle, perspective }: RulingProjection,
  x: number,
  y: number
): number => {
  const tangent = toTangent(skewAngle);

  if (!perspective) {
    return y - x * tangent;
  }

  const { originX, originY, convergenceX, convergenceY } = perspective;
  const offsetX = x - originX;
  const weight = 1 + convergenceX * offsetX + convergenceY * (y - originY);

  return originY - originX * tangent + (y - originY - offsetX * tangent) / weight;
};

/**
 * Высота `Y` линии с координатой `U` в столбце `x` — обращение
 * `lineCoordinateAt`: `lineCoordinateAt(x, lineHeightAt(x, U)) = U`.
 *
 * Знаменатель `1 − a·q` вызывающая сторона держит вдали от нуля: это условие
 * надёжности измеренной перспективы.
 *
 * @param projection — наклон и перспектива разлиновки
 * @param x — отступ столбца от левого края кадра, px
 * @param u — координата вдоль линий, px
 * @returns высота линии в столбце, px
 */
export const lineHeightAt = (
  { skewAngle, perspective }: RulingProjection,
  x: number,
  u: number
): number => {
  const tangent = toTangent(skewAngle);

  if (!perspective) {
    return u + x * tangent;
  }

  const { originX, originY, convergenceX, convergenceY } = perspective;
  const offsetX = x - originX;
  const offset = toOriginOffset(perspective, tangent, u);

  return (
    originY +
    (offset * (1 + convergenceX * offsetX) + offsetX * tangent) /
      (1 - offset * convergenceY)
  );
};

/**
 * Наклон линии: `∂Y/∂x` при постоянной `U`. По нему поворачиваются буквы,
 * стоящие на линии. Столбца в аргументах нет: линия с постоянной `U` — прямая,
 * и её наклон по ширине кадра не меняется.
 *
 * @param projection — наклон и перспектива разлиновки
 * @param u — координата линии вдоль линий, px
 * @returns производная высоты линии по `x`
 */
export const lineHeightSlopeAt = (
  { skewAngle, perspective }: RulingProjection,
  u: number
): number => {
  const tangent = toTangent(skewAngle);

  if (!perspective) {
    return tangent;
  }

  const offset = toOriginOffset(perspective, tangent, u);

  return (
    (offset * perspective.convergenceX + tangent) /
    (1 - offset * perspective.convergenceY)
  );
};

/**
 * Местный масштаб шага: `∂Y/∂U` — во сколько раз расстояние между линиями в
 * столбце `x` на высоте линии `U` больше `step`.
 *
 * @param projection — наклон и перспектива разлиновки
 * @param x — отступ столбца от левого края кадра, px
 * @param u — координата вдоль линий, px
 * @returns производная высоты линии по `U`; без перспективы — `1`
 */
export const lineHeightScaleAt = (
  { skewAngle, perspective }: RulingProjection,
  x: number,
  u: number
): number => {
  if (!perspective) {
    return 1;
  }

  const tangent = toTangent(skewAngle);
  const { originX, convergenceX, convergenceY } = perspective;
  const offsetX = x - originX;
  const denominator = 1 - toOriginOffset(perspective, tangent, u) * convergenceY;

  return (
    (1 + convergenceX * offsetX + convergenceY * offsetX * tangent) /
    (denominator * denominator)
  );
};
