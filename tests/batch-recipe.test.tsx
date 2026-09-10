/**
 * @vitest-environment jsdom
 */
import type { Page } from '@pages/Generator/lib/paginate/paginate.types';
import type {
  PageRenderTask,
  RunRenderPlan,
} from '@pages/Generator/model/pageTask.types';
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
import { buildRenderFamily } from './helpers/paper-family';

const FAMILY = buildRenderFamily();

const PAGE_COUNT = 4;

/**
 * Страницы прогона с разным текстом: одинаковый текст на всех страницах не дал
 * бы увидеть, что страницы вообще отличаются друг от друга.
 */
const PAGES: Page[] = Array.from({ length: PAGE_COUNT }, (_page, index) => {
  return { lines: [{ text: `строка ${index}`, paragraphIndex: 0 }] };
});

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
 * Что нарисовалось: лента вызовов страницы и лента вызовов отражения.
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
            placement: task.sheet.placement,
          }
        : null,
      textureSrc: task.textureSrc,
      font: task.font,
      pageWidth: task.pageWidth,
      pageHeight: task.pageHeight,
      quality: task.quality,
    },
    recorder.surfaces
  );

  return {
    page: describeCalls(recorder.pageCalls),
    mirror: describeCalls(recorder.mirrorCalls),
  };
};

/**
 * План отрисовки прогона по текущему состоянию стора.
 */
const buildPlan = (): RunRenderPlan => {
  const { result, unmount } = renderHook(() => {
    return useRunRender(PAGES);
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

describe('пачка отражает рецепт прогона', () => {
  it('раздаёт страницам разные экземпляры листа', () => {
    const plan = buildPlan();
    const sources = Array.from({ length: plan.pageCount }, (_page, pageIndex) => {
      return plan.buildTask(pageIndex).sheet?.src || '';
    });

    expect(new Set(sources).size).toBeGreaterThan(1);

    sources.forEach((src, pageIndex) => {
      if (pageIndex > 0) {
        expect(src).not.toBe(sources[pageIndex - 1]);
      }
    });
  });

  it('уважает выбранный вручную экземпляр на всех страницах', () => {
    const pinned = FAMILY.sheets[1];

    if (!pinned) {
      throw new Error('Семья-модель без второго экземпляра, закреплять нечего');
    }

    useGeneratorStore.getState().selectSheet(pinned.id);

    const plan = buildPlan();
    const sources = Array.from({ length: plan.pageCount }, (_page, pageIndex) => {
      return plan.buildTask(pageIndex).sheet?.src || '';
    });

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

  it('рисует соседние страницы прогона по-разному', async () => {
    const plan = buildPlan();
    const first = await renderRibbon(plan.buildTask(0));
    const second = await renderRibbon(plan.buildTask(1));

    expect(second).not.toEqual(first);
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
