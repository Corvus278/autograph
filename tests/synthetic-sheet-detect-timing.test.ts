import {
  extractLighting,
  extractTexture,
  measureSheetPhoto,
} from '@pages/Generator/lib/paper';
import { detectRuling } from '@pages/Generator/lib/paper/detectRuling';
import { describe, expect, it } from 'vitest';

import {
  createSyntheticSheet,
  type SyntheticSheetParams,
} from './helpers/synthetic-sheet';

/**
 * Замер времени `detectRuling` и `measureSheetPhoto` на кадре размером с
 * фотографию телефона. В общем
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
 * @param parse — разбор кадра
 * @returns медиана `RUN_COUNT` замеров
 */
const measureMedianMs = (parse: () => void): number => {
  const durations: number[] = [];

  for (let run = 0; run < RUN_COUNT; run += 1) {
    const start = performance.now();

    parse();
    durations.push(performance.now() - start);
  }

  durations.sort((first, second) => {
    return first - second;
  });

  return durations[Math.floor(RUN_COUNT / 2)] || 0;
};

/**
 * Изменение шага по высоте кадра, при котором шаг у нижнего края кадра на
 * четыре процента больше, чем у верхнего: местный шаг меняется как
 * `1/(1 − a·q)²`.
 */
const DRIFT_4_CONVERGENCE_Y =
  (2 * (Math.sqrt(1.04) - 1)) / (PHOTO_HEIGHT * (Math.sqrt(1.04) + 1));

const [LINED_SHEET, GRID_SHEET] = TIMING_SHEETS.map(([, params]) => {
  return params;
});

/**
 * Листы замера `measureSheetPhoto`: без поверхности и перспективы — те же, что
 * у базы `detectRuling`, и сверх них лист на столе и лист с перспективой, у
 * которого проходов больше всего.
 */
const PHOTO_SHEETS: [string, SyntheticSheetParams, boolean][] = [
  ...TIMING_SHEETS.map(([name, params]): [string, SyntheticSheetParams, boolean] => {
    return [name, params, false];
  }),
  [
    'клетка на столе',
    {
      ...GRID_SHEET,
      margins: { top: 560, right: 460, bottom: 560, left: 560 },
      marginLineX: null,
      surface: {
        outline: {
          topLeft: { x: 380, y: 300 },
          topRight: { x: 2680, y: 240 },
          bottomRight: { x: 2720, y: 3720 },
          bottomLeft: { x: 420, y: 3780 },
        },
        cornerRadius: 70,
        brightness: 0.3,
        grain: 0.2,
      },
    },
    false,
  ],
  [
    'линейка с перспективой',
    {
      ...LINED_SHEET,
      rulingPerspective: { convergenceX: 0, convergenceY: DRIFT_4_CONVERGENCE_Y },
    },
    true,
  ],
];

describe.runIf(IS_TIMING_ENABLED)('время detectRuling на кадре 3000×4000', () => {
  it.each(TIMING_SHEETS)(
    '%s',
    (name, params) => {
      const image = createSyntheticSheet(params);

      expect(detectRuling(image).isDetected).toBe(true);

      const medianMs = measureMedianMs(() => {
        detectRuling(image);
      });

      process.stdout.write(
        `detectRuling ${name}: медиана ${Math.round(medianMs)} мс из ${RUN_COUNT}\n`
      );

      /**
       * Прежний путь импорта целиком: детектор, свет и текстура по кадру. Свет
       * и текстура теперь внутри `measureSheetPhoto`, и сравнивать её время
       * честно с этой суммой, а не с одним детектором.
       */
      const importMs = measureMedianMs(() => {
        detectRuling(image);
        extractTexture(image, extractLighting(image));
      });

      process.stdout.write(
        `detectRuling + свет + текстура ${name}: медиана ${Math.round(importMs)} мс из ${RUN_COUNT}\n`
      );
    },
    TIMING_TIMEOUT_MS
  );
});

describe.runIf(IS_TIMING_ENABLED)('время measureSheetPhoto на кадре 3000×4000', () => {
  it.each(PHOTO_SHEETS)(
    '%s',
    (name, params, hasPerspective) => {
      const image = createSyntheticSheet(params);
      const { source, diagnostics } = measureSheetPhoto(image, { kind: 'lined' });

      /**
       * Лист с перспективой обязан дойти до второго прохода: иначе замер
       * показал бы время ровного листа.
       */
      expect(diagnostics.isRulingDetected).toBe(true);
      expect(source.perspective !== null).toBe(hasPerspective);

      const medianMs = measureMedianMs(() => {
        measureSheetPhoto(image, { kind: 'lined' });
      });

      process.stdout.write(
        `measureSheetPhoto ${name}: медиана ${Math.round(medianMs)} мс из ${RUN_COUNT}\n`
      );
    },
    TIMING_TIMEOUT_MS
  );
});
