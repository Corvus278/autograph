import type { RandomSource } from './random.types';

/**
 * Генератор псевдослучайных чисел mulberry32: один 32-битный seed, короткое
 * состояние, равномерное распределение. Нужен ровно затем, чтобы
 * последовательность воспроизводилась по seed из стора.
 */
export const mulberry32 = (seed: number): RandomSource => {
  let state = seed >>> 0;

  return () => {
    state = (state + 0x6d_2b_79_f5) >>> 0;

    let value = Math.imul(state ^ (state >>> 15), 1 | state);

    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;

    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
};
