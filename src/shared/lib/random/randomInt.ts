import type { RandomSource } from './random.types';

/**
 * Целое число из диапазона `[min, max]` включительно.
 */
export const randomInt = (random: RandomSource, min: number, max: number): number => {
  return Math.floor(min + random() * (max - min + 1));
};
