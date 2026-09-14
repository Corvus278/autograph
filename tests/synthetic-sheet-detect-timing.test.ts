import type { SheetImageData } from '@pages/Generator/lib/paper';
import { detectRuling } from '@pages/Generator/lib/paper/detectRuling';
import { describe, expect, it } from 'vitest';

import {
  createSyntheticSheet,
  type SyntheticSheetParams,
} from './helpers/synthetic-sheet';

/**
 * Замер времени `detectRuling` на кадре размером с фотографию телефона. В общем
 * прогоне не участвует: кадр разбирается секундами, а само число зависит от
 * машины и ничего не доказывает. Сравниваются только два замера одной и той же
 * командой на одной машине — до правок детектора и после:
 *
 * `DETECT_RULING_TIMING=1 npx vitest run --project=unit tests/synthetic-sheet-detect-timing.test.ts`
 */
const IS_TIMING_ENABLED = Boolean(process.env.DETECT_RULING_TIMING);

/**
 * Число замеров на лист: итог — медиана, чтобы разовая пауза сборщика мусора
 * не сдвинула сравнение.
 */
const RUN_COUNT = 5;

const TIMING_TIMEOUT_MS = 600_000;

const PHOTO_WIDTH = 3000;

const PHOTO_HEIGHT = 4000;

const TIMING_SHEETS: [string, SyntheticSheetParams][] = [
  [
    'линейка',
    {
      width: PHOTO_WIDTH,
      height: PHOTO_HEIGHT,
      step: 118.5,
      phase: 37,
      angle: 1,
      kind: 'lined',
      margins: { top: 420, right: 0, bottom: 300, left: 0 },
      marginLineX: 480,
      lineWidth: 5,
      noise: 0.06,
      lighting: 0.2,
      seed: 3,
    },
  ],
  [
    'клетка',
    {
      width: PHOTO_WIDTH,
      height: PHOTO_HEIGHT,
      step: 99.5,
      phase: 21,
      angle: -1.2,
      kind: 'grid',
      margins: { top: 180, right: 150, bottom: 180, left: 150 },
      marginLineX: 2560,
      lineWidth: 4,
      lineDarkness: 0.3,
      noise: 0.06,
      lighting: 0.2,
      seed: 5,
    },
  ],
];

/**
 * Медиана времени разбора кадра в миллисекундах. Первый разбор делает сам
 * тест, проверяя, что разлиновка найдена: время ненайденной разлиновки
 * меряло бы ранний выход, а не детектор.
 *
 * @param image — кадр листа
 * @returns медиана `RUN_COUNT` замеров
 */
const measureMedianMs = (image: SheetImageData): number => {
  const durations: number[] = [];

  for (let run = 0; run < RUN_COUNT; run += 1) {
    const start = performance.now();

    detectRuling(image);
    durations.push(performance.now() - start);
  }

  durations.sort((first, second) => {
    return first - second;
  });

  return durations[Math.floor(RUN_COUNT / 2)] || 0;
};

describe.runIf(IS_TIMING_ENABLED)('время detectRuling на кадре 3000×4000', () => {
  it.each(TIMING_SHEETS)(
    '%s',
    (name, params) => {
      const image = createSyntheticSheet(params);

      expect(detectRuling(image).isDetected).toBe(true);

      const medianMs = measureMedianMs(image);

      process.stdout.write(
        `detectRuling ${name}: медиана ${Math.round(medianMs)} мс из ${RUN_COUNT}\n`
      );
    },
    TIMING_TIMEOUT_MS
  );
});
