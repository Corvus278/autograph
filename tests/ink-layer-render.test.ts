/**
 * @vitest-environment jsdom
 */
import type { InkLayerParams } from '@pages/Generator/lib/ink';
import type { LightingField } from '@pages/Generator/lib/paper';
import type {
  CreateInkLayer,
  InkLayerImage,
  PageRenderParams,
} from '@pages/Generator/lib/render';
import { renderPageLayers } from '@pages/Generator/lib/render';
import { describe, expect, it } from 'vitest';

import type { RecordedCall } from './helpers/canvas-recorder';
import { createDrawRecorder, findCalls } from './helpers/canvas-recorder';

const PAGE_WIDTH = 40;
const PAGE_HEIGHT = 60;
const RUN_SEED = 77;

/**
 * Поле освещения-модель: половина листа затенена. Само по себе ничего не
 * проверяет — важно, что именно оно доходит до модуляции.
 */
const LIGHTING: LightingField = {
  gridWidth: 2,
  gridHeight: 1,
  values: [1, 0.4],
  contrast: 0.6,
  isUsable: true,
};

/**
 * Слой чернил вместе с лентой его вызовов и тем, о чём попросили модуляцию.
 */
type LayerProbe = {
  /**
   * Фабрика слоя — её отдают отрисовке.
   */
  createLayer: CreateInkLayer;

  /**
   * Вызовы контекста слоя.
   */
  calls: RecordedCall[];

  /**
   * Канва слоя: её же отдают шейдеру.
   */
  image: InkLayerImage;

  /**
   * Размеры, с которыми слой просили создать.
   */
  sizes: number[][];
};

/**
 * Слой чернил на записывателе.
 */
const createLayerProbe = (): LayerProbe => {
  const recorder = createDrawRecorder();
  const image = document.createElement('canvas');
  const sizes: number[][] = [];

  return {
    createLayer: (width, height) => {
      sizes.push([width, height]);

      return { context: recorder.context, image };
    },
    calls: recorder.calls,
    image,
    sizes,
  };
};

const BACKGROUND_IMAGE = document.createElement('canvas');

const buildParams = (): PageRenderParams => {
  return {
    page: {
      lines: [
        {
          words: [
            {
              text: 'аб',
              distortion: { rotate: 0, skew: 0, translateY: 0, letters: [] },
              seed: 5,
            },
          ],
          distortion: { rotate: 0, translateX: 0 },
        },
      ],
    },
    background: {
      image: BACKGROUND_IMAGE,
      width: PAGE_WIDTH,
      height: PAGE_HEIGHT,
    },
    inkColor: '#123456',
    ink: { lighting: LIGHTING, texture: null, seed: RUN_SEED },
    glyphs: null,
    fontFamily: 'Eskal',
    geometry: {
      fontSizePx: 10,
      lineSpacing: 0,
      topOffset: 4,
      leftPadding: 3,
      blockWidth: 0,
      blockRotate: 0,
      fontMetrics: { fontAscent: 0.8, lineHeight: 1.2 },
    },
    scale: 1,
  };
};

const SIZE = { width: PAGE_WIDTH, height: PAGE_HEIGHT };

describe('разделение проходов страницы', () => {
  it('оставляет фон на странице, а чернила уводит на свой слой', () => {
    const page = createDrawRecorder();
    const layer = createLayerProbe();
    const modulated = document.createElement('canvas');

    renderPageLayers(page.context, buildParams(), SIZE, {
      createLayer: layer.createLayer,
      modulate: () => {
        return modulated;
      },
    });

    expect(findCalls(page.calls, 'fillText')).toEqual([]);
    expect(findCalls(layer.calls, 'fillText')).toEqual([['аб', 0, 0]]);
    expect(layer.sizes).toEqual([[PAGE_WIDTH, PAGE_HEIGHT]]);
    expect(findCalls(page.calls, 'drawImage')).toEqual([
      [BACKGROUND_IMAGE, 0, 0, PAGE_WIDTH, PAGE_HEIGHT],
      [modulated, 0, 0, PAGE_WIDTH, PAGE_HEIGHT],
    ]);
  });

  it('отдаёт модуляции слой, освещение экземпляра и seed прогона', () => {
    const page = createDrawRecorder();
    const layer = createLayerProbe();
    const asked: InkLayerParams[] = [];

    renderPageLayers(page.context, buildParams(), SIZE, {
      createLayer: layer.createLayer,
      modulate: (params) => {
        asked.push(params);

        return null;
      },
    });

    expect(asked).toHaveLength(1);
    expect(asked[0]?.inkLayer).toBe(layer.image);
    expect(asked[0]?.lighting).toBe(LIGHTING);
    expect(asked[0]?.textureImage).toBeNull();
    expect(asked[0]?.seed).toBe(RUN_SEED);
    expect({ width: asked[0]?.width, height: asked[0]?.height }).toEqual(SIZE);
  });

  it('кладёт слой как есть, если модуляции не случилось', () => {
    const page = createDrawRecorder();
    const layer = createLayerProbe();

    renderPageLayers(page.context, buildParams(), SIZE, {
      createLayer: layer.createLayer,
      modulate: () => {
        return null;
      },
    });

    expect(findCalls(page.calls, 'drawImage')[1]).toEqual([
      layer.image,
      0,
      0,
      PAGE_WIDTH,
      PAGE_HEIGHT,
    ]);
  });

  it('рисует чернила прямо на страницу, когда слоя не дали', () => {
    const page = createDrawRecorder();
    let modulateCalls = 0;

    renderPageLayers(page.context, buildParams(), SIZE, {
      createLayer: () => {
        return null;
      },
      modulate: () => {
        modulateCalls += 1;

        return null;
      },
    });

    expect(findCalls(page.calls, 'fillText')).toEqual([['аб', 0, 0]]);
    expect(findCalls(page.calls, 'drawImage')).toEqual([
      [BACKGROUND_IMAGE, 0, 0, PAGE_WIDTH, PAGE_HEIGHT],
    ]);
    expect(modulateCalls).toBe(0);
  });
});
