import type { FontsReadySource } from '@pages/Generator/lib/measure/measure.types';
import { waitForFont } from '@pages/Generator/lib/measure/waitForFont';
import { paginate } from '@pages/Generator/lib/paginate/paginate';
import { splitParagraphs } from '@pages/Generator/lib/split/splitParagraphs';
import { describe, expect, it } from 'vitest';

import { createMonospaceMeasurer } from './helpers/monospace-measurer';

/**
 * Параметры отрисовки для `waitForFont`: конкретные значения не важны, важно,
 * что они доезжают до запроса шрифта.
 */
const measurerParams = { fontFamily: 'Abram', fontSize: 1.6, lineSpacing: -2 };

describe('TextMeasurer', () => {
  it('отдаёт ширину пропорционально длине фрагмента', () => {
    const measure = createMonospaceMeasurer({ charWidth: 10 });

    expect(measure.measureWidth('абв')).toBe(30);
    expect(measure.measureWidth('')).toBe(0);
  });

  it('используется разбивкой на строки', () => {
    const measure = createMonospaceMeasurer();

    splitParagraphs('раз два три', { width: 100, measure });

    expect(measure.widthCalls()).toBeGreaterThan(0);
  });

  it('используется разбивкой на страницы', () => {
    const measure = createMonospaceMeasurer();

    paginate([{ text: 'раз', paragraphIndex: 0 }], {
      availableHeight: 100,
      measure,
    });

    expect(measure.lineHeightCalls()).toBe(1);
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

    expect(requested).toEqual(['1.6em "Abram"']);
  });
});
