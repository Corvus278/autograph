import { FALLBACK_FONT_METRICS } from '@pages/Generator/lib/measure/measureFontMetrics';
import { selectBlockGeometry } from '@pages/Generator/model/geometrySelectors';
import {
  DEFAULT_GENERATOR_STATE,
  useGeneratorStore,
} from '@pages/Generator/model/useGeneratorStore';
import { beforeEach, describe, expect, it } from 'vitest';

/**
 * Метрики берём запасные, а не измеренные: тест про сложение поправки с
 * вычисленным, и ему нужны одни и те же числа в любом окружении.
 */
const METRICS = FALLBACK_FONT_METRICS;

const store = () => {
  return useGeneratorStore.getState();
};

/**
 * Геометрия по текущему состоянию стора.
 */
const geometry = () => {
  return selectBlockGeometry(store(), METRICS);
};

beforeEach(() => {
  useGeneratorStore.setState(DEFAULT_GENERATOR_STATE);
});

describe('поправка поверх вычисленной геометрии', () => {
  it('складывается с вычисленным, а не заменяет его', () => {
    const derived = geometry();

    store().setGeometryCorrection({ topOffset: 12, blockWidth: -40 });

    expect(geometry()?.topOffset).toBeCloseTo((derived?.topOffset || 0) + 12);
    expect(geometry()?.blockWidth).toBeCloseTo((derived?.blockWidth || 0) - 40);
  });

  it('меняет только названную дельту', () => {
    store().setGeometryCorrection({ topOffset: 12 });
    store().setGeometryCorrection({ leftPadding: 8 });

    expect(store().geometryCorrection.topOffset).toBe(12);
    expect(store().geometryCorrection.leftPadding).toBe(8);
  });

  it('не трогает абсолютные значения слайдеров старой модели', () => {
    store().setGeometryCorrection({ topOffset: 12 });

    expect(store().topOffset).toBe(DEFAULT_GENERATOR_STATE.topOffset);
    expect(store().blockWidth).toBe(DEFAULT_GENERATOR_STATE.blockWidth);
  });
});

describe('поправка при смене листа', () => {
  it('сохраняется при смене экземпляра внутри семьи', () => {
    const derived = geometry();

    store().setGeometryCorrection({ topOffset: 25 });
    store().selectSheet('grid-3');

    expect(store().geometryCorrection.topOffset).toBe(25);
    expect(geometry()?.topOffset).toBeCloseTo((derived?.topOffset || 0) + 25);
  });

  it('применяется к заново вычисленному после смены семьи', () => {
    store().selectFamily('lined');

    const derived = geometry();

    store().setGeometryCorrection({ topOffset: 25 });

    expect(geometry()?.topOffset).toBeCloseTo((derived?.topOffset || 0) + 25);
  });

  it('не перекладывает текст при смене экземпляра', () => {
    const derived = geometry();

    store().selectSheet('grid-4');

    expect(geometry()).toEqual(derived);
  });
});

describe('сброс поправки', () => {
  it('возвращает геометрию к вычисленной из разлиновки', () => {
    const derived = geometry();

    store().setGeometryCorrection({ topOffset: 25, fontSizePx: 4 });
    store().resetGeometryCorrection();

    expect(geometry()).toEqual(derived);
    expect(store().geometryCorrection.topOffset).toBe(0);
  });
});
