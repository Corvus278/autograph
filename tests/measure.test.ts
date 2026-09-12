/**
 * @vitest-environment jsdom
 */
import { createDomMeasurer } from '@pages/Generator/lib/measure/createDomMeasurer';
import type { FontsReadySource } from '@pages/Generator/lib/measure/measure.types';
import { waitForFont } from '@pages/Generator/lib/measure/waitForFont';
import { splitParagraphs } from '@pages/Generator/lib/split/splitParagraphs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createMonospaceMeasurer } from './helpers/monospace-measurer';

/**
 * Параметры измерителя для `waitForFont`: важно, что семейство доезжает до
 * запроса шрифта.
 */
const measurerParams = { fontFamily: 'Abram' };

/**
 * Ширина символа в заглушке раскладки в долях кегля контейнера.
 */
const STUB_CHAR_SHARE = 0.5;

/**
 * Кегли двух страниц с разными листами.
 */
const SMALL_FONT_SIZE_PX = 30;
const LARGE_FONT_SIZE_PX = 45;

describe('TextMeasurer', () => {
  it('отдаёт ширину пропорционально длине фрагмента', () => {
    const measure = createMonospaceMeasurer({ charWidth: 10 });

    expect(measure.measureWidth('абв')).toBe(30);
    expect(measure.measureWidth('')).toBe(0);
  });

  it('используется разбивкой на строки', () => {
    const measure = createMonospaceMeasurer();

    splitParagraphs('раз два три', { width: 100, fontSizePx: 20, measure });

    expect(measure.widthCalls()).toBeGreaterThan(0);
  });
});

describe('createDomMeasurer', () => {
  let rectCallsCount = 0;

  /**
   * Заглушка раскладки: ширина фрагмента — доля кегля того контейнера, в
   * котором он лежит. По ней видно, при каком кегле мерили.
   */
  beforeEach(() => {
    rectCallsCount = 0;
    vi.spyOn(Range.prototype, 'getClientRects').mockImplementation(() => {
      rectCallsCount += 1;

      const container = document.body.lastElementChild;
      const fontSize =
        container instanceof HTMLElement
          ? Number.parseFloat(container.style.fontSize)
          : 0;
      const width = (container?.textContent || '').length * STUB_CHAR_SHARE * fontSize;
      const rect: DOMRect = {
        x: 0,
        y: 0,
        width,
        height: 0,
        top: 0,
        right: width,
        bottom: 0,
        left: 0,
        toJSON: () => {
          return {};
        },
      };

      return Object.assign([rect], {
        item: () => {
          return rect;
        },
      });
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('отдаёт ширину в долях кегля, одним замером на страницы с разным кеглем', () => {
    const measurer = createDomMeasurer(measurerParams);
    const text = 'раз два';
    const smallWidthPx = measurer.measureWidth(text) * SMALL_FONT_SIZE_PX;
    const largeWidthPx = measurer.measureWidth(text) * LARGE_FONT_SIZE_PX;

    measurer.destroy();

    expect(measurer.measureWidth).toBeTypeOf('function');
    expect(rectCallsCount).toBe(1);
    expect(largeWidthPx / smallWidthPx).toBeCloseTo(
      LARGE_FONT_SIZE_PX / SMALL_FONT_SIZE_PX,
      9
    );
    expect(smallWidthPx).toBeCloseTo(
      text.length * STUB_CHAR_SHARE * SMALL_FONT_SIZE_PX,
      9
    );
  });
});

describe('waitForFont', () => {
  it('не отдаёт управление, пока шрифт не загрузился', async () => {
    const order: string[] = [];
    let resolveLoad = (): void => {};

    const fonts: FontsReadySource = {
      load: () => {
        return new Promise((resolve) => {
          resolveLoad = () => {
            order.push('load');
            resolve([]);
          };
        });
      },
      /**
       * `waitForFont` из `ready` ничего не читает — ждёт только разрешения
       * промиса, поэтому пустой объект под каст подходит.
       */
      ready: Promise.resolve({} as FontFaceSet),
    };

    const waiting = waitForFont(measurerParams, fonts).then(() => {
      order.push('measure');
    });

    expect(order).toEqual([]);

    resolveLoad();
    await waiting;

    expect(order).toEqual(['load', 'measure']);
  });

  it('запрашивает выбранное начертание', async () => {
    const requested: string[] = [];

    const fonts: FontsReadySource = {
      load: (font) => {
        requested.push(font);

        return Promise.resolve([]);
      },
      ready: Promise.resolve({} as FontFaceSet),
    };

    await waitForFont(measurerParams, fonts);

    expect(requested).toEqual(['1em "Abram"']);
  });
});
