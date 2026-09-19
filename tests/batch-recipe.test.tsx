/**
 * @vitest-environment jsdom
 */
import type { LayoutPage } from '@pages/Generator/lib/paginate/paginate.types';
import type { PaperFamily } from '@pages/Generator/lib/paper';
import type { PageRenderSurfaces } from '@pages/Generator/model/pageTask.types';
import type {
  PageRenderTask,
  RunRenderPlan,
} from '@pages/Generator/model/pageTask.types';
import { findSheet } from '@pages/Generator/model/paperSelectors';
import {
  buildPageSheetSequence,
  selectRunRecipe,
} from '@pages/Generator/model/recipeSelectors';
import { renderPageRequest } from '@pages/Generator/model/renderPageRequest';
import {
  DEFAULT_GENERATOR_STATE,
  useGeneratorStore,
} from '@pages/Generator/model/useGeneratorStore';
import { useRunRender } from '@pages/Generator/model/useRunRender';
import { cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  createRenderSurfacesRecorder,
  describeCalls,
} from './helpers/blob-surface-recorder';
import type { SurfaceSize } from './helpers/canvas-recorder';
import { buildRenderFamily, buildSheet } from './helpers/paper-family';

/**
 * Кадр второго листа: и ширина, и пропорции отличаются от первого.
 */
const OTHER_FRAME = { width: 300, height: 360 };

/**
 * Семья-модель, у листов которой разные кадры при одной разлиновке.
 *
 * @returns семья из двух листов с разными кадрами
 */
const buildFramedFamily = (): PaperFamily => {
  const family = buildRenderFamily();

  return {
    ...family,
    sheets: family.sheets.map((sheet, index) => {
      return index === 0 ? sheet : buildSheet(sheet.id, sheet.ruling, OTHER_FRAME);
    }),
  };
};

const FAMILY = buildFramedFamily();

const PAGE_COUNT = 4;

/**
 * Страницы прогона с разным текстом на листах раздачи: одинаковый текст на всех
 * страницах не дал бы увидеть, что страницы вообще отличаются друг от друга.
 *
 * @param getSheetId — лист страницы по её номеру
 * @returns страницы раскладки
 */
const buildPages = (getSheetId: (pageIndex: number) => string): LayoutPage[] => {
  return Array.from({ length: PAGE_COUNT }, (_page, index) => {
    return {
      sheetId: getSheetId(index),
      lines: [{ text: `строка ${index}`, paragraphIndex: 0 }],
    };
  });
};

/**
 * Страницы на листах раздачи прогона по текущему состоянию стора — так их
 * отдаёт раскладка.
 *
 * @returns страницы раскладки
 */
const buildSequencePages = (): LayoutPage[] => {
  return buildPages(buildPageSheetSequence(useGeneratorStore.getState(), FAMILY));
};

/**
 * Битмап-пустышка вместо фотографии листа: настоящего декодирования в jsdom
 * нет, а отрисовке важно только то, что фотография есть.
 */
const BITMAP: ImageBitmap = {
  width: FAMILY.sheets[0]?.width || 0,
  height: FAMILY.sheets[0]?.height || 0,
  close: () => {},
};

/**
 * Что нарисовалось: лента вызовов страницы, лента вызовов отражения и размер
 * созданной под страницу канвы.
 */
type PageRibbon = {
  /**
   * Вызовы контекста страницы.
   */
  page: string[];

  /**
   * Вызовы контекста отражения фотографии.
   */
  mirror: string[];

  /**
   * Размеры канв, созданных под страницу.
   */
  sizes: SurfaceSize[];
};

/**
 * Отрисовывает задание записывателем и отдаёт состав отрисованного.
 *
 * Сравнивать снимки попиксельно в jsdom нечем — растра там нет. Лента вызовов
 * контекста ловит ту же регрессию: любое расхождение в координатах, цвете,
 * порядке слов или в отражении фотографии меняет её, а совпадение ленты при
 * одном и том же рендерере означает совпадение растра.
 */
const renderRibbon = async (task: PageRenderTask): Promise<PageRibbon> => {
  const recorder = createRenderSurfacesRecorder(document.createElement('canvas'));
  const sizes: SurfaceSize[] = [];
  const surfaces: PageRenderSurfaces = {
    ...recorder.surfaces,
    createPage: (width, height) => {
      sizes.push({ width, height });

      return recorder.surfaces.createPage(width, height);
    },
  };

  await renderPageRequest(
    {
      requestId: 1,
      params: task.params,
      sheet: task.sheet
        ? {
            image: BITMAP,
            width: task.sheet.width,
            height: task.sheet.height,
            isMirrored: task.sheet.isMirrored,
          }
        : null,
      textureSrc: task.textureSrc,
      font: task.font,
      pageWidth: task.pageWidth,
      pageHeight: task.pageHeight,
      quality: task.quality,
    },
    surfaces
  );

  return {
    page: describeCalls(recorder.pageCalls),
    mirror: describeCalls(recorder.mirrorCalls),
    sizes,
  };
};

/**
 * План отрисовки прогона по текущему состоянию стора.
 */
const buildPlan = (pages: LayoutPage[] = buildSequencePages()): RunRenderPlan => {
  const { result, unmount } = renderHook(() => {
    return useRunRender(pages);
  });
  const plan = result.current;

  unmount();

  if (!plan) {
    throw new Error('Семья листов не выбрана, плана нет');
  }

  return plan;
};

/**
 * Состав отрисованного по всем страницам прогона.
 */
const renderRun = async (): Promise<PageRibbon[]> => {
  const plan = buildPlan();
  const ribbons: PageRibbon[] = [];

  for (let pageIndex = 0; pageIndex < plan.pageCount; pageIndex += 1) {
    ribbons.push(await renderRibbon(plan.buildTask(pageIndex)));
  }

  return ribbons;
};

/**
 * Адреса фотографий, на которых план рисует страницы прогона.
 */
const collectSources = (plan: RunRenderPlan): string[] => {
  return Array.from({ length: plan.pageCount }, (_page, pageIndex) => {
    return plan.buildTask(pageIndex).sheet?.src || '';
  });
};

beforeEach(() => {
  useGeneratorStore.setState({
    ...DEFAULT_GENERATOR_STATE,
    presetFamilies: [FAMILY],
    familyId: FAMILY.id,
    sheetId: FAMILY.sheets[0]?.id || '',
    /**
     * Свой шрифт: контуры для него не читаются, и отрисовка не полезет за
     * файлом `.ttf`, которого в jsdom взяться неоткуда.
     */
    customFontFamily: 'UserFont',
  });
});

afterEach(() => {
  cleanup();
});

describe('пачка отражает раскладку прогона', () => {
  it('рисует каждую страницу на листе, на котором она разложена', () => {
    const sheetIdAt = buildPageSheetSequence(useGeneratorStore.getState(), FAMILY);
    /**
     * Листы раскладки намеренно расходятся с раздачей: совпади они, план,
     * пересчитывающий раздачу сам, прошёл бы проверку.
     */
    const pages = buildPages((pageIndex) => {
      return (
        FAMILY.sheets.find(({ id }) => {
          return id !== sheetIdAt(pageIndex);
        })?.id || ''
      );
    });
    const expected = pages.map(({ sheetId }) => {
      return findSheet(FAMILY, sheetId)?.src || '';
    });

    expect(collectSources(buildPlan(pages))).toEqual(expected);
  });

  it('раздаёт страницам разные экземпляры листа', () => {
    const sources = collectSources(buildPlan());

    expect(new Set(sources).size).toBeGreaterThan(1);

    sources.forEach((src, pageIndex) => {
      if (pageIndex > 0) {
        expect(src).not.toBe(sources[pageIndex - 1]);
      }
    });
  });

  it('уважает выбранный вручную экземпляр, пока у страниц нет листа раскладки', () => {
    const pinned = FAMILY.sheets[1];

    if (!pinned) {
      throw new Error('Семья-модель без второго экземпляра, закреплять нечего');
    }

    useGeneratorStore.getState().selectSheet(pinned.id);

    const sources = collectSources(
      buildPlan(
        buildPages(() => {
          return '';
        })
      )
    );

    expect(new Set(sources)).toEqual(new Set([pinned.src]));
  });

  it('отражает чётные по нумерации страницы и не трогает нечётные', async () => {
    const plan = buildPlan();

    expect(plan.buildTask(0).sheet?.isMirrored).toBe(false);
    expect(plan.buildTask(1).sheet?.isMirrored).toBe(true);

    const odd = await renderRibbon(plan.buildTask(0));
    const even = await renderRibbon(plan.buildTask(1));

    expect(odd.mirror).toHaveLength(0);
    expect(even.mirror).toContain('scale(-1, 1)');
  });

  it('повторяет прогон на том же seed слово в слово', async () => {
    const first = await renderRun();
    const second = await renderRun();

    expect(second).toEqual(first);
  });

  it('красит страницы пачки цветом и почерком рецепта прогона', () => {
    const before = buildPlan().buildTask(0).params;
    const recipe = selectRunRecipe(useGeneratorStore.getState(), buildPlan().pageCount);

    expect(before.inkColor).toBe(recipe?.inkColor);

    useGeneratorStore.getState().setText('совсем другой текст');

    expect(buildPlan().buildTask(0).params).toEqual(before);

    useGeneratorStore.getState().startNewRun();

    expect(buildPlan().buildTask(0).params.inkColor).not.toBe(before.inkColor);
  });

  it('на ступени «Ровно» рисует страницу одинаково при любом прогоне', async () => {
    /**
     * Лист и чернила закреплены: иначе новый прогон менял бы их, и лента
     * разошлась бы не из-за почерка.
     */
    useGeneratorStore.setState({ isSheetPinned: true });
    useGeneratorStore.getState().setInk({ kind: 'custom', color: '#123456' });

    const ribbonsOf = async (): Promise<[PageRibbon, PageRibbon]> => {
      const before = await renderRibbon(buildPlan().buildTask(0));

      useGeneratorStore.getState().startNewRun();

      return [before, await renderRibbon(buildPlan().buildTask(0))];
    };

    useGeneratorStore.getState().selectRealismLevel('normal');

    const [normalBefore, normalAfter] = await ribbonsOf();

    expect(normalAfter).not.toEqual(normalBefore);

    useGeneratorStore.getState().selectRealismLevel('even');

    const [evenBefore, evenAfter] = await ribbonsOf();

    expect(evenAfter).toEqual(evenBefore);
  });

  it('рисует соседние страницы прогона по-разному', async () => {
    const plan = buildPlan();
    const first = await renderRibbon(plan.buildTask(0));
    const second = await renderRibbon(plan.buildTask(1));

    expect(second).not.toEqual(first);
  });
});

describe('снимок в кадре листа', () => {
  it('создаёт канву страницы размером кадра её листа', async () => {
    const pages = buildSequencePages();
    const plan = buildPlan(pages);
    const frames = pages.map(({ sheetId }) => {
      const sheet = findSheet(FAMILY, sheetId);

      return { width: sheet?.width || 0, height: sheet?.height || 0 };
    });
    const sizes: SurfaceSize[] = [];

    for (let pageIndex = 0; pageIndex < plan.pageCount; pageIndex += 1) {
      sizes.push(...(await renderRibbon(plan.buildTask(pageIndex))).sizes);
    }

    expect(sizes).toEqual(frames);
    expect(
      new Set(
        sizes.map(({ height }) => {
          return height;
        })
      ).size
    ).toBeGreaterThan(1);
  });

  it('не меняет размер снимка, когда фон скрыт', async () => {
    const pages = buildSequencePages();
    const shown = await renderRibbon(buildPlan(pages).buildTask(1));

    useGeneratorStore.getState().setBackgroundHidden(true);

    const hiddenTask = buildPlan(pages).buildTask(1);
    const hidden = await renderRibbon(hiddenTask);

    expect(hiddenTask.sheet).toBeNull();
    expect(hidden.sizes).toEqual(shown.sizes);
  });

  it('кладёт фотографию во всю страницу без подложки под ней', async () => {
    const pages = buildSequencePages();
    const plan = buildPlan(pages);

    for (let pageIndex = 0; pageIndex < plan.pageCount; pageIndex += 1) {
      const { page, sizes } = await renderRibbon(plan.buildTask(pageIndex));
      const [size] = sizes;
      const images = page.filter((call) => {
        return call.startsWith('drawImage(');
      });

      expect(images).toEqual([
        `drawImage(изображение, 0, 0, ${size?.width}, ${size?.height})`,
      ]);
      expect(
        page.some((call) => {
          return call.startsWith('fillRect(');
        })
      ).toBe(false);
    }
  });

  it('закрашивает страницу без фона во весь кадр', async () => {
    useGeneratorStore.getState().setBackgroundHidden(true);

    const { page, sizes } = await renderRibbon(buildPlan().buildTask(0));
    const [size] = sizes;

    expect(page).toContain(`fillRect(0, 0, ${size?.width}, ${size?.height})`);
    expect(
      page.some((call) => {
        return call.startsWith('drawImage(');
      })
    ).toBe(false);
  });
});

describe('отрисовка без своих источников случайности', () => {
  it('рисует одну и ту же страницу дважды одинаково', async () => {
    const plan = buildPlan();
    const first = await renderRibbon(plan.buildTask(0));
    const second = await renderRibbon(plan.buildTask(0));

    expect(second).toEqual(first);
    expect(first.page.length).toBeGreaterThan(0);
  });
});
