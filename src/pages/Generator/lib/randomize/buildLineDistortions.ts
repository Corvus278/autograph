import { mulberry32, randomInt } from '@shared/lib/random';

import type { BuildLineDistortionsOptions, LineDistortion } from './randomize.types';

/**
 * «Съезд линий» — поворот на доли градуса: строка длинная, и даже один градус
 * уводит её конец далеко от линейки фона.
 */
const LINE_ROTATE_RANGE = [-1, 1] as const;
const LINE_SHIFT_RANGE = [0, 5] as const;

/**
 * Собирает искажения строк страницы: по описанию на строку, в том же порядке.
 * При выключенных построчных переключателях описания пустые — нули.
 */
export const buildLineDistortions = (
  lineCount: number,
  options: BuildLineDistortionsOptions
): LineDistortion[] => {
  const { flags, seed } = options;
  const random = mulberry32(seed);

  return Array.from({ length: lineCount }, () => {
    return {
      rotate: flags.isLineRotated ? randomInt(random, ...LINE_ROTATE_RANGE) : 0,
      translateX: flags.isLineShifted ? randomInt(random, ...LINE_SHIFT_RANGE) : 0,
    };
  });
};
