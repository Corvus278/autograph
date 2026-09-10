import v8 from 'node:v8';
import vm from 'node:vm';

import type { BatchPacker, BatchProgress } from '@pages/Generator/lib/batch';
import { generatePageBatch } from '@pages/Generator/lib/batch';
import { describe, expect, it } from 'vitest';

const PAGE_MIME_TYPE = 'image/jpeg';

const ARCHIVE_MIME_TYPE = 'application/zip';

/**
 * Размер страницы-заглушки в байтах. Мелкие блобы сборщик мусора может и не
 * тронуть, а на десятке килобайт разница уже видна.
 */
const PAGE_SIZE = 10_000;

/**
 * Страница-заглушка: содержимое — её собственный номер, по нему видно, какая
 * страница дошла до упаковщика.
 */
const buildPage = (pageIndex: number): Blob => {
  return new Blob([`page-${pageIndex}`], { type: PAGE_MIME_TYPE });
};

/**
 * Упаковщик-протокол: вместо архива пишет в общий журнал, что и когда принял.
 * По журналу видно, не начала ли следующая страница отрисовываться раньше,
 * чем упакована предыдущая.
 */
const createRecordingPacker = (events: string[]): BatchPacker => {
  return {
    addPage: async (pageIndex, page) => {
      const text = await page.text();

      events.push(`pack:${pageIndex}:${text}`);
    },

    build: async () => {
      events.push('build');

      return new Blob(['archive'], { type: ARCHIVE_MIME_TYPE });
    },
  };
};

/**
 * Упаковщик, который ничего не запоминает: нужен там, где проверяется сам
 * оркестратор, а не архив.
 */
const createSilentPacker = (): BatchPacker => {
  return {
    addPage: async () => {
      return undefined;
    },

    build: async () => {
      return new Blob(['archive'], { type: ARCHIVE_MIME_TYPE });
    },
  };
};

/**
 * Отрисовка-протокол: отмечает начало и конец каждой страницы и уступает
 * очередь между ними, чтобы последовательность было чем нарушить.
 */
const createRecordingRenderPage = (
  events: string[],
  onPage?: (pageIndex: number) => void
) => {
  return async (pageIndex: number): Promise<Blob> => {
    events.push(`render:start:${pageIndex}`);
    await Promise.resolve();
    onPage?.(pageIndex);
    events.push(`render:end:${pageIndex}`);

    return buildPage(pageIndex);
  };
};

/**
 * Ожидаемый журнал одной успешной страницы.
 */
const toPageEvents = (pageIndex: number): string[] => {
  return [
    `render:start:${pageIndex}`,
    `render:end:${pageIndex}`,
    `pack:${pageIndex}:page-${pageIndex}`,
  ];
};

/**
 * Считает, сколько страниц пережило сборку мусора. Сборка включается на месте,
 * чтобы прогон тестов не требовал особых ключей запуска node.
 */
const countAlivePages = async (pageRefs: WeakRef<Blob>[]): Promise<number> => {
  v8.setFlagsFromString('--expose-gc');

  const runGarbageCollection: () => void = vm.runInNewContext('gc');

  v8.setFlagsFromString('--no-expose-gc');

  for (let attempt = 0; attempt < 5; attempt += 1) {
    runGarbageCollection();
    await new Promise((resolve) => {
      setTimeout(resolve, 0);
    });
  }

  return pageRefs.filter((pageRef) => {
    return pageRef.deref() !== undefined;
  }).length;
};

describe('generatePageBatch', () => {
  it('проходит пачку из двадцати страниц строго по одной', async () => {
    const events: string[] = [];
    const report = await generatePageBatch({
      pageCount: 20,
      renderPage: createRecordingRenderPage(events),
      packer: createRecordingPacker(events),
    });
    const expectedEvents = Array.from({ length: 20 }, (_value, pageIndex) => {
      return toPageEvents(pageIndex);
    }).flat();

    expect(events).toEqual([...expectedEvents, 'build']);
    expect(report.packedCount).toBe(20);
    expect(report.failedPageIndexes).toEqual([]);
    expect(report.failedPageNumbers).toEqual([]);
    expect(report.isCanceled).toBe(false);
    expect(report.hasBuildError).toBe(false);
    expect(report.archive).toBeInstanceOf(Blob);
  });

  it('отрисовывает каждую страницу ровно один раз', async () => {
    const renderedPages: number[] = [];
    const events: string[] = [];

    await generatePageBatch({
      pageCount: 20,
      renderPage: createRecordingRenderPage(events, (pageIndex) => {
        renderedPages.push(pageIndex);
      }),
      packer: createRecordingPacker(events),
    });

    expect(renderedPages).toEqual(
      Array.from({ length: 20 }, (_value, pageIndex) => {
        return pageIndex;
      })
    );
  });

  it('не держит ссылок на страницы после того, как их принял упаковщик', async () => {
    const pageRefs: WeakRef<Blob>[] = [];

    await generatePageBatch({
      pageCount: 20,
      renderPage: async (): Promise<Blob> => {
        const page = new Blob(['x'.repeat(PAGE_SIZE)], { type: PAGE_MIME_TYPE });

        pageRefs.push(new WeakRef(page));

        return page;
      },
      /**
       * Упаковщик страницу не запоминает: всё, что переживёт сборку мусора,
       * удержал сам оркестратор.
       */
      packer: createSilentPacker(),
    });

    expect(pageRefs).toHaveLength(20);
    expect(await countAlivePages(pageRefs)).toBe(0);
  });

  it('передаёт сигнал отмены в отрисовку страницы', async () => {
    const controller = new AbortController();
    const receivedSignals: (AbortSignal | undefined)[] = [];

    await generatePageBatch({
      pageCount: 3,
      renderPage: async (pageIndex: number, signal?: AbortSignal): Promise<Blob> => {
        receivedSignals.push(signal);

        return buildPage(pageIndex);
      },
      packer: createSilentPacker(),
      signal: controller.signal,
    });

    expect(receivedSignals).toEqual([
      controller.signal,
      controller.signal,
      controller.signal,
    ]);
  });

  it('сообщает прогресс числом готовых и общим числом страниц', async () => {
    const events: string[] = [];
    const progressCalls: BatchProgress[] = [];

    await generatePageBatch({
      pageCount: 5,
      renderPage: createRecordingRenderPage(events),
      packer: createRecordingPacker(events),
      onProgress: (progress) => {
        progressCalls.push(progress);
      },
    });

    expect(progressCalls).toEqual([
      { completed: 0, total: 5 },
      { completed: 1, total: 5 },
      { completed: 2, total: 5 },
      { completed: 3, total: 5 },
      { completed: 4, total: 5 },
      { completed: 5, total: 5 },
    ]);
  });

  it('проходит пачку из одной страницы', async () => {
    const events: string[] = [];
    const report = await generatePageBatch({
      pageCount: 1,
      renderPage: createRecordingRenderPage(events),
      packer: createRecordingPacker(events),
    });

    expect(events).toEqual([...toPageEvents(0), 'build']);
    expect(report.packedCount).toBe(1);
    expect(report.archive).toBeInstanceOf(Blob);
  });

  it('не собирает архив пустой пачки', async () => {
    const events: string[] = [];
    const progressCalls: BatchProgress[] = [];
    const report = await generatePageBatch({
      pageCount: 0,
      renderPage: createRecordingRenderPage(events),
      packer: createRecordingPacker(events),
      onProgress: (progress) => {
        progressCalls.push(progress);
      },
    });

    expect(events).toEqual([]);
    expect(report.archive).toBeNull();
    expect(report.packedCount).toBe(0);
    expect(report.isCanceled).toBe(false);
    expect(report.hasBuildError).toBe(false);
    expect(progressCalls).toEqual([{ completed: 0, total: 0 }]);
  });

  it('не собирает архив, когда не отрисовалась ни одна страница', async () => {
    const events: string[] = [];
    const report = await generatePageBatch({
      pageCount: 3,
      renderPage: async (): Promise<Blob> => {
        throw new Error('страница не отрисовалась');
      },
      packer: createRecordingPacker(events),
    });

    expect(events).toEqual([]);
    expect(report.archive).toBeNull();
    expect(report.failedPageIndexes).toEqual([0, 1, 2]);
    expect(report.failedPageNumbers).toEqual([1, 2, 3]);
    expect(report.hasBuildError).toBe(false);
  });

  it('прекращает генерацию по отмене и архив не собирает', async () => {
    const controller = new AbortController();
    const events: string[] = [];
    const report = await generatePageBatch({
      pageCount: 20,
      renderPage: createRecordingRenderPage(events, (pageIndex) => {
        if (pageIndex === 4) {
          controller.abort();
        }
      }),
      packer: createRecordingPacker(events),
      signal: controller.signal,
    });

    expect(report.isCanceled).toBe(true);
    expect(report.archive).toBeNull();
    expect(report.packedCount).toBe(5);
    expect(events).not.toContain('build');
    expect(events).not.toContain('render:start:5');
  });

  it('не собирает архив, когда отмена пришла после последней страницы', async () => {
    const controller = new AbortController();
    const events: string[] = [];
    const report = await generatePageBatch({
      pageCount: 3,
      renderPage: createRecordingRenderPage(events, (pageIndex) => {
        if (pageIndex === 2) {
          controller.abort();
        }
      }),
      packer: createRecordingPacker(events),
      signal: controller.signal,
    });

    expect(report.isCanceled).toBe(true);
    expect(report.archive).toBeNull();
    expect(report.packedCount).toBe(3);
    expect(events).not.toContain('build');
  });

  it('не отдаёт архив, если отмена пришла во время сборки', async () => {
    const controller = new AbortController();
    const events: string[] = [];
    const report = await generatePageBatch({
      pageCount: 3,
      renderPage: createRecordingRenderPage(events),
      packer: {
        addPage: async () => {
          return undefined;
        },
        build: async () => {
          controller.abort();

          return new Blob(['archive'], { type: ARCHIVE_MIME_TYPE });
        },
      },
      signal: controller.signal,
    });

    expect(report.isCanceled).toBe(true);
    expect(report.archive).toBeNull();
    expect(report.packedCount).toBe(3);
  });

  it('ничего не отрисовывает, когда отмена случилась до старта', async () => {
    const controller = new AbortController();
    const events: string[] = [];

    controller.abort();

    const report = await generatePageBatch({
      pageCount: 20,
      renderPage: createRecordingRenderPage(events),
      packer: createRecordingPacker(events),
      signal: controller.signal,
    });

    expect(report.isCanceled).toBe(true);
    expect(report.archive).toBeNull();
    expect(events).toEqual([]);
  });

  it('считает отменой отказ отрисовки во время отмены', async () => {
    const controller = new AbortController();
    const events: string[] = [];
    const report = await generatePageBatch({
      pageCount: 20,
      renderPage: async (pageIndex: number): Promise<Blob> => {
        events.push(`render:start:${pageIndex}`);

        if (pageIndex === 3) {
          controller.abort();
          throw new Error('aborted');
        }

        return buildPage(pageIndex);
      },
      packer: createSilentPacker(),
      signal: controller.signal,
    });

    expect(report.isCanceled).toBe(true);
    expect(report.failedPageIndexes).toEqual([]);
    expect(report.packedCount).toBe(3);
    expect(events).not.toContain('render:start:4');
  });

  it('продолжает пачку после ошибки отрисовки отдельной страницы', async () => {
    const packedPages: number[] = [];
    const report = await generatePageBatch({
      pageCount: 10,
      renderPage: async (pageIndex: number): Promise<Blob> => {
        if (pageIndex === 3) {
          throw new Error('страница не отрисовалась');
        }

        return buildPage(pageIndex);
      },
      packer: {
        addPage: async (pageIndex) => {
          packedPages.push(pageIndex);
        },
        build: async () => {
          return new Blob(['archive'], { type: ARCHIVE_MIME_TYPE });
        },
      },
    });

    expect(report.failedPageIndexes).toEqual([3]);
    expect(report.failedPageNumbers).toEqual([4]);
    expect(report.packedCount).toBe(9);
    expect(report.isCanceled).toBe(false);
    expect(report.archive).toBeInstanceOf(Blob);
    expect(packedPages).not.toContain(3);
    expect(packedPages).toHaveLength(9);
  });

  it('продолжает пачку после ошибки упаковки отдельной страницы', async () => {
    const report = await generatePageBatch({
      pageCount: 10,
      renderPage: async (pageIndex: number): Promise<Blob> => {
        return buildPage(pageIndex);
      },
      packer: {
        addPage: async (pageIndex) => {
          if (pageIndex === 6) {
            throw new Error('страница не упаковалась');
          }
        },
        build: async () => {
          return new Blob(['archive'], { type: ARCHIVE_MIME_TYPE });
        },
      },
    });

    expect(report.failedPageIndexes).toEqual([6]);
    expect(report.failedPageNumbers).toEqual([7]);
    expect(report.packedCount).toBe(9);
    expect(report.archive).toBeInstanceOf(Blob);
  });

  it('сообщает о сбое сборки архива отчётом, а не исключением', async () => {
    const report = await generatePageBatch({
      pageCount: 3,
      renderPage: async (pageIndex: number): Promise<Blob> => {
        return buildPage(pageIndex);
      },
      packer: {
        addPage: async () => {
          return undefined;
        },
        build: async () => {
          throw new Error('архив не собрался');
        },
      },
    });

    expect(report.hasBuildError).toBe(true);
    expect(report.archive).toBeNull();
    expect(report.isCanceled).toBe(false);
    expect(report.packedCount).toBe(3);
  });

  it('доводит прогресс до конца, даже когда страница не отрисовалась', async () => {
    const progressCalls: BatchProgress[] = [];

    await generatePageBatch({
      pageCount: 4,
      renderPage: async (pageIndex: number): Promise<Blob> => {
        if (pageIndex === 1) {
          throw new Error('страница не отрисовалась');
        }

        return buildPage(pageIndex);
      },
      packer: createSilentPacker(),
      onProgress: (progress) => {
        progressCalls.push(progress);
      },
    });

    expect(progressCalls.at(-1)).toEqual({ completed: 4, total: 4 });
  });
});
