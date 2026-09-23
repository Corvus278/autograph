/**
 * Квантиль ряда: значение, ниже которого лежит доля `quantile` ряда. Ряд
 * сортируется копией — порядок значений важен вызывающей стороне.
 *
 * Квантиль — член самого ряда, а не интерполяция между соседями: все
 * потребители сегмента берут им устойчивую оценку по выборке измерений
 * (глубины линий, шаги полос, контрасты), и число, которого в выборке нет,
 * такой оценке ничего не добавляет. На чётной длине отсюда выходит верхнее из
 * двух средних — не среднее между ними.
 *
 * @param values — ряд чисел
 * @param quantile — доля от нуля до единицы
 * @returns квантиль; ноль на пустом ряду
 */
export const computeQuantile = (values: number[], quantile: number): number => {
  if (values.length === 0) {
    return 0;
  }

  const sorted = [...values].sort((first, second) => {
    return first - second;
  });

  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * quantile))] || 0;
};

/**
 * Медиана ряда.
 *
 * @param values — ряд чисел
 * @returns медиана; ноль на пустом ряду
 */
export const computeMedian = (values: number[]): number => {
  return computeQuantile(values, 0.5);
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
