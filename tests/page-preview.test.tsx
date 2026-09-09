/**
 * @vitest-environment jsdom
 */
import { clearLayoutCache } from '@pages/Generator/model/measureLayout';
import {
  DEFAULT_GENERATOR_STATE,
  useGeneratorStore,
} from '@pages/Generator/model/useGeneratorStore';
import { usePageBackground } from '@pages/Generator/model/usePageBackground';
import { usePageLayout } from '@pages/Generator/model/usePageLayout';
import { PageNav } from '@pages/Generator/ui/Generator/PageNav';
import { PagePreview } from '@pages/Generator/ui/Generator/PagePreview';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import type { FC } from 'react';
import { useRef } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { MonospaceMeasurerFactory } from './helpers/monospace-measurer';
import { createMonospaceMeasurerFactory } from './helpers/monospace-measurer';

/**
 * Повторяет сборку экрана генератора, но с измерителем-моделью: настоящих
 * размеров jsdom не считает, а проверяем мы разбивку и разметку, а не вёрстку.
 */
type HarnessProps = {
  /**
   * Фабрика измерителей-шпионов.
   */
  factory: MonospaceMeasurerFactory;
};

const Harness: FC<HarnessProps> = (props) => {
  const { factory } = props;
  const pageRef = useRef<HTMLDivElement>(null);
  const background = usePageBackground();
  const pages = usePageLayout(background.height, factory.create);
  const pageIndex = useGeneratorStore((state) => {
    return state.pageIndex;
  });
  const page = pages[pageIndex] ?? pages[0] ?? { lines: [] };

  return (
    <>
      <PagePreview pageRef={pageRef} page={page} background={background} />

      <PageNav pageCount={pages.length} />
    </>
  );
};

/**
 * Ширина символа 10 при ширине блока 100 даёт ровно десять символов в строке,
 * высота строки 20 — ровно две строки на страницу при доступной высоте 40.
 */
const renderHarness = async (factory: MonospaceMeasurerFactory) => {
  render(<Harness factory={factory} />);

  await waitFor(() => {
    expect(screen.getAllByTestId('line').length).toBeGreaterThan(0);
  });
};

beforeEach(() => {
  clearLayoutCache();
  useGeneratorStore.setState({
    ...DEFAULT_GENERATOR_STATE,
    text: 'раз два три четыре пять шесть',
    blockWidth: 100,
    topOffset: 0,
  });
});

afterEach(() => {
  cleanup();
});

describe('фон страницы', () => {
  it('меняет картинку при выборе другого встроенного фона', async () => {
    const factory = createMonospaceMeasurerFactory();

    await renderHarness(factory);

    expect(document.querySelector('img')?.getAttribute('src')).toBe('/33.jpg');

    act(() => {
      useGeneratorStore.getState().selectBackground('lined');
    });

    await waitFor(() => {
      expect(document.querySelector('img')?.getAttribute('src')).toBe('/line.jpg');
    });
  });

  it('скрывает лист в режиме «убрать фон»', async () => {
    const factory = createMonospaceMeasurerFactory();

    await renderHarness(factory);

    act(() => {
      useGeneratorStore.getState().setBackgroundHidden(true);
    });

    await waitFor(() => {
      expect(document.querySelector('img')).toBeNull();
    });
  });
});

describe('разбивка на строки и страницы', () => {
  it('переносит текст по ширине блока', async () => {
    const factory = createMonospaceMeasurerFactory();

    useGeneratorStore.setState({ bottomMargin: 0 });
    await renderHarness(factory);

    expect(screen.getAllByTestId('line')).toHaveLength(3);
    expect(screen.queryByRole('navigation', { name: 'Страницы' })).toBeNull();
  });

  it('разбивает на страницы по доступной высоте', async () => {
    const factory = createMonospaceMeasurerFactory();

    /**
     * Лист «в клетку» в предпросмотре — 896 пикселей высотой; оставляем под
     * текст 40, то есть ровно две строки.
     */
    useGeneratorStore.setState({ bottomMargin: 856 });
    await renderHarness(factory);

    expect(screen.getAllByTestId('line')).toHaveLength(2);
    expect(screen.getAllByRole('button')).toHaveLength(2);
  });

  it('показывает выбранную страницу', async () => {
    const factory = createMonospaceMeasurerFactory();

    useGeneratorStore.setState({ bottomMargin: 856 });
    await renderHarness(factory);

    act(() => {
      useGeneratorStore.getState().goToPage(1);
    });

    await waitFor(() => {
      expect(screen.getAllByTestId('line')).toHaveLength(1);
    });
  });
});

describe('разворот чётных страниц', () => {
  it('зеркалит фон и берёт отступ чётных страниц', async () => {
    const factory = createMonospaceMeasurerFactory();

    useGeneratorStore.setState({ bottomMargin: 856, evenPageLeftPadding: 80 });
    await renderHarness(factory);

    const image = document.querySelector('img');

    expect(image?.style.transform).toBe('');

    act(() => {
      useGeneratorStore.getState().goToPage(1);
    });

    await waitFor(() => {
      expect(document.querySelector('img')?.style.transform).toBe('scaleX(-1)');
    });

    const textBlock = screen.getByTestId('line').parentElement;

    expect(textBlock?.style.paddingLeft).toBe('80px');
  });
});

describe('кэш разбивки', () => {
  it('не измеряет заново при изменении поворота блока', async () => {
    const factory = createMonospaceMeasurerFactory();

    await renderHarness(factory);

    const measuresBefore = factory.createCalls();

    act(() => {
      useGeneratorStore.getState().setGeometry({ blockRotate: 15 });
    });

    await waitFor(() => {
      expect(screen.getAllByTestId('line').length).toBeGreaterThan(0);
    });

    expect(factory.createCalls()).toBe(measuresBefore);
  });

  it('измеряет заново при изменении размера шрифта', async () => {
    const factory = createMonospaceMeasurerFactory();

    await renderHarness(factory);

    const measuresBefore = factory.createCalls();

    act(() => {
      useGeneratorStore.getState().setGeometry({ fontSize: 3 });
    });

    await waitFor(() => {
      expect(factory.createCalls()).toBe(measuresBefore + 1);
    });
  });

  it('берёт готовую разбивку из кэша при возврате к прежним параметрам', async () => {
    const factory = createMonospaceMeasurerFactory();

    await renderHarness(factory);

    act(() => {
      useGeneratorStore.getState().setGeometry({ fontSize: 3 });
    });

    await waitFor(() => {
      expect(factory.createCalls()).toBe(2);
    });

    act(() => {
      useGeneratorStore
        .getState()
        .setGeometry({ fontSize: DEFAULT_GENERATOR_STATE.fontSize });
    });

    await waitFor(() => {
      expect(screen.getAllByTestId('line').length).toBeGreaterThan(0);
    });

    expect(factory.createCalls()).toBe(2);
  });
});

describe('снимок страницы', () => {
  it('не содержит элементов интерфейса', async () => {
    const factory = createMonospaceMeasurerFactory();

    useGeneratorStore.setState({ bottomMargin: 856 });
    await renderHarness(factory);

    const pageNode = screen.getByTestId('page');

    expect(pageNode.querySelectorAll('button')).toHaveLength(0);
    expect(pageNode.querySelectorAll('nav')).toHaveLength(0);
    expect(pageNode.querySelectorAll('input')).toHaveLength(0);
  });
});
