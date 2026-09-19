/**
 * @vitest-environment jsdom
 */
import { clearLayoutCache } from '@pages/Generator/model/measureLayout';
import type { PageRenderTask } from '@pages/Generator/model/pageTask.types';
import {
  DEFAULT_GENERATOR_STATE,
  useGeneratorStore,
} from '@pages/Generator/model/useGeneratorStore';
import { usePageLayout } from '@pages/Generator/model/usePageLayout';
import { usePageRender } from '@pages/Generator/model/usePageRender';
import { useRunRender } from '@pages/Generator/model/useRunRender';
import type { DetailRasterDeps } from '@pages/Generator/ui/Generator/SheetViewport';
import { SheetViewport } from '@pages/Generator/ui/Generator/SheetViewport';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { FC } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createMonospaceMeasurerFactory } from './helpers/monospace-measurer';
import { buildRenderFamily } from './helpers/paper-family';

const FAMILY = buildRenderFamily();

/**
 * Область просмотра, в которую лист семьи-модели (200 × 400) вписывается ровно
 * в половину: за вычетом отступов по 24 пикселя остаётся 100 × 200.
 */
const VIEWPORT_WIDTH = 148;
const VIEWPORT_HEIGHT = 248;

/**
 * Неразрывный пробел между числом и знаком процента в подписи масштаба.
 */
const NBSP = ' ';

type HarnessProps = {
  /**
   * Чем рисовать детальный растр; подменяется, воркера в jsdom нет.
   */
  detailDeps: Partial<DetailRasterDeps>;
};

/**
 * Повторяет сборку экрана генератора вокруг области просмотра: источник и план
 * отрисовки идут из стора, как на экране.
 */
const Harness: FC<HarnessProps> = (props) => {
  const { detailDeps } = props;
  const pages = usePageLayout(createMonospaceMeasurerFactory({ charWidth: 0.2 }).create);
  const source = usePageRender(pages);
  const plan = useRunRender(pages);

  return <SheetViewport source={source} plan={plan} detailDeps={detailDeps} />;
};

/**
 * Колбэки поддельного `ResizeObserver`: тест сам решает, когда область
 * просмотра «измерилась».
 */
const resizeCallbacks = new Set<() => void>();

/**
 * Управляемая подделка `ResizeObserver`: заглушка из общей настройки jsdom
 * никогда не зовёт колбэк, а вписывание от него и зависит.
 */
class ResizeObserverFake implements ResizeObserver {
  private readonly notify: () => void;

  constructor(callback: ResizeObserverCallback) {
    this.notify = () => {
      callback([], this);
    };
  }

  observe(): void {
    resizeCallbacks.add(this.notify);
  }

  unobserve(): void {
    resizeCallbacks.delete(this.notify);
  }

  disconnect(): void {
    resizeCallbacks.delete(this.notify);
  }
}

const ORIGINAL_RESIZE_OBSERVER = globalThis.ResizeObserver;
const ORIGINAL_PIXEL_RATIO = window.devicePixelRatio;

/**
 * Даёт области просмотра размер и сообщает о нём наблюдателю: jsdom layout не
 * считает, и `clientWidth` у него всегда ноль.
 */
const resizeViewport = (width: number, height: number): void => {
  const viewport = screen.getByRole('region', { name: 'Лист' });

  Object.defineProperty(viewport, 'clientWidth', { configurable: true, value: width });
  Object.defineProperty(viewport, 'clientHeight', { configurable: true, value: height });
  act(() => {
    resizeCallbacks.forEach((notify) => {
      notify();
    });
  });
};

const setPixelRatio = (ratio: number): void => {
  Object.defineProperty(window, 'devicePixelRatio', { configurable: true, value: ratio });
};

const getPageCanvas = (): HTMLCanvasElement => {
  const canvas = screen.getByTestId('page-canvas');

  if (!(canvas instanceof HTMLCanvasElement)) {
    throw new Error('Основной растр рисуется не на canvas');
  }

  return canvas;
};

const getZoomLabel = (): string => {
  return screen.getByTestId('zoom-label').textContent || '';
};

/**
 * Поддельный клиент воркера: запоминает задания и сигналы и отвечает, когда
 * тест попросит.
 */
type DetailRenderSpy = {
  /**
   * Зависимости детального растра для области просмотра.
   */
  deps: Partial<DetailRasterDeps>;

  /**
   * Задания, пришедшие воркеру, по порядку.
   */
  tasks: PageRenderTask[];

  /**
   * Сигналы отмены этих заданий.
   */
  signals: AbortSignal[];

  /**
   * Отвечает на последнее задание готовой страницей.
   */
  resolveLast: () => Promise<void>;
};

const createDetailRenderSpy = (): DetailRenderSpy => {
  const tasks: PageRenderTask[] = [];
  const signals: AbortSignal[] = [];
  const resolvers: ((page: Blob) => void)[] = [];

  return {
    tasks,
    signals,
    deps: {
      renderPage: (task, signal) => {
        tasks.push(task);
        signals.push(signal);

        return new Promise<Blob>((resolve) => {
          resolvers.push(resolve);
        });
      },
      createObjectUrl: () => {
        return `blob:detail-${String(tasks.length)}`;
      },
      revokeObjectUrl: () => {},
    },
    resolveLast: async () => {
      await act(async () => {
        resolvers.at(-1)?.(new Blob(['page']));
        await Promise.resolve();
      });
    },
  };
};

const DEBOUNCE_MS = 250;

const advance = (ms: number): void => {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
};

beforeEach(() => {
  clearLayoutCache();
  resizeCallbacks.clear();
  globalThis.ResizeObserver = ResizeObserverFake;
  setPixelRatio(1);
  useGeneratorStore.setState({
    ...DEFAULT_GENERATOR_STATE,
    text: 'раз два три',
    presetFamilies: [FAMILY],
    familyId: FAMILY.id,
    sheetId: FAMILY.sheets[0]?.id || '',
  });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  globalThis.ResizeObserver = ORIGINAL_RESIZE_OBSERVER;
  setPixelRatio(ORIGINAL_PIXEL_RATIO);
});

describe('масштаб области просмотра', () => {
  it('по умолчанию вписывает лист и подписывает масштаб в процентах кадра', () => {
    setPixelRatio(2);
    render(<Harness detailDeps={createDetailRenderSpy().deps} />);
    resizeViewport(VIEWPORT_WIDTH, VIEWPORT_HEIGHT);

    expect(useGeneratorStore.getState().zoom).toBe('fit');
    expect(getZoomLabel()).toBe(`50${NBSP}%`);
    /**
     * Основной растр — вписанный масштаб × DPR: 200 · 0,5 · 2.
     */
    expect(getPageCanvas().width).toBe(200);
    expect(getPageCanvas().height).toBe(400);
    expect(screen.getByTestId('page').style.width).toBe('100px');
  });

  it('при увеличении основной растр остаётся в min(zoom, fitZoom) × DPR, а лист растёт', async () => {
    const user = userEvent.setup();

    setPixelRatio(2);
    render(<Harness detailDeps={createDetailRenderSpy().deps} />);
    resizeViewport(VIEWPORT_WIDTH, VIEWPORT_HEIGHT);
    await user.click(screen.getByRole('button', { name: 'Увеличить' }));

    expect(useGeneratorStore.getState().zoom).toBeCloseTo(0.71, 5);
    expect(getZoomLabel()).toBe(`71${NBSP}%`);
    expect(getPageCanvas().width).toBe(200);
    expect(screen.getByTestId('page').style.width).toBe('142px');
  });

  it('при уменьшении основной растр идёт за масштабом', async () => {
    const user = userEvent.setup();

    setPixelRatio(2);
    render(<Harness detailDeps={createDetailRenderSpy().deps} />);
    resizeViewport(VIEWPORT_WIDTH, VIEWPORT_HEIGHT);
    await user.click(screen.getByRole('button', { name: 'Уменьшить' }));

    expect(getZoomLabel()).toBe(`35${NBSP}%`);
    /**
     * 200 · 0,35 · 2.
     */
    expect(getPageCanvas().width).toBe(140);
  });

  it('«Вписать» возвращает масштаб к вписыванию', async () => {
    const user = userEvent.setup();

    render(<Harness detailDeps={createDetailRenderSpy().deps} />);
    resizeViewport(VIEWPORT_WIDTH, VIEWPORT_HEIGHT);
    await user.click(screen.getByRole('button', { name: 'Увеличить' }));
    await user.click(screen.getByRole('button', { name: 'Увеличить' }));
    await user.click(screen.getByRole('button', { name: 'Вписать' }));

    expect(useGeneratorStore.getState().zoom).toBe('fit');
    expect(getZoomLabel()).toBe(`50${NBSP}%`);
  });

  it('вписывание следует за размером области', () => {
    render(<Harness detailDeps={createDetailRenderSpy().deps} />);
    resizeViewport(VIEWPORT_WIDTH, VIEWPORT_HEIGHT);
    resizeViewport(248, 448);

    expect(getZoomLabel()).toBe(`100${NBSP}%`);
  });

  it('Ctrl + колесо увеличивает масштаб, колесо без модификатора — нет', () => {
    render(<Harness detailDeps={createDetailRenderSpy().deps} />);
    resizeViewport(VIEWPORT_WIDTH, VIEWPORT_HEIGHT);

    const viewport = screen.getByRole('region', { name: 'Лист' });

    fireEvent.wheel(viewport, { deltaY: 100 });

    expect(useGeneratorStore.getState().zoom).toBe('fit');

    fireEvent.wheel(viewport, { deltaY: -100, ctrlKey: true });

    const { zoom } = useGeneratorStore.getState();

    expect(typeof zoom).toBe('number');
    expect(Number(zoom)).toBeGreaterThan(0.5);
  });
});

describe('детальный растр', () => {
  it('заказывается у воркера после остановки зума в масштабе min(zoom × DPR, 1)', () => {
    const spy = createDetailRenderSpy();

    vi.useFakeTimers();
    render(<Harness detailDeps={spy.deps} />);
    resizeViewport(VIEWPORT_WIDTH, VIEWPORT_HEIGHT);

    act(() => {
      useGeneratorStore.getState().setZoom(0.71);
    });
    advance(100);
    act(() => {
      useGeneratorStore.getState().setZoom(0.8);
    });
    advance(DEBOUNCE_MS - 1);

    expect(spy.tasks).toHaveLength(0);

    advance(1);

    expect(spy.tasks).toHaveLength(1);
    expect(spy.tasks[0]?.params.scale).toBeCloseTo(0.8, 10);

    act(() => {
      useGeneratorStore.getState().setZoom(3);
    });
    advance(DEBOUNCE_MS);

    expect(spy.tasks).toHaveLength(2);
    expect(spy.tasks[1]?.params.scale).toBe(1);
  });

  it('ложится поверх основного, когда воркер ответил', async () => {
    const spy = createDetailRenderSpy();

    vi.useFakeTimers();
    render(<Harness detailDeps={spy.deps} />);
    resizeViewport(VIEWPORT_WIDTH, VIEWPORT_HEIGHT);
    act(() => {
      useGeneratorStore.getState().setZoom(2);
    });
    advance(DEBOUNCE_MS);
    await spy.resolveLast();

    expect(screen.getByTestId('page-detail').getAttribute('src')).toBe('blob:detail-1');
  });

  it('новая правка отменяет заказ и снимает устаревший растр', async () => {
    const spy = createDetailRenderSpy();

    vi.useFakeTimers();
    render(<Harness detailDeps={spy.deps} />);
    resizeViewport(VIEWPORT_WIDTH, VIEWPORT_HEIGHT);
    act(() => {
      useGeneratorStore.getState().setZoom(0.8);
    });
    advance(DEBOUNCE_MS);
    await spy.resolveLast();
    act(() => {
      useGeneratorStore.getState().setZoom(2);
    });
    advance(DEBOUNCE_MS);

    expect(spy.signals[1]?.aborted).toBe(false);

    act(() => {
      useGeneratorStore.setState({ text: 'раз два три четыре' });
    });

    expect(spy.signals[1]?.aborted).toBe(true);
    expect(screen.queryByTestId('page-detail')).toBeNull();

    advance(DEBOUNCE_MS);

    expect(spy.tasks).toHaveLength(3);
  });

  it('не заказывается при «Вписать»', () => {
    const spy = createDetailRenderSpy();

    vi.useFakeTimers();
    render(<Harness detailDeps={spy.deps} />);
    resizeViewport(VIEWPORT_WIDTH, VIEWPORT_HEIGHT);
    act(() => {
      useGeneratorStore.getState().setZoom(2);
    });
    advance(100);
    fireEvent.click(screen.getByRole('button', { name: 'Вписать' }));
    advance(DEBOUNCE_MS * 2);

    expect(spy.tasks).toHaveLength(0);
  });

  it('не заказывается, когда основного растра хватает', () => {
    const spy = createDetailRenderSpy();

    vi.useFakeTimers();
    setPixelRatio(2);
    render(<Harness detailDeps={spy.deps} />);
    resizeViewport(248, 448);
    act(() => {
      useGeneratorStore.getState().setZoom(2);
    });
    advance(DEBOUNCE_MS * 2);

    expect(spy.tasks).toHaveLength(0);
  });
});
