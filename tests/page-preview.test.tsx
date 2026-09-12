/**
 * @vitest-environment jsdom
 */
import { clearLayoutCache } from '@pages/Generator/model/measureLayout';
import {
  DEFAULT_GENERATOR_STATE,
  useGeneratorStore,
} from '@pages/Generator/model/useGeneratorStore';
import { usePageLayout } from '@pages/Generator/model/usePageLayout';
import { usePageRender } from '@pages/Generator/model/usePageRender';
import { PageNav } from '@pages/Generator/ui/Generator/PageNav';
import { PagePreview } from '@pages/Generator/ui/Generator/PagePreview';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import type { FC } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { findCalls, getCanvasFrame } from './helpers/canvas-recorder';
import type { MonospaceMeasurerFactory } from './helpers/monospace-measurer';
import { createMonospaceMeasurerFactory } from './helpers/monospace-measurer';
import { buildRenderFamily } from './helpers/paper-family';

/**
 * Повторяет сборку экрана генератора, но с измерителем-моделью: настоящих
 * размеров jsdom не считает, а проверяем мы разбивку и состав отрисованного, а
 * не вёрстку.
 */
type HarnessProps = {
  /**
   * Фабрика измерителей-шпионов.
   */
  factory: MonospaceMeasurerFactory;
};

const Harness: FC<HarnessProps> = (props) => {
  const { factory } = props;
  const pages = usePageLayout(factory.create);
  const source = usePageRender(pages);

  return (
    <>
      <PagePreview source={source} />

      <PageNav pageCount={pages.length} />
    </>
  );
};

const FAMILY = buildRenderFamily();

/**
 * Запас снизу в шагах разлиновки, оставляющий под текст ровно две строки
 * измерителя-модели: верхний отступ блока у семьи-модели нулевой, высота
 * листа — четыреста пикселей, шаг — сорок, высота строки — двадцать. Восемь
 * и три четверти шага — триста пятьдесят пикселей, под текст остаётся
 * пятьдесят.
 */
const TWO_LINE_BOTTOM_MARGIN = 8.75;

/**
 * Поправка кегля в долях шага: четверть шага семьи-модели — десять пикселей.
 */
const FONT_SIZE_CORRECTION = 0.25;

/**
 * Узел canvas страницы: на нём рисует предпросмотр.
 *
 * @returns узел предпросмотра
 */
const getPageCanvas = (): HTMLCanvasElement => {
  const canvas = screen.getByTestId('page-canvas');

  if (!(canvas instanceof HTMLCanvasElement)) {
    throw new Error('Предпросмотр рисует не на canvas');
  }

  return canvas;
};

/**
 * Слова, отрисованные на странице, в порядке отрисовки.
 *
 * @returns тексты, попавшие в снимок
 */
const getDrawnWords = (): unknown[] => {
  return findCalls(getCanvasFrame(getPageCanvas()), 'fillText').map(([text]) => {
    return text;
  });
};

/**
 * Отступ блока текста от левого края листа: рендерер сдвигает на него начало
 * координат перед отрисовкой строк.
 *
 * @returns отступ в канонических пикселях семьи
 */
const getBlockLeftPadding = (): unknown => {
  const [translate] = findCalls(getCanvasFrame(getPageCanvas()), 'translate');

  return translate?.[0];
};

const renderHarness = async (factory: MonospaceMeasurerFactory) => {
  render(<Harness factory={factory} />);

  await waitFor(() => {
    expect(getDrawnWords().length).toBeGreaterThan(0);
  });
};

beforeEach(() => {
  clearLayoutCache();
  useGeneratorStore.setState({
    ...DEFAULT_GENERATOR_STATE,
    text: 'раз два три четыре пять шесть',
    presetFamilies: [FAMILY],
    familyId: FAMILY.id,
    sheetId: FAMILY.sheets[0]?.id || '',
  });
});

afterEach(() => {
  cleanup();
});

describe('разбивка на строки и страницы', () => {
  it('переносит текст по ширине блока', async () => {
    const factory = createMonospaceMeasurerFactory();

    await renderHarness(factory);

    expect(getDrawnWords()).toEqual(['раз', 'два', 'три', 'четыре', 'пять', 'шесть']);
    expect(screen.queryByRole('navigation', { name: 'Страницы' })).toBeNull();
  });

  it('разбивает на страницы по доступной высоте', async () => {
    const factory = createMonospaceMeasurerFactory();

    useGeneratorStore.setState({ bottomMargin: TWO_LINE_BOTTOM_MARGIN });
    await renderHarness(factory);

    expect(getDrawnWords()).toEqual(['раз', 'два', 'три', 'четыре']);
    expect(screen.getAllByRole('button')).toHaveLength(2);
  });

  it('показывает выбранную страницу', async () => {
    const factory = createMonospaceMeasurerFactory();

    useGeneratorStore.setState({ bottomMargin: TWO_LINE_BOTTOM_MARGIN });
    await renderHarness(factory);

    act(() => {
      useGeneratorStore.getState().goToPage(1);
    });

    await waitFor(() => {
      expect(getDrawnWords()).toEqual(['пять', 'шесть']);
    });
  });
});

describe('разворот чётных страниц', () => {
  it('отодвигает блок от отражённой линии поля', async () => {
    const factory = createMonospaceMeasurerFactory();

    useGeneratorStore.setState({ bottomMargin: TWO_LINE_BOTTOM_MARGIN });
    await renderHarness(factory);

    expect(getBlockLeftPadding()).toBeCloseTo(FAMILY.ruling.margins.left);

    act(() => {
      useGeneratorStore.getState().goToPage(1);
    });

    /**
     * Блок отражается вместе с листом: слева от него остаётся столько же,
     * сколько на нечётной странице оставалось справа.
     */
    await waitFor(() => {
      expect(getBlockLeftPadding()).toBeCloseTo(FAMILY.ruling.margins.right);
    });
  });
});

describe('кэш разбивки', () => {
  it('не измеряет заново при изменении цвета чернил', async () => {
    const factory = createMonospaceMeasurerFactory();

    await renderHarness(factory);

    const measuresBefore = factory.createCalls();

    act(() => {
      useGeneratorStore.getState().setInkColor('#ff0000');
    });

    await waitFor(() => {
      expect(getDrawnWords().length).toBeGreaterThan(0);
    });

    expect(factory.createCalls()).toBe(measuresBefore);
  });

  it('измеряет заново при изменении поправки кегля', async () => {
    const factory = createMonospaceMeasurerFactory();

    await renderHarness(factory);

    const measuresBefore = factory.createCalls();

    act(() => {
      useGeneratorStore
        .getState()
        .setGeometryCorrection({ fontSizePx: FONT_SIZE_CORRECTION });
    });

    await waitFor(() => {
      expect(factory.createCalls()).toBe(measuresBefore + 1);
    });
  });

  it('берёт готовую разбивку из кэша при возврате к прежним параметрам', async () => {
    const factory = createMonospaceMeasurerFactory();

    await renderHarness(factory);

    act(() => {
      useGeneratorStore
        .getState()
        .setGeometryCorrection({ fontSizePx: FONT_SIZE_CORRECTION });
    });

    await waitFor(() => {
      expect(factory.createCalls()).toBe(2);
    });

    act(() => {
      useGeneratorStore.getState().setGeometryCorrection({ fontSizePx: 0 });
    });

    await waitFor(() => {
      expect(getDrawnWords().length).toBeGreaterThan(0);
    });

    expect(factory.createCalls()).toBe(2);
  });
});

describe('снимок страницы', () => {
  it('не содержит элементов интерфейса', async () => {
    const factory = createMonospaceMeasurerFactory();

    useGeneratorStore.setState({ bottomMargin: TWO_LINE_BOTTOM_MARGIN });
    await renderHarness(factory);

    const pageNode = screen.getByTestId('page');

    expect(pageNode.querySelectorAll('button')).toHaveLength(0);
    expect(pageNode.querySelectorAll('nav')).toHaveLength(0);
    expect(pageNode.querySelectorAll('input')).toHaveLength(0);
    expect(pageNode.querySelectorAll('canvas')).toHaveLength(1);
  });

  it('рисует лист и текст, и ничего кроме', async () => {
    const factory = createMonospaceMeasurerFactory();

    await renderHarness(factory);

    const drawn = new Set(
      getCanvasFrame(getPageCanvas()).map((call) => {
        return call.name;
      })
    );

    expect([...drawn].sort()).toEqual([
      'fillStyle',
      'fillText',
      'font',
      'restore',
      'save',
      'scale',
      'translate',
    ]);
  });
});
