import { loadRenderImage } from '../lib/render';

import type {
  PageRenderClient,
  PageRenderClientDeps,
  PageRenderPort,
  RenderPageRequest,
  RenderPageResponse,
  RenderSheetBitmap,
} from './pageRenderWorker.types';
import type { PageRenderTask } from './pageTask.types';

/**
 * Незакрытое задание: чем ответить клиенту, когда воркер пришлёт ответ.
 */
type PendingRender = {
  /**
   * Отдать готовую страницу.
   */
  resolve: (page: Blob) => void;

  /**
   * Сообщить, что страница не отрисовалась.
   */
  reject: (error: Error) => void;
};

const CANCELED_MESSAGE = 'Отрисовка страницы отменена';

/**
 * Клиент отрисовки: собирает задание, отправляет его воркеру и ждёт файл.
 *
 * Порт открывается на первое задание, а не при создании клиента: модуль
 * импортируется всегда, а воркер нужен только тому, кто сохраняет страницу.
 * Дальше порт один на все задания — воркер держит разобранный шрифт и карты
 * текстуры в своей памяти, и новый порт каждый раз читал бы их заново.
 *
 * Фотография листа декодируется здесь и уезжает передачей владения: копировать
 * полноразмерный битмап на каждую страницу дороже, чем её нарисовать. Владение
 * после отправки принадлежит воркеру, поэтому задание, отправленное дважды,
 * второй раз фон не нарисует — и каждая страница пачки декодирует свою
 * фотографию сама.
 *
 * @param deps — чем открывать порт и чем декодировать фотографии
 * @returns клиент отрисовки
 */
export const createPageRenderClient = (deps: PageRenderClientDeps): PageRenderClient => {
  const { createPort, loadImage } = deps;
  const pending = new Map<number, PendingRender>();
  let port: PageRenderPort | null = null;
  let lastRequestId = 0;

  /**
   * Закрывает задание ответом воркера.
   */
  const settle = (response: RenderPageResponse): void => {
    const waiting = pending.get(response.requestId);

    if (!waiting) {
      return;
    }

    pending.delete(response.requestId);

    switch (response.status) {
      case 'done': {
        waiting.resolve(response.page);

        return;
      }

      case 'failed': {
        waiting.reject(new Error(response.message));

        return;
      }

      default: {
        throw new Error('Воркер ответил неизвестным исходом');
      }
    }
  };

  /**
   * Порт воркера: открывается на первое задание и живёт до конца вкладки.
   */
  const openPort = (): PageRenderPort => {
    if (port) {
      return port;
    }

    const opened = createPort();

    opened.addEventListener('message', (event) => {
      settle(event.data);
    });
    port = opened;

    return opened;
  };

  /**
   * Декодирует фотографию листа задания.
   */
  const loadSheet = async (
    sheet: PageRenderTask['sheet']
  ): Promise<RenderSheetBitmap | null> => {
    if (!sheet) {
      return null;
    }

    const image = await loadImage(sheet.src);

    return {
      image,
      width: sheet.width,
      height: sheet.height,
      isMirrored: sheet.isMirrored,
    };
  };

  const render = async (task: PageRenderTask, signal?: AbortSignal): Promise<Blob> => {
    if (signal?.aborted) {
      throw new Error(CANCELED_MESSAGE);
    }

    const sheet = await loadSheet(task.sheet);

    lastRequestId += 1;

    const requestId = lastRequestId;
    const request: RenderPageRequest = {
      requestId,
      params: task.params,
      sheet,
      textureSrc: task.textureSrc,
      font: task.font,
      pageWidth: task.pageWidth,
      pageHeight: task.pageHeight,
      quality: task.quality,
    };

    return new Promise<Blob>((resolve, reject) => {
      pending.set(requestId, { resolve, reject });

      signal?.addEventListener(
        'abort',
        () => {
          pending.delete(requestId);
          reject(new Error(CANCELED_MESSAGE));
        },
        { once: true }
      );

      try {
        openPort().postMessage(request, sheet ? [sheet.image] : []);
      } catch (error: unknown) {
        pending.delete(requestId);
        reject(
          new Error(
            error instanceof Error
              ? `Задание не прошло через границу воркера: ${error.message}`
              : 'Задание не прошло через границу воркера'
          )
        );
      }
    });
  };

  return { render };
};

/**
 * Клиент приложения: настоящий воркер и настоящее декодирование фотографий.
 * Создаётся при первом задании — в тестах и в jsdom воркера нет, а модуль
 * импортируется всегда.
 */
let appClient: PageRenderClient | null = null;

/**
 * Отрисовывает страницу в воркере на внеэкранном canvas.
 *
 * Обещание разрешается готовым файлом; отказ — страница не отрисовалась.
 * Основной поток при этом ничего не рисует: он только декодирует фотографию
 * листа и ждёт ответа, поэтому интерфейс отвечает и во время отрисовки в
 * полном разрешении.
 *
 * @param task — задание на отрисовку страницы
 * @param signal — сигнал отмены
 * @returns файл страницы
 */
export const renderPageInWorker = (
  task: PageRenderTask,
  signal?: AbortSignal
): Promise<Blob> => {
  if (!appClient) {
    appClient = createPageRenderClient({
      createPort: () => {
        return new Worker(new URL('./renderPage.worker.ts', import.meta.url), {
          type: 'module',
        });
      },
      loadImage: loadRenderImage,
    });
  }

  return appClient.render(task, signal);
};
