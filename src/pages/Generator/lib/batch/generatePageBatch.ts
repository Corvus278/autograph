import type { GeneratePageBatchParams, PageBatchReport } from './batch.types';
import { createZipPacker } from './packPagesToZip';

/**
 * Чем закончился прогон. Пустой архив бывает по трём разным поводам, и
 * вызывающей стороне нужно их различать.
 */
type BatchOutcome = {
  /**
   * Готовый архив или его отсутствие.
   */
  archive: Blob | null;

  /**
   * Прогон прерван сигналом отмены.
   */
  isCanceled: boolean;

  /**
   * Сборка архива не удалась.
   */
  hasBuildError: boolean;
};

/**
 * Прогоняет пачку страниц и отдаёт архив.
 *
 * Страницы идут строго по одной: следующая отрисовка начинается только после
 * того, как упаковщик принял предыдущую страницу. Ссылку на блоб оркестратор
 * дальше шага цикла не держит — несжатые изображения всех страниц
 * одновременно в памяти не живут.
 *
 * Отмена не бросает исключение: прогон возвращает отчёт с `isCanceled` и без
 * архива. Сигнал проверяется перед каждой страницей, после сборки архива и
 * передаётся в саму отрисовку, поэтому отмена не ждёт конца текущей страницы.
 *
 * Неудача отдельной страницы — отрисовки или упаковки — прогон не роняет: её
 * индекс и номер попадают в отчёт, остальные страницы упаковываются. Страница,
 * упавшая ровно в момент отмены, в список неудавшихся не попадает: прогона
 * дальше нет, и сообщать о ней нечего.
 *
 * @returns отчёт о прогоне; `archive` пуст при отмене, при сбое сборки и когда
 * в архив не попало ни одной страницы
 */
export const generatePageBatch = async ({
  pageCount,
  renderPage,
  packer,
  onProgress,
  signal,
}: GeneratePageBatchParams): Promise<PageBatchReport> => {
  const pagePacker = packer || (await createZipPacker({ totalPages: pageCount }));
  const failedPageIndexes: number[] = [];
  let packedCount = 0;

  /**
   * Отчёт с текущим счётом страниц.
   */
  const toReport = ({ archive, isCanceled, hasBuildError }: BatchOutcome) => {
    return {
      archive,
      isCanceled,
      hasBuildError,
      failedPageIndexes,
      failedPageNumbers: failedPageIndexes.map((pageIndex) => {
        return pageIndex + 1;
      }),
      packedCount,
    };
  };

  /**
   * Отчёт отменённого прогона: архива нет, но пройденное посчитано.
   */
  const toCanceledReport = () => {
    return toReport({ archive: null, isCanceled: true, hasBuildError: false });
  };

  onProgress?.({ completed: 0, total: pageCount });

  for (let pageIndex = 0; pageIndex < pageCount; pageIndex += 1) {
    if (signal?.aborted) {
      return toCanceledReport();
    }

    /**
     * Блоб страницы живёт только внутри шага цикла: упаковщик принимает его до
     * выхода из шага, дальше ссылка не переживает.
     */
    let page: Blob | null = null;

    try {
      page = await renderPage(pageIndex, signal);
    } catch {
      if (signal?.aborted) {
        return toCanceledReport();
      }

      failedPageIndexes.push(pageIndex);
    }

    if (page) {
      try {
        await pagePacker.addPage(pageIndex, page);
        packedCount += 1;
      } catch {
        if (signal?.aborted) {
          return toCanceledReport();
        }

        failedPageIndexes.push(pageIndex);
      }
    }

    onProgress?.({ completed: pageIndex + 1, total: pageCount });
  }

  if (signal?.aborted) {
    return toCanceledReport();
  }

  /**
   * Собирать нечего: пустая пачка или ни одна страница не дошла до упаковщика.
   * Пустой архив пользователю не нужен, а показывать ли ошибку — дело
   * интерфейса.
   */
  if (packedCount === 0) {
    return toReport({ archive: null, isCanceled: false, hasBuildError: false });
  }

  try {
    const archive = await pagePacker.build();

    /**
     * Сборка архива идёт заметное время, и отмена приходится на неё не реже,
     * чем на отрисовку: собранный после отмены архив не отдаём.
     */
    if (signal?.aborted) {
      return toCanceledReport();
    }

    return toReport({ archive, isCanceled: false, hasBuildError: false });
  } catch {
    if (signal?.aborted) {
      return toCanceledReport();
    }

    return toReport({ archive: null, isCanceled: false, hasBuildError: true });
  }
};
