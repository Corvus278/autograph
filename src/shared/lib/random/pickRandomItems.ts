import type { RandomSource } from './random.types';

/**
 * Выбирает `count` разных элементов списка. Если просят больше, чем есть,
 * отдаёт весь список в случайном порядке.
 *
 * Работает по частичному Фишеру—Йетсу на копии: так один и тот же элемент не
 * попадёт в выборку дважды.
 */
export const pickRandomItems = <T>(
  random: RandomSource,
  items: T[],
  count: number
): T[] => {
  const rest = [...items];
  const picked: T[] = [];
  const total = Math.min(count, rest.length);

  for (let step = 0; step < total; step += 1) {
    const index = Math.floor(random() * rest.length);
    const [item] = rest.splice(index, 1);

    if (item !== undefined) {
      picked.push(item);
    }
  }

  return picked;
};
