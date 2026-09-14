import type { SheetImageData } from '@pages/Generator/lib/paper';
import {
  detectRulingBend,
  type RulingBendDetection,
  type RulingBendRegion,
} from '@pages/Generator/lib/paper/detectRulingBend';
import { describe, expect, it } from 'vitest';

import {
  createSyntheticSheet,
  type SyntheticField,
  type SyntheticSheetParams,
} from './helpers/synthetic-sheet';

const STEP = 24;

const WIDTH = 720;

const HEIGHT = 960;

const PHASE = 10;

const MARGINS = { top: 72, right: 0, bottom: 72, left: 0 };

/**
 * Лист в линейку во весь кадр по ширине, сверху и снизу — поле в три шага.
 */
const BASE_SHEET = {
  width: WIDTH,
  height: HEIGHT,
  step: STEP,
  phase: PHASE,
  margins: MARGINS,
  noise: 0.04,
  seed: 11,
} satisfies SyntheticSheetParams;

const FULL_REGION: RulingBendRegion = { left: 0, right: WIDTH };

/**
 * Область наклонного листа: на ней линии нарисованы на всех строках, у края
 * кадра их концы уходят наклоном.
 */
const TILT_REGION: RulingBendRegion = { left: 24, right: WIDTH - 24 };

/**
 * Прогиб по ширине с серединой ниже концов на `share` шага.
 */
const createSag = (share: number): SyntheticField => {
  return (x) => {
    return share * STEP * (1 - ((2 * x) / WIDTH - 1) ** 2);
  };
};

const detect = (
  params: SyntheticSheetParams,
  region: RulingBendRegion,
  image: SheetImageData = createSyntheticSheet(params)
): RulingBendDetection => {
  const { angle = 0 } = params;

  return detectRulingBend(
    image,
    { step: STEP, firstLinePhase: PHASE, skewAngle: angle, margins: MARGINS },
    region
  );
};

/**
 * Номер линии гребёнки, мимо которой проходит строка кадра на ровном листе.
 */
const toLineIndex = (y: number): number => {
  return Math.round((y - PHASE) / STEP);
};

/**
 * Закрашивает вертикальные полосы кадра ровным тёмным тоном: линии под ними не
 * видны.
 */
const paintDarkBands = (
  image: SheetImageData,
  bands: RulingBendRegion[]
): SheetImageData => {
  const { width, height } = image;
  const luminance = Float32Array.from(image.luminance);

  for (let y = 0; y < height; y += 1) {
    bands.forEach(({ left, right }) => {
      luminance.fill(0.1, y * width + left, y * width + right);
    });
  }

  return { width, height, luminance };
};

describe('detectRulingBend: проверка надёжности', () => {
  it('ровный лист остаётся без изгиба', () => {
    expect(detect(BASE_SHEET, FULL_REGION).bend).toBeNull();
  });

  it('ровный наклонный лист остаётся без изгиба', () => {
    expect(detect({ ...BASE_SHEET, angle: 1.5 }, TILT_REGION).bend).toBeNull();
  });

  it('изгиб ниже двадцатой шага не сохраняется', () => {
    expect(detect({ ...BASE_SHEET, bend: createSag(0.04) }, FULL_REGION).bend).toBeNull();
  });

  it('изгиб выше двадцатой шага сохраняется', () => {
    expect(
      detect({ ...BASE_SHEET, bend: createSag(0.065) }, FULL_REGION).bend
    ).not.toBeNull();
  });

  it('лист с линиями, видимыми на трети площади, остаётся без изгиба', () => {
    const { bend, foundNodeShare } = detect(
      {
        ...BASE_SHEET,
        bend: createSag(0.3),
        lowContrastArea: { left: 0, top: 0, right: 479, bottom: HEIGHT, contrast: 0 },
      },
      FULL_REGION
    );

    expect(foundNodeShare).toBeLessThan(0.6);
    expect(bend).toBeNull();
  });

  it('лист с тёмными посторонними полосами поперёк линий остаётся без изгиба', () => {
    const params = { ...BASE_SHEET, bend: createSag(0.3) };
    const image = paintDarkBands(createSyntheticSheet(params), [
      { left: 36, right: 192 },
      { left: 276, right: 432 },
      { left: 516, right: 672 },
    ]);

    expect(detect(params, FULL_REGION, image).bend).toBeNull();
  });

  it('скачок больше четверти шага между соседними линиями отбрасывает изгиб', () => {
    const { bend, foundNodeShare } = detect(
      {
        ...BASE_SHEET,
        bend: (_x, y) => {
          return y >= HEIGHT / 2 ? 0.3 * STEP : 0;
        },
      },
      FULL_REGION
    );

    expect(foundNodeShare).toBeGreaterThan(0.95);
    expect(bend).toBeNull();
  });

  it('линии, гуляющие через одну, отбрасывают изгиб: фильтр заменил бы большинство узлов', () => {
    const { bend, foundNodeShare } = detect(
      {
        ...BASE_SHEET,
        bend: (_x, y) => {
          return toLineIndex(y) % 2 === 0 ? 0.15 * STEP : 0;
        },
      },
      FULL_REGION
    );

    expect(foundNodeShare).toBeGreaterThan(0.95);
    expect(bend).toBeNull();
  });

  it('смещение от половины шага отбрасывает изгиб: трасса ушла на соседнюю линию', () => {
    const { bend, foundNodeShare } = detect(
      { ...BASE_SHEET, bend: createSag(0.6) },
      FULL_REGION
    );

    expect(foundNodeShare).toBeGreaterThan(0.95);
    expect(bend).toBeNull();
  });

  it('область уже восьми пикселей не даёт сетки с нулевым расстоянием между узлами', () => {
    expect(
      detect({ ...BASE_SHEET, bend: createSag(0.3) }, { left: 100, right: 107 })
    ).toEqual({ bend: null, foundNodeShare: 0 });
  });
});
