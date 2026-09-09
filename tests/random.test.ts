import { mulberry32, pickRandomItems, randomInt } from '@shared/lib/random';
import { describe, expect, it } from 'vitest';

describe('mulberry32', () => {
  it('на одном seed даёт одну и ту же последовательность', () => {
    const first = Array.from({ length: 5 }, mulberry32(42));
    const second = Array.from({ length: 5 }, mulberry32(42));

    expect(first).toEqual(second);
  });

  it('на разных seed даёт разные последовательности', () => {
    const first = Array.from({ length: 5 }, mulberry32(1));
    const second = Array.from({ length: 5 }, mulberry32(2));

    expect(first).not.toEqual(second);
  });

  it('держится в диапазоне [0, 1)', () => {
    const random = mulberry32(7);
    const values = Array.from({ length: 100 }, random);

    for (const value of values) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });
});

describe('randomInt', () => {
  it('не выходит за границы диапазона', () => {
    const random = mulberry32(3);
    const values = Array.from({ length: 200 }, () => {
      return randomInt(random, -2, 2);
    });

    expect(Math.min(...values)).toBeGreaterThanOrEqual(-2);
    expect(Math.max(...values)).toBeLessThanOrEqual(2);
  });

  it('на вырожденном диапазоне отдаёт само значение', () => {
    expect(randomInt(mulberry32(1), 4, 4)).toBe(4);
  });
});

describe('pickRandomItems', () => {
  it('отдаёт запрошенное число разных элементов', () => {
    const picked = pickRandomItems(mulberry32(11), [1, 2, 3, 4, 5], 3);

    expect(picked).toHaveLength(3);
    expect(new Set(picked).size).toBe(3);
  });

  it('не выдумывает элементов, которых нет в списке', () => {
    const picked = pickRandomItems(mulberry32(11), [1, 2], 5);

    expect(picked).toHaveLength(2);
    expect([...picked].sort()).toEqual([1, 2]);
  });
});
