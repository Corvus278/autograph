import type { RenderPageRequest, RenderPageResponse } from './pageRenderWorker.types';
import { renderPageRequest } from './renderPageRequest';

/**
 * Что сказать клиенту, когда страница не отрисовалась. Причина доходит текстом:
 * исключение через границу воркера не проходит, а отчёту о пачке нужен номер
 * страницы и внятная строка.
 *
 * @param error — то, чем кончилась отрисовка
 * @returns сообщение об отказе
 */
const toMessage = (error: unknown): string => {
  return error instanceof Error ? error.message : 'Страница не отрисовалась';
};

/**
 * Воркер отрисовки страниц: принимает задание, рисует страницу на внеэкранном
 * canvas и отдаёт готовый файл.
 *
 * Задания обрабатываются по мере поступления и отвечаются по номеру: пачка
 * шлёт их по одному, но клиент на этот порядок не опирается.
 */
addEventListener('message', (event: MessageEvent<RenderPageRequest>) => {
  const request = event.data;

  const reply = async (): Promise<void> => {
    try {
      const page = await renderPageRequest(request);
      const response: RenderPageResponse = {
        requestId: request.requestId,
        status: 'done',
        page,
      };

      postMessage(response);
    } catch (error: unknown) {
      const response: RenderPageResponse = {
        requestId: request.requestId,
        status: 'failed',
        message: toMessage(error),
      };

      postMessage(response);
    }
  };

  void reply();
});
