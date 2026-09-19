import { DEFAULT_REALISM_LEVEL_ID, REALISM_LEVELS } from '@pages/Generator/config';
import { describe, expect, it } from 'vitest';

/**
 * Сколько искажений включено на ступени: по нему видно, что ступени идут от
 * ровной к небрежной.
 *
 * @param flags — флаги искажений ступени
 * @returns число включённых искажений
 */
const countEnabled = (flags: Record<string, boolean>): number => {
  return Object.values(flags).filter(Boolean).length;
};

describe('ступени реализма', () => {
  it('идут по порядку от «Ровно» до «Небрежно»', () => {
    expect(
      REALISM_LEVELS.map(({ label }) => {
        return label;
      })
    ).toEqual(['Ровно', 'Аккуратно', 'Обычно', 'Небрежно']);
  });

  it('с каждой ступенью включают не меньше искажений', () => {
    const counts = REALISM_LEVELS.map(({ flags }) => {
      return countEnabled(flags);
    });

    counts.slice(1).forEach((count, index) => {
      expect(count).toBeGreaterThanOrEqual(counts[index] || 0);
    });
    expect(counts[0]).toBe(0);
  });

  it('по умолчанию берут ступень «Обычно» с включёнными искажениями', () => {
    const level = REALISM_LEVELS.find(({ id }) => {
      return id === DEFAULT_REALISM_LEVEL_ID;
    });

    expect(level?.label).toBe('Обычно');
    expect(countEnabled(level?.flags || {})).toBeGreaterThan(0);
  });
});
