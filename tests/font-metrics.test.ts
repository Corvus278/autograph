import type {
  FontMetricsProbe,
  FontMetricsProbeFactory,
  FontsReadySource,
} from '@pages/Generator/lib/measure/measure.types';
import {
  clearFontMetricsCache,
  FALLBACK_FONT_METRICS,
  loadFontMetrics,
  measureFontMetrics,
} from '@pages/Generator/lib/measure/measureFontMetrics';
import { beforeEach, describe, expect, it } from 'vitest';

/**
 * Кегль модели: доли метрик считаются делением на него, поэтому замеры ниже
 * читаются как проценты.
 */
const PROBE_FONT_SIZE_PX = 100;

type ProbeModelParams = {
  /**
   * Подъём чернил строчных без выносных элементов в пикселях.
   */
  xHeightPx?: number;

  /**
   * Подъём строчного бокса шрифта в пикселях.
   */
  fontAscentPx?: number;

  /**
   * Естественная высота строки в пикселях.
   */
  lineHeightPx?: number;

  /**
   * Кегль модели в пикселях.
   */
  fontSizePx?: number;
};

type ProbeModel = {
  /**
   * Фабрика щупа — её отдают `measureFontMetrics`.
   */
  create: FontMetricsProbeFactory;

  /**
   * Сколько раз создавали щуп: по счётчику видно, работает ли кэш.
   */
  createCalls: () => number;

  /**
   * Сколько раз снимали размеры.
   */
  measureCalls: () => number;

  /**
   * Семейства, метрики которых запрашивали, в порядке обращения.
   */
  requested: () => string[];
};

/**
 * Щуп-модель: отдаёт заданные размеры вместо настоящих. Размеры от текста
 * образца не зависят — иначе тест держался бы за содержимое констант в
 * реализации и пережил бы их замену.
 */
const createProbeModel = (params: ProbeModelParams = {}): ProbeModel => {
  const {
    xHeightPx = 48,
    fontAscentPx = 95,
    lineHeightPx = 125,
    fontSizePx = PROBE_FONT_SIZE_PX,
  } = params;
  const requestedFamilies: string[] = [];
  let createCallsCount = 0;
  let measureCallsCount = 0;

  return {
    create: (fontFamily) => {
      createCallsCount += 1;
      requestedFamilies.push(fontFamily);

      const probe: FontMetricsProbe = {
        measureInkAscent: () => {
          measureCallsCount += 1;

          return xHeightPx;
        },
        measureFontAscent: () => {
          measureCallsCount += 1;

          return fontAscentPx;
        },
        measureLineHeight: () => {
          measureCallsCount += 1;

          return lineHeightPx;
        },
        fontSizePx,
      };

      return probe;
    },
    createCalls: () => {
      return createCallsCount;
    },
    measureCalls: () => {
      return measureCallsCount;
    },
    requested: () => {
      return requestedFamilies;
    },
  };
};

/**
 * Источник шрифтов документа для `loadFontMetrics`: считает запросы и даёт
 * задержать загрузку.
 */
const createFontsModel = (): {
  /**
   * Сам источник — его отдают `loadFontMetrics`.
   */
  fonts: FontsReadySource;

  /**
   * Запрошенные начертания.
   */
  requested: () => string[];
} => {
  const requestedFonts: string[] = [];

  return {
    fonts: {
      load: (font) => {
        requestedFonts.push(font);

        return Promise.resolve([]);
      },
      /**
       * `waitForFont` из `ready` ничего не читает — ждёт только разрешения
       * промиса, поэтому пустой объект под каст подходит.
       */
      ready: Promise.resolve({} as FontFaceSet),
    },
    requested: () => {
      return requestedFonts;
    },
  };
};

describe('measureFontMetrics', () => {
  beforeEach(() => {
    clearFontMetricsCache();
  });

  it('снимает метрики в долях кегля', () => {
    const probe = createProbeModel({
      xHeightPx: 48,
      fontAscentPx: 95,
      lineHeightPx: 125,
    });

    const metrics = measureFontMetrics('Abram', probe.create);

    expect(metrics.xHeight).toBeCloseTo(0.48, 10);
    expect(metrics.fontAscent).toBeCloseTo(0.95, 10);
    expect(metrics.lineHeight).toBeCloseTo(1.25, 10);
  });

  it('доли не зависят от кегля, на котором сняты размеры', () => {
    const small = createProbeModel({ xHeightPx: 48, fontSizePx: 100 });
    const large = createProbeModel({ xHeightPx: 96, fontSizePx: 200 });

    const smallMetrics = measureFontMetrics('Abram', small.create);

    clearFontMetricsCache();

    const largeMetrics = measureFontMetrics('Abram', large.create);

    expect(largeMetrics.xHeight).toBeCloseTo(smallMetrics.xHeight, 10);
  });

  it('повторный вызов ничего не измеряет', () => {
    const probe = createProbeModel();

    const first = measureFontMetrics('Abram', probe.create);
    const measureCallsAfterFirst = probe.measureCalls();
    const second = measureFontMetrics('Abram', probe.create);

    expect(second).toEqual(first);
    expect(probe.createCalls()).toBe(1);
    expect(probe.measureCalls()).toBe(measureCallsAfterFirst);
  });

  it('разные семейства получают свои метрики', () => {
    const abram = createProbeModel({ xHeightPx: 48, fontAscentPx: 95 });
    const eskal = createProbeModel({ xHeightPx: 62, fontAscentPx: 110 });

    const abramMetrics = measureFontMetrics('Abram', abram.create);
    const eskalMetrics = measureFontMetrics('Eskal', eskal.create);

    expect(abramMetrics.xHeight).toBeCloseTo(0.48, 10);
    expect(eskalMetrics.xHeight).toBeCloseTo(0.62, 10);
    expect(abram.requested()).toEqual(['Abram']);
    expect(eskal.requested()).toEqual(['Eskal']);
  });

  it('после подмены начертания под тем же именем метрики берутся новые', () => {
    const first = createProbeModel({ xHeightPx: 48, fontAscentPx: 95 });
    const second = createProbeModel({ xHeightPx: 70, fontAscentPx: 118 });

    const before = measureFontMetrics('UserFont', first.create);

    clearFontMetricsCache();

    const after = measureFontMetrics('UserFont', second.create);

    expect(before.xHeight).toBeCloseTo(0.48, 10);
    expect(after.xHeight).toBeCloseTo(0.7, 10);
    expect(after.fontAscent).toBeCloseTo(1.18, 10);
  });

  it('без сброса кэша подмена начертания не подхватывается', () => {
    const first = createProbeModel({ xHeightPx: 48 });
    const second = createProbeModel({ xHeightPx: 70 });

    measureFontMetrics('UserFont', first.create);

    const stale = measureFontMetrics('UserFont', second.create);

    expect(stale.xHeight).toBeCloseTo(0.48, 10);
    expect(second.createCalls()).toBe(0);
  });

  it('без щупа отдаёт запасные метрики', () => {
    const metrics = measureFontMetrics('Abram', () => {
      return null;
    });

    expect(metrics).toEqual(FALLBACK_FONT_METRICS);
  });

  it('на нулевых замерах отдаёт запасные метрики', () => {
    const probe = createProbeModel({
      xHeightPx: 0,
      fontAscentPx: 0,
      lineHeightPx: 0,
    });

    const metrics = measureFontMetrics('Abram', probe.create);

    expect(metrics).toEqual(FALLBACK_FONT_METRICS);
  });

  it('неудачный замер не залипает в кэше', () => {
    const broken = createProbeModel({ xHeightPx: 0 });
    const working = createProbeModel({ xHeightPx: 48 });

    measureFontMetrics('Abram', broken.create);

    const metrics = measureFontMetrics('Abram', working.create);

    expect(metrics.xHeight).toBeCloseTo(0.48, 10);
  });
});

describe('loadFontMetrics', () => {
  beforeEach(() => {
    clearFontMetricsCache();
  });

  it('меряет только после загрузки шрифта', async () => {
    const probe = createProbeModel();
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
      ready: Promise.resolve({} as FontFaceSet),
    };

    const loading = loadFontMetrics('Abram', probe.create, fonts).then(() => {
      order.push('measure');
    });

    expect(probe.createCalls()).toBe(0);

    resolveLoad();
    await loading;

    expect(order).toEqual(['load', 'measure']);
    expect(probe.createCalls()).toBe(1);
  });

  it('запрашивает выбранное начертание', async () => {
    const probe = createProbeModel();
    const fontsModel = createFontsModel();

    await loadFontMetrics('Abram', probe.create, fontsModel.fonts);

    expect(fontsModel.requested()).toEqual(['1em "Abram"']);
  });

  it('на запомненном семействе шрифт не грузит', async () => {
    const probe = createProbeModel();
    const fontsModel = createFontsModel();

    await loadFontMetrics('Abram', probe.create, fontsModel.fonts);
    await loadFontMetrics('Abram', probe.create, fontsModel.fonts);

    expect(fontsModel.requested()).toEqual(['1em "Abram"']);
    expect(probe.createCalls()).toBe(1);
  });
});
