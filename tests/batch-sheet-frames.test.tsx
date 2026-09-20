/**
 * @vitest-environment jsdom
 */
import v8 from 'node:v8';
import vm from 'node:vm';

import type { BatchPacker } from '@pages/Generator/lib/batch';
import { createZipPacker, generatePageBatch } from '@pages/Generator/lib/batch';
import type { LayoutPage } from '@pages/Generator/lib/paginate/paginate.types';
import type { PaperFamily } from '@pages/Generator/lib/paper';
import type {
  PageBlobSurface,
  PageRenderSurfaces,
  PageRenderTask,
  RunRenderPlan,
} from '@pages/Generator/model/pageTask.types';
import { findSheet } from '@pages/Generator/model/paperSelectors';
import { buildPageSheetSequence } from '@pages/Generator/model/recipeSelectors';
import { renderPageRequest } from '@pages/Generator/model/renderPageRequest';
import {
  DEFAULT_GENERATOR_STATE,
  useGeneratorStore,
} from '@pages/Generator/model/useGeneratorStore';
import { useRunRender } from '@pages/Generator/model/useRunRender';
import { cleanup, renderHook } from '@testing-library/react';
import JSZip from 'jszip';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createRenderSurfacesRecorder } from './helpers/blob-surface-recorder';
import { buildRenderFamily, buildSheet } from './helpers/paper-family';

/**
 * Кадр второго листа: и ширина, и пропорции отличаются от первого.
 */
const OTHER_FRAME = { width: 300, height: 360 };

const PAGE_COUNT = 6;

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

/**
 * Битмап-пустышка вместо фотографии листа: настоящего декодирования в jsdom
 * нет, а отрисовке важно только то, что фотография есть.
 */
const BITMAP: ImageBitmap = { width: 1, height: 1, close: () => {} };

/**
 * Страницы раскладки на листах раздачи прогона.
 *
 * @returns страницы с разным текстом и листом каждой
 */
const buildPages = (): LayoutPage[] => {
  const sheetIdAt = buildPageSheetSequence(useGeneratorStore.getState(), FAMILY);

  return Array.from({ length: PAGE_COUNT }, (_page, index) => {
    return {
      sheetId: sheetIdAt(index),
      lines: [{ text: `строка ${index}`, paragraphIndex: 0 }],
    };
  });
};

/**
 * План отрисовки прогона по текущему состоянию стора.
 *
 * @param pages — страницы раскладки
 * @returns план отрисовки
 */
const buildPlan = (pages: LayoutPage[]): RunRenderPlan => {
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
 * Поверхности, у которых файл страницы несёт размер созданной канвы: так размер
 * снимка читается прямо из архива, а не из чисел плана.
 *
 * @param onSurface — куда отдать поверхность ровно в том виде, в каком её
 *   получает отрисовка: удержи отрисовка поверхность, удержится именно этот
 *   объект
 * @returns поверхности отрисовки
 */
const createSizedSurfaces = (
  onSurface?: (surface: PageBlobSurface) => void
): PageRenderSurfaces => {
  const recorder = createRenderSurfacesRecorder(document.createElement('canvas'));

  return {
    ...recorder.surfaces,
    createPage: (width, height) => {
      const surface: PageBlobSurface = {
        ...recorder.surfaces.createPage(width, height),
        convertToBlob: (options) => {
          return Promise.resolve(
            new Blob([`${width}x${height}`], { type: options.type })
          );
        },
      };

      onSurface?.(surface);

      return surface;
    },
  };
};

/**
 * Отрисовывает задание в пути воркера.
 *
 * @param task — задание на страницу
 * @param surfaces — чем создавать поверхности
 * @returns файл страницы
 */
const renderTask = (
  task: PageRenderTask,
  surfaces: PageRenderSurfaces
): Promise<Blob> => {
  return renderPageRequest(
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
};

/**
 * Сколько из отслеживаемых поверхностей пережило сборку мусора.
 *
 * @param refs — слабые ссылки на созданные поверхности
 * @returns число живых поверхностей
 */
const countAlive = async (refs: WeakRef<object>[]): Promise<number> => {
  v8.setFlagsFromString('--expose-gc');

  const runGarbageCollection: () => void = vm.runInNewContext('gc');

  v8.setFlagsFromString('--no-expose-gc');

  for (let attempt = 0; attempt < 5; attempt += 1) {
    runGarbageCollection();

    await new Promise((resolve) => {
      setTimeout(resolve, 0);
    });
  }

  return refs.reduce((alive, ref) => {
    return ref.deref() ? alive + 1 : alive;
  }, 0);
};

beforeEach(() => {
  useGeneratorStore.setState({
    ...DEFAULT_GENERATOR_STATE,
    presetFamilies: [FAMILY],
    familyId: FAMILY.id,
    sheetId: FAMILY.sheets[0]?.id || '',
    customFontFamily: 'UserFont',
  });
});

afterEach(() => {
  cleanup();
});

describe('пачка на листах с разными кадрами', () => {
  it('кладёт в архив каждую страницу размером кадра её листа по порядку', async () => {
    const pages = buildPages();
    const plan = buildPlan(pages);
    const surfaces = createSizedSurfaces();
    const report = await generatePageBatch({
      pageCount: plan.pageCount,
      renderPage: (pageIndex) => {
        return renderTask(plan.buildTask(pageIndex), surfaces);
      },
      packer: createZipPacker({ totalPages: plan.pageCount }),
    });

    if (!report.archive) {
      throw new Error('Архив не собрался');
    }

    const zip = await JSZip.loadAsync(await report.archive.arrayBuffer());
    const names = Object.keys(zip.files);
    const sizes = await Promise.all(
      names.map((name) => {
        return zip.files[name]?.async('string');
      })
    );
    const frames = pages.map(({ sheetId }) => {
      const sheet = findSheet(FAMILY, sheetId);

      return `${sheet?.width}x${sheet?.height}`;
    });

    expect(report.failedPageNumbers).toEqual([]);
    expect(names).toEqual([
      'page-001.jpg',
      'page-002.jpg',
      'page-003.jpg',
      'page-004.jpg',
      'page-005.jpg',
      'page-006.jpg',
    ]);
    expect(sizes).toEqual(frames);
    expect(new Set(frames).size).toBeGreaterThan(1);
  });

  it('не держит поверхности страниц после того, как их принял упаковщик', async () => {
    const plan = buildPlan(buildPages());
    const refs: WeakRef<object>[] = [];
    const surfaces = createSizedSurfaces((surface) => {
      refs.push(new WeakRef(surface));
    });
    /**
     * Упаковщик страницу не запоминает: всё, что переживёт сборку мусора,
     * удержала сама отрисовка или оркестратор.
     */
    const packer: BatchPacker = {
      addPage: async () => {},
      build: async () => {
        return new Blob([], { type: 'application/zip' });
      },
    };

    await generatePageBatch({
      pageCount: plan.pageCount,
      renderPage: (pageIndex) => {
        return renderTask(plan.buildTask(pageIndex), surfaces);
      },
      packer,
    });

    expect(refs).toHaveLength(PAGE_COUNT);
    expect(await countAlive(refs)).toBe(0);
  });
});
