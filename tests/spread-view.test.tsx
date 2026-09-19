/**
 * @vitest-environment jsdom
 */
import { resolveShownPageIndex } from '@pages/Generator/model/buildPageRenderParams';
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
import {
  getPartnerIndex,
  SheetViewport,
} from '@pages/Generator/ui/Generator/SheetViewport';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { FC } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { RecordedCall } from './helpers/canvas-recorder';
import { findCalls, getCanvasFrame } from './helpers/canvas-recorder';
import { createMonospaceMeasurerFactory } from './helpers/monospace-measurer';
import { buildRenderFamily, RENDER_SHEET_RULING } from './helpers/paper-family';

const FAMILY = buildRenderFamily();

/**
 * Запас снизу, оставляющий на листе семьи-модели (200 × 400) две строки: по
 * два коротких слова в строке — четыре слова на страницу.
 */
const TWO_LINE_BOTTOM_MARGIN = 7;

const WORDS_PER_PAGE = 4;

const DEBOUNCE_MS = 250;

/**
 * Область, в которую и один лист, и пара вписываются в масштабе 1: за
 * вычетом отступов по 24 пикселя остаётся 400 × 400. Так растры страницы
 * по одной и в развороте сравнимы вызов в вызов.
 */
const SAME_FIT_VIEWPORT = { width: 448, height: 448 };

/**
 * Область, где один лист вписывается в масштабе 1, а пара — в 0,5: остаётся
 * 200 × 400.
 */
const NARROW_VIEWPORT = { width: 248, height: 448 };

type ViewportBox = {
  /**
   * Ширина области в CSS-пикселях.
   */
  width: number;

  /**
   * Высота области в CSS-пикселях.
   */
  height: number;
};

type HarnessProps = {
  /**
   * Чем рисовать детальный растр; воркера в jsdom нет.
   */
  detailDeps?: Partial<DetailRasterDeps>;
};

/**
 * Сборка экрана вокруг области просмотра: источник текущей страницы и второй
 * страницы разворота — из стора, номер сохраняемой страницы — из плана.
 */
const Harness: FC<HarnessProps> = (props) => {
  const { detailDeps } = props;
  const pages = usePageLayout(createMonospaceMeasurerFactory({ charWidth: 0.2 }).create);
  const pageIndex = useGeneratorStore((state) => {
    return state.pageIndex;
  });
  const source = usePageRender(pages);
  const partnerSource = usePageRender(
    pages,
    getPartnerIndex(resolveShownPageIndex(pageIndex, pages.length))
  );
  const plan = useRunRender(pages);

  return (
    <>
      <output data-testid="saved-page">{plan?.pageIndex}</output>

      <SheetViewport
        source={source}
        partnerSource={partnerSource}
        plan={plan}
        {...(detailDeps && { detailDeps })}
      />
    </>
  );
};

const buildText = (pageCount: number): string => {
  return Array.from({ length: pageCount * WORDS_PER_PAGE }, () => {
    return 'раз';
  }).join(' ');
};

/**
 * Даёт всем узлам размер области: jsdom layout не считает, а область меряет
 * себя при монтировании.
 */
const setViewportSize = (size: ViewportBox): void => {
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
    configurable: true,
    value: size.width,
  });
  Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
    configurable: true,
    value: size.height,
  });
};

const getCanvases = (): HTMLCanvasElement[] => {
  return screen.getAllByTestId('page-canvas').reduce<HTMLCanvasElement[]>((acc, node) => {
    if (node instanceof HTMLCanvasElement) {
      acc.push(node);
    }

    return acc;
  }, []);
};

const getCanvasOf = (pageName: string): HTMLCanvasElement => {
  const canvas = screen
    .getByRole('button', { name: pageName })
    .querySelector('[data-testid="page-canvas"]');

  if (!(canvas instanceof HTMLCanvasElement)) {
    throw new Error(`У «${pageName}» нет холста`);
  }

  return canvas;
};

/**
 * Отступ блока текста от левого края листа — первый сдвиг начала координат.
 */
const getBlockLeftPadding = (canvas: HTMLCanvasElement): unknown => {
  const [translate] = findCalls(getCanvasFrame(canvas), 'translate');

  return translate?.[0];
};

const renderWithPages = async (
  pageCount: number,
  detailDeps?: Partial<DetailRasterDeps>
): Promise<void> => {
  useGeneratorStore.setState({ text: buildText(pageCount), isSpread: true });
  render(<Harness {...(detailDeps && { detailDeps })} />);

  await waitFor(() => {
    expect(screen.getByTestId('page-count').textContent).toBe(`/ ${String(pageCount)}`);
  });
};

const ORIGINAL_PIXEL_RATIO = window.devicePixelRatio;

beforeEach(() => {
  clearLayoutCache();
  Object.defineProperty(window, 'devicePixelRatio', { configurable: true, value: 1 });
  setViewportSize(SAME_FIT_VIEWPORT);
  useGeneratorStore.setState({
    ...DEFAULT_GENERATOR_STATE,
    presetFamilies: [FAMILY],
    familyId: FAMILY.id,
    sheetId: FAMILY.sheets[0]?.id || '',
    bottomMargin: TWO_LINE_BOTTOM_MARGIN,
  });
  useGeneratorStore.getState().selectRealismLevel('even');
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  Reflect.deleteProperty(HTMLElement.prototype, 'clientWidth');
  Reflect.deleteProperty(HTMLElement.prototype, 'clientHeight');
  Object.defineProperty(window, 'devicePixelRatio', {
    configurable: true,
    value: ORIGINAL_PIXEL_RATIO,
  });
});

describe('разворот', () => {
  it('на первом развороте из четырёх показывает страницы 1 и 2, вторая зеркальна', async () => {
    await renderWithPages(4);

    expect(
      screen.getAllByRole('button', { name: /^Страница \d$/ }).map((node) => {
        return node.getAttribute('aria-label');
      })
    ).toEqual(['Страница 1', 'Страница 2']);

    await waitFor(() => {
      expect(getBlockLeftPadding(getCanvasOf('Страница 2'))).toBeCloseTo(
        RENDER_SHEET_RULING.margins.right
      );
    });

    expect(getBlockLeftPadding(getCanvasOf('Страница 1'))).toBeCloseTo(
      RENDER_SHEET_RULING.margins.left
    );
  });

  it('чётная страница в развороте нарисована так же, как по одной', async () => {
    await renderWithPages(4);

    let spreadFrame: RecordedCall[] = [];

    await waitFor(() => {
      spreadFrame = getCanvasFrame(getCanvasOf('Страница 2'));
      expect(findCalls(spreadFrame, 'fillText').length).toBeGreaterThan(0);
    });

    act(() => {
      useGeneratorStore.setState({ isSpread: false });
      useGeneratorStore.getState().goToPage(1);
    });

    await waitFor(() => {
      const [canvas] = getCanvases();

      expect(canvas && getCanvasFrame(canvas)).toEqual(spreadFrame);
    });
  });

  it('непарная последняя страница стоит одна на левой половине', async () => {
    await renderWithPages(3);

    act(() => {
      useGeneratorStore.getState().goToPage(2);
    });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Страница 3' })).toBeTruthy();
    });

    expect(getCanvases()).toHaveLength(1);

    const blank = screen.getByTestId('spread-blank');
    const page = screen.getByRole('button', { name: 'Страница 3' });

    expect(page.nextElementSibling).toBe(blank);
    expect(blank.style.width).toBe(screen.getByTestId('page').style.width);
  });

  it('«Вписать» вписывает пару, а не одну страницу', async () => {
    setViewportSize(NARROW_VIEWPORT);
    await renderWithPages(4);

    expect(
      screen.getAllByTestId('page').map((node) => {
        return node.style.width;
      })
    ).toEqual(['100px', '100px']);

    act(() => {
      useGeneratorStore.setState({ isSpread: false });
    });

    expect(screen.getByTestId('page').style.width).toBe('200px');
  });

  it('клик по странице делает её текущей — её и сохраняет «Сохранить страницу»', async () => {
    const user = userEvent.setup();

    await renderWithPages(4);

    expect(
      screen.getByRole('button', { name: 'Страница 1' }).getAttribute('aria-pressed')
    ).toBe('true');

    await user.click(screen.getByRole('button', { name: 'Страница 2' }));

    expect(useGeneratorStore.getState().pageIndex).toBe(1);
    expect(screen.getByTestId('saved-page').textContent).toBe('1');
    expect(
      screen.getByRole('button', { name: 'Страница 2' }).getAttribute('aria-pressed')
    ).toBe('true');
    expect(
      screen.getByRole('button', { name: 'Страница 1' }).getAttribute('aria-pressed')
    ).toBe('false');
  });

  it('детальный растр заказывается для обеих страниц пары', async () => {
    const tasks: PageRenderTask[] = [];

    setViewportSize(NARROW_VIEWPORT);
    await renderWithPages(4, {
      renderPage: (task) => {
        tasks.push(task);

        return new Promise<Blob>(() => {});
      },
    });
    vi.useFakeTimers();

    act(() => {
      useGeneratorStore.getState().setZoom(1);
    });
    act(() => {
      vi.advanceTimersByTime(DEBOUNCE_MS);
    });

    expect(
      tasks
        .map((task) => {
          return task.sheet?.isMirrored;
        })
        .sort()
    ).toEqual([false, true]);
  });
});
