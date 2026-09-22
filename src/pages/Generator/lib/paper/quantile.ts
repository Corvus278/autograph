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
