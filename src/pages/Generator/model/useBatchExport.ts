import { downloadBlob } from '@shared/lib/files';
import { useRef, useState } from 'react';

import type { BatchProgress, PageBatchReport } from '../lib/batch';
import { createZipPacker, generatePageBatch } from '../lib/batch';

import { renderPageInWorker } from './createPageRenderClient';
import type { RunRenderPlan } from './pageTask.types';
import type { BatchExportControl, BatchExportDeps } from './useBatchExport.types';

/**
 * Имя архива пачки.
 */
const ARCHIVE_FILE_NAME = 'handwriting_pages.zip';

const DEFAULT_DEPS: BatchExportDeps = {
  renderPage: renderPageInWorker,
  createPacker: (pageCount) => {
    return createZipPacker({ totalPages: pageCount });
  },
  download: downloadBlob,
};

/**
 * Что сказать пользователю по итогам прогона.
 *
 * Отменённый прогон молчит: пользователь сам его прервал, и сообщать ему об
 * этом нечего. Частичный успех говорит номерами страниц — по ним видно, что
 * именно переснять.
 *
 * @param report — отчёт о прогоне пачки
 * @returns сообщение; `null` — сказать нечего
 */
const toNotice = (report: PageBatchReport): string | null => {
  const { isCanceled, hasBuildError, archive, failedPageNumbers } = report;

  if (isCanceled) {
    return null;
  }

  if (hasBuildError) {
    return 'Не удалось собрать архив. Попробуйте ещё раз';
  }

  if (!archive) {
    return 'Ни одна страница не отрисовалась. Попробуйте ещё раз';
  }

  if (failedPageNumbers.length > 0) {
    return `Не отрисовались страницы: ${failedPageNumbers.join(', ')}`;
  }

  return null;
};

/**
 * Выгрузка всей пачки одним архивом.
 *
 * Страницы идут по одной: следующая начинает рисоваться, только когда
 * предыдущая ушла в архив, — потоковость держит ядро (`lib/batch`). Прогресс
 * приходит оттуда же и показывается числом готовых страниц из общего числа.
 *
 * Отмена не роняет приложение: прогон возвращает отчёт, архив не скачивается,
 * а состояние возвращается к исходному.
 *
 * @param plan — план отрисовки прогона; `null` — выгружать пока нечего
 * @param deps — чем рисовать, упаковывать и отдавать; подменяется в тестах
 * @returns прогресс, сообщение об исходе и управление выгрузкой
 */
export const useBatchExport = (
  plan: RunRenderPlan | null,
  deps: Partial<BatchExportDeps> = {}
): BatchExportControl => {
  const { renderPage, createPacker, download } = { ...DEFAULT_DEPS, ...deps };
  const [progress, setProgress] = useState<BatchProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const cancel = (): void => {
    abortRef.current?.abort();
  };

  const start = async (): Promise<void> => {
    if (!plan) {
      setError('Страницы ещё не отрисованы');

      return;
    }

    if (abortRef.current) {
      return;
    }

    const controller = new AbortController();

    abortRef.current = controller;
    setError(null);
    setProgress({ completed: 0, total: plan.pageCount });

    try {
      const report = await generatePageBatch({
        pageCount: plan.pageCount,
        renderPage: (pageIndex, signal) => {
          return renderPage(plan.buildTask(pageIndex), signal);
        },
        packer: createPacker(plan.pageCount),
        onProgress: (next) => {
          setProgress(next);
        },
        signal: controller.signal,
      });

      if (report.archive) {
        download(report.archive, ARCHIVE_FILE_NAME);
      }

      setError(toNotice(report));
    } catch {
      setError('Не удалось выгрузить пачку. Попробуйте ещё раз');
    } finally {
      abortRef.current = null;
      setProgress(null);
    }
  };

  return { progress, error, isRunning: progress !== null, start, cancel };
};
